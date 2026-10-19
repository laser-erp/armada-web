/**
 * QA G: запись на staging (E2E T1–T4, G4 /z, G6 webhook).
 * Запуск: node web-preview/test/g-etrn-staging-write.mjs
 * env: STAGING_SUPER_PIN, SSH ~/.ssh/armada_staging; секреты портала — /tmp/g-etrn-qa-secrets.json
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..', '..');
const SSH_HOST = process.env.SSH_HOST || '176.12.67.35';
const SSH_KEY = process.env.SSH_KEY || path.join(os.homedir(), '.ssh', 'armada_staging');
const ARMADA_SPACE = 'b713867e-1c60-4391-bf27-8262c1206e11';
const ARMADA_OWN_COMPANY = 'b5a8c1ce-0002-483e-8ee7-f65abc77e1ea';
const QA_DRIVER_NAME = 'Водитель ТЕСТ QA';
const QA_VEHICLE_PLATE = 'О 535 МВ 198';
const QA_DRIVER_PHONE = process.env.G_ETRN_DRIVER_PHONE || '+79009009001';
const BASE = (process.env.G_ETRN_BASE || 'https://staging.app.armada.sx:9443').replace(/\/$/, '');
const API = `${BASE}/armada-api`;
const MARK = process.env.G_ETRN_MARK || `G-ETRN QA ${new Date().toISOString().slice(11, 19)}`;
const LOGIST_INN = process.env.STAGING_SUPER_INN || process.env.STAGING_LOGIST_INN || '7802655283';
const LOGIST_PIN = process.env.STAGING_SUPER_PIN || process.env.STAGING_LOGIST_PIN || '';
const PW_STEP = 60000;
const PW_LONG = 120000;
const PHASE_MS = 120000;

/** Жёсткий потолок на фазу E2E (сторож убивает shell >240 с). */
async function phaseTimeout(label, fn, ms = PHASE_MS) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const results = [];
const gSteps = {};
const order409Log = [];

function record(id, status, fact) {
  results.push({ id, status, fact });
  console.log(`G-STAGING ${id} ${status} ${fact}`);
}

/** После каждого пункта раздела G — строка для отчёта. */
function stepG(id, ok, fact) {
  const status = ok ? '✅' : '❌';
  gSteps[id] = { status, fact };
  const line = ok ? `ШАГ ${id}: ✅` : `ШАГ ${id}: ❌ ${fact}`;
  console.log(line);
  record(id, status, fact);
}

function watchAdminOrder409(page) {
  page.on('response', async (res) => {
    if (res.status() !== 409) return;
    const req = res.request();
    if (!/\/admin\/orders/i.test(req.url())) return;
    const body = await res.text().catch(() => '');
    order409Log.push({
      method: req.method(),
      url: req.url().replace(/\?.*$/, ''),
      body: body.slice(0, 400),
    });
    console.log(`G-STAGING 409 /admin/orders ${body.slice(0, 200)}`);
  });
}

function loadSecrets() {
  const p = process.env.G_ETRN_SECRETS || '/tmp/g-etrn-qa-secrets.json';
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sshBackupBeforeWrite() {
  const cmd =
    'sqlite3 /opt/pocketbase-staging/pb_data/data.db ".backup /root/backup-staging-g7-$(date +%H%M).db"';
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, cmd], {
    encoding: 'utf8',
    timeout: 120000,
  });
  return r.status === 0;
}

function sshEntityCounts() {
  const py = `import json, sqlite3
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
print(json.dumps({k:len(p.get(k) or []) for k in ("admins","customers","drivers","vehicles")}))`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  try {
    return JSON.parse((r.stdout || '').trim());
  } catch {
    return null;
  }
}

function sshFetchOrder(orderId) {
  const py = `import json, sqlite3
oid=${JSON.stringify(orderId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    if o.get("id")==oid:
        print(json.dumps(o, ensure_ascii=False))
        break`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (r.status !== 0) return null;
  const line = (r.stdout || '').trim();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Дождаться, пока в PB титул станет signed (после shipper-t1 / admin push). */
async function waitPbTitulSigned(orderId, titulKey, tries = 25, delayMs = 2000) {
  for (let i = 0; i < tries; i++) {
    const pb = sshOrderEtrn(orderId);
    if (pb?.etrn?.tituls?.[titulKey] === 'signed') return pb;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return sshOrderEtrn(orderId);
}

function sshOrderEtrn(orderId) {
  const py = `import json, sqlite3
oid=${JSON.stringify(orderId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    if o.get("id")==oid:
        print(json.dumps({"seq":o.get("sequentialNumber"),"etrn":o.get("etrn"),"transportDocMode":o.get("transportDocMode"),"shipperSame":o.get("shipperSameAsCustomer"),"driverName":o.get("driverName"),"vehiclePlate":o.get("vehiclePlate")}, ensure_ascii=False))
        break`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status !== 0) return null;
  const line = (r.stdout || '').trim();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function attachDialogs(page) {
  page.on('dialog', (d) => d.accept().catch(() => {}));
}

/** CSP staging: без waitForFunction; онбординг перекрывает клики — закрываем кнопками. */
async function dismissOnboarding(page) {
  for (let i = 0; i < 8; i++) {
    const tip = page.locator('.onboard-tooltip');
    if (!(await tip.isVisible().catch(() => false))) break;
    const skip = page.locator('.onboard-skip, .onboard-welcome-skip').first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ timeout: PW_STEP }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
  await page.locator('.onboard-tooltip').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
}

function sshResolveDriverPin(phone) {
  const py = `import json, sqlite3
phone=${JSON.stringify(String(phone || '').replace(/\\D/g, ''))}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
def norm(ph):
    d=str(ph or "").replace(" ","").replace("-","")
    if d.startswith("+7"): d="7"+d[2:]
    elif d.startswith("8") and len(d)==11: d="7"+d[1:]
    elif len(d)==10: d="7"+d
    return d
def same(a,b):
    return str(a or "").strip().lower()==str(b or "").strip().lower()
target=norm(phone)[-10:]
for d in p.get("drivers") or []:
    ph=norm(d.get("phone") or "")
    if not ph.endswith(target): continue
    own=str(d.get("pin") or "").strip()
    if len(own)>=4:
        print(own); break
    adm=next((a for a in (p.get("admins") or []) if same(a.get("name"), d.get("name"))), None)
    if adm and len(str(adm.get("pin") or "").strip())>=4:
        print(str(adm.get("pin")).strip()); break
    if len(ph)>=4:
        print(ph[-4:]); break
`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8' },
  );
  const pin = (r.stdout || '').trim();
  return pin.length >= 4 ? pin : null;
}

/** Включить ЭТрН в тарифе space на staging PB (без push всего state из браузера). */
function sshPatchBillingEtrn(spaceId = ARMADA_SPACE) {
  const py = `import json, sqlite3, datetime
sid=${JSON.stringify(spaceId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(db)
rid, raw = conn.execute("SELECT id, payload FROM app_state WHERE key='main' LIMIT 1").fetchone()
p = json.loads(raw)
p.setdefault("billing", {}).setdefault("spaces", {})
b = p["billing"]["spaces"].setdefault(sid, {})
p["dataEpoch"] = int(p.get("dataEpoch") or 0) + 1
b["planId"] = "business"
b["status"] = "trial"
b["etrnEnabled"] = True
b["exchangeEnabled"] = True
if not b.get("trialEndsAt"):
    b["trialEndsAt"] = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
conn.execute("UPDATE app_state SET payload=? WHERE id=?", (json.dumps(p, ensure_ascii=False), rid))
conn.commit()
print(json.dumps({"ok": True, "etrn": b.get("etrnEnabled"), "epoch": p["dataEpoch"]}))`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return { ok: false, err: (r.stderr || r.stdout || 'ssh').slice(0, 120) };
  try {
    return JSON.parse((r.stdout || '').trim());
  } catch {
    return { ok: false, err: 'parse' };
  }
}

/** Открытая смена + пройденное ЕТО для водителя парка Армады (запись в shifts[] на staging). */
function sshEnsureDriverShiftEto(driverName, plate, ownCompanyId = ARMADA_OWN_COMPANY) {
  const py = `import json, sqlite3, datetime
name=${JSON.stringify(driverName)}
plate=${JSON.stringify(plate)}
own=${JSON.stringify(ownCompanyId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(db)
rid, raw = conn.execute("SELECT id, payload FROM app_state WHERE key='main' LIMIT 1").fetchone()
p = json.loads(raw)
now=datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
shifts=p.get("shifts") or []
for s in shifts:
    if s.get("driverName")==name and not s.get("endedAt"):
        s["endedAt"]=now
sid="qa-g-etrn-shift-"+now[:10].replace("-","")
shifts.append({
    "id": sid,
    "startedAt": now,
    "driverName": name,
    "vehiclePlate": plate,
    "ownCompanyId": own,
    "odometer": 100500,
    "lastOdometerPoint": 100500,
    "fuelLiters": 40,
    "fuelPricePerLiter": 55,
    "gur": "Максимум",
    "coolant": "Середина",
    "oil": "Минимум",
    "light": {"lowBeam": "ok", "brake": "ok", "turn": "ok"},
    "completedAt": now,
    "orders": [],
    "endedAt": None,
})
p["shifts"]=shifts
p["dataEpoch"]=int(p.get("dataEpoch") or 0)+1
conn.execute("UPDATE app_state SET payload=? WHERE id=?", (json.dumps(p, ensure_ascii=False), rid))
conn.commit()
print(json.dumps({"ok": True, "shiftId": sid}))`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return { ok: false };
  try {
    return JSON.parse((r.stdout || '').trim());
  } catch {
    return { ok: false };
  }
}

function sshBillingEtrnEnabled(spaceId = ARMADA_SPACE) {
  const py = `import json, sqlite3
sid=${JSON.stringify(spaceId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
b=(p.get("billing") or {}).get("spaces",{}).get(sid,{})
print("1" if b.get("etrnEnabled") else "0")`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8' },
  );
  return (r.stdout || '').trim() === '1';
}

function sshFindOrderByMark(mark) {
  const py = `import json, sqlite3
mark=${JSON.stringify(mark)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    if mark in (o.get("cargoDescription") or "") or mark in json.dumps(o, ensure_ascii=False):
        print(json.dumps({"id":o.get("id"),"transportDocMode":o.get("transportDocMode"),"shipperSame":o.get("shipperSameAsCustomer"),"cancelled":bool(o.get("cancelledAt"))}, ensure_ascii=False))
        break`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status !== 0) return null;
  const line = (r.stdout || '').trim();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function curlJson(url, opts = {}) {
  const args = ['-sk', '--connect-timeout', '15', '--max-time', '55', '--resolve', 'staging.app.armada.sx:9443:127.0.0.1'];
  if (opts.method) args.push('-X', opts.method);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push('-H', `${k}: ${v}`);
  }
  if (opts.body) args.push('-d', opts.body);
  args.push(url);
  const r = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function selectArmadaCabinet(page) {
  const sel = page.locator('#admin-sidebar-cabinet .super-cabinet-picker-sel');
  if (await sel.isVisible().catch(() => false)) {
    await sel.selectOption(ARMADA_SPACE, { timeout: PW_STEP }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

/** Очистить тяжёлый snapshot в браузере (quota localStorage на staging). */
async function clearArmadaLocalStorage(page) {
  await page
    .evaluate(() => {
      try {
        localStorage.removeItem('armada_app_v5');
        localStorage.removeItem('armada_admin_session');
      } catch (_) {}
    })
    .catch(() => {});
}

/** Прямой вызов loginAdmin в странице (staging-logist-login-verify). */
async function tryLoginAdminEvaluate(page, loginRaw, pin) {
  return page
    .evaluate(
      async ({ raw, pin: pinVal }) => {
        const d = String(raw || '').replace(/\D/g, '');
        const variants = [];
        if (d.length === 10 || d.length === 12) {
          variants.push(d, String(raw || '').trim());
        } else {
          const last10 = d.slice(-10);
          if (last10.length === 10) {
            variants.push(
              last10,
              typeof formatPhone === 'function' ? formatPhone('+7' + last10) : '',
              '+7' + last10,
            );
          }
          variants.push(String(raw || '').trim());
        }
        const seen = new Set();
        for (const v of variants) {
          const loginVal = String(v || '').trim();
          if (!loginVal || seen.has(loginVal)) continue;
          seen.add(loginVal);
          const inn = document.getElementById('admin-login-inn');
          const pi = document.getElementById('pin-input');
          const pe = document.getElementById('pin-error');
          if (!inn || !pi) return false;
          inn.value = loginVal;
          pi.value = String(pinVal || '').trim();
          if (pe) pe.textContent = '';
          if (typeof loginAdmin !== 'function') return false;
          await loginAdmin();
          await new Promise((r) => setTimeout(r, 4000));
          if (typeof currentAdmin !== 'undefined' && currentAdmin) return true;
        }
        return !!(typeof currentAdmin !== 'undefined' && currentAdmin);
      },
      { raw: loginRaw, pin },
    )
    .catch(() => false);
}

/** Вход логиста/супера — как a-ref-staging-write (без waitForURL / waitForNavigation). */
async function adminLogin(page, pin) {
  if (!pin) return false;
  attachDialogs(page);
  page.setDefaultTimeout(PW_LONG);
  page.setDefaultNavigationTimeout(PW_LONG);
  await page.goto(`${BASE}/a/`, { waitUntil: 'networkidle', timeout: PW_LONG });
  await page.waitForSelector('#admin-login-inn, #admin-pin', { timeout: 60000 });
  await page.fill('#admin-login-inn', LOGIST_INN).catch(() => {});
  const pinEl = page.locator('#pin-input, #admin-login-pin, input[type="password"]').first();
  await pinEl.fill(pin);
  await page.locator('#pin-ok:not([disabled])').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  for (let i = 0; i < 40; i++) {
    const ready = await page
      .evaluate(() => typeof loginAdmin === 'function')
      .catch(() => false);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await page.locator('#pin-ok').click({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await page
    .evaluate(async () => {
      if (typeof pullRemoteUpdates === 'function') {
        await pullRemoteUpdates('qa-g-etrn-login');
      }
    })
    .catch(() => {});
  let loggedIn = false;
  try {
    await page.locator('#admin.show').waitFor({ state: 'visible', timeout: 90000 });
    loggedIn = true;
  } catch (_) {
    loggedIn = await page
      .evaluate(
        () =>
          !!(
            typeof currentAdmin !== 'undefined' &&
            currentAdmin &&
            document.querySelector('#admin.show')
          ),
      )
      .catch(() => false);
  }
  if (!loggedIn) {
    loggedIn = await tryLoginAdminEvaluate(page, LOGIST_INN, pin);
    if (loggedIn) {
      await page.locator('#admin.show').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      loggedIn = await page.locator('#admin.show').isVisible().catch(() => false);
    }
  }
  if (!loggedIn) return false;
  await page.waitForSelector('#admin-list, #admin-create', { timeout: 60000 }).catch(() => {});
  await dismissOnboarding(page);
  await selectArmadaCabinet(page);
  return true;
}

async function refreshAdminBillingLocal(page, sid) {
  await page
    .evaluate((spaceId) => {
      if (typeof setSpaceBillingPlan === 'function') setSpaceBillingPlan(spaceId, 'business');
      if (typeof bootstrapPilotSpace === 'function') {
        bootstrapPilotSpace(spaceId, { planId: 'business', extendDays: 30 });
      }
    }, sid)
    .catch(() => {});
}

async function blockFullStatePush(page) {
  await page
    .evaluate(() => {
      window.pushServerState = async () => ({ ok: true, qaSkip: 'g-etrn-no-full-push' });
      window.pushServerStateQueued = () => Promise.resolve({ ok: true, qaSkip: true });
      if (typeof persist === 'function') {
        window.persist = function qaPersistNoPush() {
          if (typeof persistLocalOnly === 'function') {
            try {
              persistLocalOnly();
            } catch (_) {}
          }
        };
      }
    })
    .catch(() => {});
}

async function enableArmadaEtrn(page) {
  try {
    let on = sshBillingEtrnEnabled();
    if (!on) {
      sshPatchBillingEtrn(ARMADA_SPACE);
      await new Promise((r) => setTimeout(r, 1500));
      on = sshBillingEtrnEnabled();
    }
    await blockFullStatePush(page);
    if (on) {
      await refreshAdminBillingLocal(page, ARMADA_SPACE);
      return { ok: true, fact: 'etrnEnabled в PB (без push state)' };
    }
    return { ok: false, fact: `billingEtrn=${on} после PB patch` };
  } catch (e) {
    const on = sshBillingEtrnEnabled();
    return { ok: on, fact: `prep err: ${String(e.message || e).slice(0, 80)}` };
  }
}

async function dismissCustomerOnboarding(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('armada_onboard_customer_v1', '1');
    } catch (_) {}
  });
  await dismissOnboarding(page);
}

async function loginCustomerPortal(page, slug, phone, pin) {
  attachDialogs(page);
  await page.context().addInitScript(() => {
    try {
      localStorage.setItem('armada_onboard_customer_v1', '1');
    } catch (_) {}
  });
  await page.goto(`${BASE}/z/${slug}/`, { waitUntil: 'domcontentloaded', timeout: PW_LONG });
  await page.waitForTimeout(6000);
  let ok =
    (await page.locator('#customer-portal.show').isVisible().catch(() => false)) ||
    (await page.locator('#cust-order-form').isVisible().catch(() => false));
  if (!ok) {
    await page.waitForSelector('#cust-login-phone', { timeout: PW_STEP }).catch(() => {});
    if (await page.locator('#cust-login-phone').isVisible().catch(() => false)) {
      await page.fill('#cust-login-phone', phone);
      await page.fill('#cust-login-pin', pin);
      await page.click('#cust-login-ok', { timeout: PW_STEP });
    }
    await page.waitForTimeout(12000);
    ok =
      (await page.locator('#customer-portal.show').isVisible().catch(() => false)) ||
      (await page.locator('#cust-order-form').isVisible().catch(() => false));
  }
  await page.evaluate(async ({ ph, pin: p }) => {
    if (typeof armadaApiVerifyCustomer !== 'function') return;
    const role = typeof armadaApiTokenRole === 'function' ? armadaApiTokenRole() : '';
    if (role === 'customer') return;
    const scope = typeof getPortalScope === 'function' ? getPortalScope() : null;
    await armadaApiVerifyCustomer(ph, p, scope);
  }, { ph: phone, pin });
  if (!ok) return false;
  await dismissCustomerOnboarding(page);
  return await page.locator('#cust-order-form').isVisible().catch(() => false);
}

async function submitCustomerOrderForm(page, { mark, shipperDiff, custPhone, custPin }) {
  await dismissCustomerOnboarding(page);
  await page.locator('[data-cust-tab="new"]').click({ timeout: PW_STEP }).catch(() => {});
  await page.locator('[data-cust-mode="form"]').click({ timeout: PW_STEP }).catch(() => {});
  await page.evaluate(async ({ ph, pin }) => {
    if (typeof armadaApiVerifyCustomer !== 'function') return;
    const scope = typeof getPortalScope === 'function' ? getPortalScope() : null;
    await armadaApiVerifyCustomer(ph, pin, scope);
    if (typeof setArmadaApiToken === 'function' && typeof armadaApiTokenRole === 'function') {
      if (armadaApiTokenRole() === 'sync') setArmadaApiToken('');
      await armadaApiVerifyCustomer(ph, pin, scope);
    }
  }, { ph: custPhone, pin: custPin });

  const postWait = page
    .waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/customer\/orders/i.test(r.url()) &&
        r.status() >= 200 &&
        r.status() < 300,
      { timeout: PW_LONG },
    )
    .catch(() => null);

  const created = await page
    .evaluate(
      async ({ cargoMarker, shipperDiff: shipDiff }) => {
        window.armadaConfirm = async () => true;
        if (!window.__gEtrnRatesPatch) {
          window.__gEtrnRatesPatch = true;
          window.fillRatesFrom = function (form, amount) {
            const VAT = 0.22;
            const CASH = 0.08;
            let without;
            if (form === 'withoutVat') without = amount;
            else if (form === 'withVat') without = amount / (1 + VAT);
            else without = amount / (1 - CASH);
            const round2 = (n) => Math.round(n * 100) / 100;
            return {
              withVat: round2(without * (1 + VAT)),
              withoutVat: round2(without),
              cash: round2(without * (1 - CASH)),
            };
          };
        }
        if (typeof setCustomerOrderMode === 'function') setCustomerOrderMode('form');
        const tomorrow = new Date(Date.now() + 86400000);
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const yyyy = tomorrow.getFullYear();
        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val;
        };
        set('cust-load', 'СПб, Невский 1');
        set('cust-unload', 'СПб, Московский 10');
        set('cust-vehicle-date', `${dd}.${mm}.${yyyy}`);
        set('cust-vehicle-time', '11:00');
        set('cust-weight-value', '1');
        set('cust-cargo-text', cargoMarker);
        const shipSame = document.getElementById('cust-shipper-same');
        const shipFields = document.getElementById('cust-shipper-fields');
        if (shipSame) {
          shipSame.checked = !shipDiff;
          shipSame.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (typeof syncCustomerShipperFields === 'function') syncCustomerShipperFields();
        if (shipFields) shipFields.hidden = !shipDiff;
        if (shipDiff) {
          set('cust-shipper-name', 'ООО ГО G-ETRN QA');
          set('cust-shipper-phone', '+79001112244');
          set('cust-shipper-inn', '7707083893');
        }
        const vchk = document.querySelector('#cust-vehicle-types [data-vtype]');
        if (vchk) vchk.checked = true;
        const lm = document.querySelector('#cust-load-methods input');
        if (lm) lm.checked = true;
        const um = document.querySelector('#cust-unload-methods input');
        if (um) um.checked = true;
        if (typeof updateCustomerPricePreview === 'function') updateCustomerPricePreview();
        if (typeof buildCustomerDraftFromForm === 'function' && typeof suggestCustomerOrderPrice === 'function') {
          const draftForPrice = buildCustomerDraftFromForm();
          const q = suggestCustomerOrderPrice(draftForPrice);
          const priceEl = document.getElementById('cust-price');
          if (q && priceEl && q.minimumCash > 0) {
            priceEl.value = String(Math.round(q.minimumCash));
            priceEl.dataset.auto = '0';
          }
        }
        const errs =
          typeof collectCustomerPortalFormErrors === 'function' ? collectCustomerPortalFormErrors() : [];
        if (errs.length) return { error: errs.join('; ') };
        const co = findCompanyById(currentCustomer.companyId);
        if (typeof submitCustomerOrderAsync === 'function') await submitCustomerOrderAsync();
        else if (typeof submitCustomerOrder === 'function') submitCustomerOrder();
        for (let i = 0; i < 24; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const full = (state.orders || [])
            .filter(
              (o) =>
                o.customerId === (co && co.id) &&
                String(o.cargoDescription || '').includes(cargoMarker),
            )
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
          if (full) {
            return {
              id: full.id,
              transportDocMode: full.transportDocMode,
              shipperSameAsCustomer: full.shipperSameAsCustomer,
            };
          }
        }
        const fe = (document.getElementById('cust-form-error') || {}).textContent || '';
        return { error: fe.trim().slice(0, 160) || 'order not created (marker)' };
      },
      { cargoMarker: mark, shipperDiff },
    )
    .catch((e) => ({ error: String(e.message || e).slice(0, 120) }));

  if (created?.error || !created?.id) {
    return { id: null, formErr: created?.error || 'evaluate_fail' };
  }

  const pushMeta = await page
    .evaluate(async ({ ph, pin, oid }) => {
      if (typeof armadaApiVerifyCustomer === 'function') {
        const scope = typeof getPortalScope === 'function' ? getPortalScope() : null;
        await armadaApiVerifyCustomer(ph, pin, scope);
      }
      if (typeof persistCustomerPortalOrderImmediate !== 'function') {
        return { ok: false, err: 'no_push' };
      }
      const r = await persistCustomerPortalOrderImmediate(oid);
      return { ok: !!(r && r.ok), err: r && r.err };
    }, { ph: custPhone, pin: custPin, oid: created.id })
    .catch(() => ({ ok: false, err: 'evaluate' }));

  await postWait;
  if (!pushMeta?.ok) {
    record('cust-push', '❌', String(pushMeta?.err || 'push_fail').slice(0, 120));
  }

  let meta = { id: created.id, transportDocMode: created.transportDocMode, shipperSame: !created.shipperSameAsCustomer };
  for (let i = 0; i < 12 && !sshFindOrderByMark(mark)?.id; i++) {
    await page.waitForTimeout(2000);
    const fromDb = sshFindOrderByMark(mark);
    if (fromDb?.id) meta = { ...meta, ...fromDb };
  }
  if (!sshFindOrderByMark(mark)?.id) {
    meta.formErr = 'нет в БД после push';
    meta.pushOk = !!pushMeta?.ok;
  }
  return meta;
}

async function logistOpenOrderByMark(page, mark, orderId = '') {
  attachDialogs(page);
  const onAdmin = await page.locator('#admin.show').isVisible().catch(() => false);
  if (!onAdmin) {
    await page.goto(`${BASE}/a/`, { waitUntil: 'domcontentloaded', timeout: PW_LONG });
    await dismissOnboarding(page);
  } else {
    await dismissOnboarding(page);
  }
  await page
    .evaluate(async ({ m, oid }) => {
      const has = (state.orders || []).some(
        (x) =>
          x.id === oid ||
          String(x.cargoDescription || '').includes(m) ||
          JSON.stringify(x).includes(m),
      );
      if (!has && typeof fetchServerState === 'function') {
        try {
          await fetchServerState(12000);
        } catch (_) {}
      }
    }, { m: mark, oid: orderId })
    .catch(() => {});
  if (onAdmin) {
    await page.locator('[data-nav="orders"]').click({ timeout: PW_STEP }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const opened = await page
    .evaluate(({ m, oid }) => {
      const hit = (state.orders || []).find(
        (x) =>
          x.id === oid ||
          (m && String(x.cargoDescription || '').includes(m)) ||
          JSON.stringify(x).includes(m),
      );
      if (!hit) return { ok: false };
      if (typeof openAdminOrderDetail === 'function') {
        openAdminOrderDetail(hit.id);
        return { ok: true, id: hit.id };
      }
      return { ok: false, err: 'no_openAdminOrderDetail' };
    }, { m: mark, oid: orderId })
    .catch(() => ({ ok: false }));
  if (!opened?.ok) {
    await page.getByText(mark, { exact: false }).first().click({ timeout: PW_STEP }).catch(() => {});
  }
  await page.waitForTimeout(2000);
}

async function logistAssignOrder(page, mark, orderId = '') {
  const oid = orderId || sshFindOrderByMark(mark)?.id;
  await page
    .evaluate(async () => {
      if (typeof fetchServerState === 'function') {
        try {
          await fetchServerState(12000);
        } catch (_) {}
      }
    })
    .catch(() => {});
  const remoteOrder = oid ? sshFetchOrder(oid) : null;
  const patchWait = page
    .waitForResponse(
      (r) =>
        /\/admin\/orders/i.test(r.url()) &&
        ['PATCH', 'POST'].includes(r.request().method()) &&
        r.status() >= 200 &&
        r.status() < 300,
      { timeout: 45000 },
    )
    .catch(() => null);
  const assignOut = await page
    .evaluate(async ({ orderOid, preferName, preferPlate, remoteOrder: ro }) => {
      window.confirm = () => true;
      window.armadaConfirm = async () => true;
      let o = (state.orders || []).find((x) => x.id === orderOid);
      if (!o && ro && ro.id) {
        state.orders = [ro, ...(state.orders || []).filter((x) => x && x.id !== ro.id)];
        o = ro;
      }
      if (!o) return { ok: false, err: 'no_order' };
      const co = typeof currentOwnCompany === 'function' ? currentOwnCompany() : null;
      const firmId = co?.id || o.ownCompanyId;
      const drivers = typeof fleetDriversForCompany === 'function' ? fleetDriversForCompany(firmId) : [];
      const vehicles = typeof fleetVehiclesForCompany === 'function' ? fleetVehiclesForCompany(firmId) : [];
      const driver =
        drivers.find((d) => d.name === preferName)?.name || drivers[0]?.name;
      const plate =
        vehicles.find((v) => v.plate === preferPlate)?.plate || vehicles[0]?.plate;
      if (!driver || !plate) {
        return { ok: false, err: 'no_fleet', drivers: drivers.length, vehicles: vehicles.length };
      }
      if (typeof applyOwnFleetAssignment !== 'function') return { ok: false, err: 'no_apply' };
      const res = applyOwnFleetAssignment(o, driver, plate, firmId, {
        skipDocsConfirm: true,
        allowMismatch: true,
      });
      if (!res.ok) return { ok: false, err: res.message || 'assign_fail' };
      if (typeof commitOwnFleetAssignment === 'function') commitOwnFleetAssignment(o);
      else if (typeof upsertOrder === 'function') upsertOrder(o);
      if (typeof ensureEtrnForOrder === 'function') ensureEtrnForOrder(o, { silent: true });
      if (typeof persistAdminOrderImmediate === 'function') {
        const r = await persistAdminOrderImmediate(o.id, { isNew: false });
        return {
          ok: !!(r && r.ok),
          err: r && r.message,
          etrn: !!o.etrn,
          externalId: o.etrn?.externalId,
          token: o.etrn?.shipperSignToken,
          driver: o.driverName,
          plate: o.vehiclePlate,
        };
      }
      return { ok: true, etrn: !!o.etrn, driver: o.driverName, plate: o.vehiclePlate };
    }, {
      orderOid: oid,
      preferName: QA_DRIVER_NAME,
      preferPlate: QA_VEHICLE_PLATE,
      remoteOrder,
    })
    .catch((e) => ({ ok: false, err: String(e.message || e).slice(0, 80) }));
  await patchWait;
  await page.waitForTimeout(800).catch(() => {});
  const meta = oid ? { id: oid } : sshFindOrderByMark(mark);
  let full = meta?.id ? sshOrderEtrn(meta.id) : null;
  for (let i = 0; i < 10 && meta?.id && !full?.etrn; i++) {
    await page.waitForTimeout(2000);
    full = sshOrderEtrn(meta.id);
  }
  const etrn = full?.etrn || (assignOut.etrn ? { externalId: assignOut.externalId, shipperSignToken: assignOut.token } : null);
  const assigned =
    assignOut.ok &&
    full?.driverName &&
    full?.vehiclePlate &&
    full.driverName !== 'Диспетчер' &&
    full.vehiclePlate !== '—';
  return {
    ok: assigned,
    id: meta?.id,
    etrn: !!etrn,
    externalId: etrn?.externalId || assignOut.externalId,
    token: etrn?.shipperSignToken || assignOut.token,
    assignDetail: assignOut.err || `${assignOut.driver || '?'}/${assignOut.plate || '?'}`,
  };
}

/** Синхронизировать заказ и тариф ЭТрН в state страницы (водитель/логист без полного push). */
async function mergeOrderBillingIntoPage(page, order) {
  if (!order?.id) return;
  await page
    .evaluate(({ o, sid }) => {
      state.billing = state.billing || { spaces: {} };
      state.billing.spaces[sid] = Object.assign({}, state.billing.spaces[sid] || {}, {
        planId: 'business',
        status: 'trial',
        etrnEnabled: true,
        exchangeEnabled: true,
      });
      const list = state.orders || [];
      const i = list.findIndex((x) => x && x.id === o.id);
      if (i >= 0) {
        const local = list[i];
        const merged = Object.assign({}, local, o);
        const lt = local?.etrn?.tituls;
        const rt = merged?.etrn?.tituls;
        if (lt && rt) {
          merged.etrn = { ...merged.etrn, tituls: { ...rt } };
          for (const k of ['t1', 't2', 't3', 't4']) {
            if (lt[k] === 'signed') merged.etrn.tituls[k] = 'signed';
          }
        }
        list[i] = merged;
      } else list.unshift(o);
      state.orders = list;
    }, { o: order, sid: ARMADA_SPACE })
    .catch(() => {});
}

async function adminSignTitul(page, orderId, titul) {
  const remote = sshFetchOrder(orderId);
  if (remote) await mergeOrderBillingIntoPage(page, remote);
  console.log(`G-STAGING sign ${titul} (подпись имитирована, stub Контур)`);
  await page
    .evaluate(
      async ({ orderId: oid, titul: t }) => {
        window.confirm = () => true;
        window.armadaConfirm = async () => true;
        if (typeof signEtrnTitulSandboxAuto === 'function') signEtrnTitulSandboxAuto(oid, t, 'admin');
        else if (typeof signEtrnTitul === 'function') signEtrnTitul(oid, t, 'admin');
        if (typeof persistAdminOrderImmediate === 'function') {
          await persistAdminOrderImmediate(oid, { isNew: false });
        }
      },
      { orderId, titul },
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
}

async function loginDriver(page, phone, pin, driverName) {
  await page.goto(`${BASE}/v/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#drv-login-phone', phone);
  await page.click('#drv-login-phone-ok');
  await page.waitForTimeout(1500);
  if (await page.locator('#drv-login-pin-wrap').isVisible().catch(() => false)) {
    await page.fill('#drv-login-pin', pin);
    await page.click('#drv-login-ok');
  }
  await page.waitForTimeout(8000);
  return await page.locator('#driver.show, #driver-home').isVisible().catch(() => false);
}

async function main() {
  if (!LOGIST_PIN) {
    record('env', '❌', 'нет STAGING_SUPER_PIN');
    process.exit(2);
  }
  const secrets = loadSecrets();
  if (!secrets?.portal_phone) {
    record('env', '❌', 'нет /tmp/g-etrn-qa-secrets.json');
    process.exit(2);
  }

  const baseline = sshEntityCounts();
  if (!baseline) {
    record('baseline', '❌', 'ssh counts failed');
    process.exit(1);
  }
  record('baseline', '✅', JSON.stringify(baseline));
  const backed = sshBackupBeforeWrite();
  record('backup', backed ? '✅' : '❌', backed ? 'PB backup /root/backup-staging-g7-*' : 'ssh backup failed');

  if (!sshBillingEtrnEnabled()) {
    const pre = sshPatchBillingEtrn(ARMADA_SPACE);
    record('prep-billing-pb', pre.ok ? '✅' : '❌', `etrn=${pre.etrn} epoch=${pre.epoch || '?'}`);
  }

  const pwPaths = [
    'playwright',
    '/tmp/pw-etern/node_modules/playwright/index.mjs',
    path.join(ROOT, 'node_modules', 'playwright', 'index.mjs'),
  ];
  let playwright;
  for (const p of pwPaths) {
    try {
      playwright = await import(p);
      break;
    } catch {
      /* next */
    }
  }
  if (!playwright?.chromium) {
    record('playwright', '❌', 'missing (npm install playwright)');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: [
      '--host-resolver-rules=MAP staging.app.armada.sx 127.0.0.1:9443',
      '--ignore-certificate-errors',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
    ],
  });

  const slug = secrets.portal_slug || secrets.space_portal_slug || 'pb713867e';
  const custPhone = secrets.portal_phone;
  const custPin = secrets.portal_pin;
  const drvPhone = QA_DRIVER_PHONE.replace(/\D/g, '').replace(/^8/, '7').replace(/^7/, '') || secrets.driver_phone;
  const drvPhoneNorm = drvPhone.length === 10 ? `7${drvPhone}` : drvPhone;
  const drvPin = sshResolveDriverPin(drvPhoneNorm) || String(QA_DRIVER_PHONE).replace(/\D/g, '').slice(-4);
  if (!drvPin) {
    record('env', '❌', 'PIN водителя не найден в БД');
    process.exit(2);
  }

  let orderId = null;
  let externalId = null;
  let g1ok = false;
  let g4ok = false;
  let g2ok = false;
  let g3ok = false;
  let g6ok = false;

  const h = curlJson(`${API}/health`);
  let g5fact = 'health недоступен';
  let g5ok = false;
  try {
    const hj = JSON.parse(h.stdout);
    g5fact = `configured=${hj.epd?.configured} operator=${hj.epd?.operator || '?'}`;
    g5ok = !hj.epd?.configured || hj.epd?.operator === 'stub';
  } catch {
    g5fact = 'parse health';
  }
  stepG('G5', g5ok, g5fact);

  try {
    const logistCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    await logistCtx.addInitScript(() => {
      try {
        localStorage.removeItem('armada_app_v5');
        localStorage.removeItem('armada_admin_session');
      } catch (_) {}
    });
    const logistPage = await logistCtx.newPage();
    watchAdminOrder409(logistPage);
    if (!(await adminLogin(logistPage, LOGIST_PIN))) {
      record('prep-login', '❌', 'логист/супер');
      throw new Error('login');
    }
    const etrnPrep = await enableArmadaEtrn(logistPage);
    record(
      'prep-etrn',
      etrnPrep.ok ? '✅' : '❌',
      etrnPrep.ok ? etrnPrep.fact || 'etrnEnabled Армада' : etrnPrep.fact || 'etrn не включён',
    );

    let custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    let custPage = await custCtx.newPage();
    if (!(await loginCustomerPortal(custPage, slug, custPhone, custPin))) {
      stepG('G4', false, 'вход заказчика /z');
      throw new Error('cust');
    }
    const created = await submitCustomerOrderForm(custPage, {
      mark: MARK,
      shipperDiff: true,
      custPhone,
      custPin,
    });
    if (!created?.id) {
      const pushFail = results.find((x) => x.id === 'cust-push');
      const msg409 = order409Log.length
        ? `409: ${JSON.stringify(order409Log[0])}`
        : created?.formErr || pushFail?.fact || 'заказ не создан (нет id в БД)';
      stepG('G4', false, msg409);
      throw new Error('order');
    }
    orderId = created.id;

    const shiftPrep = sshEnsureDriverShiftEto(QA_DRIVER_NAME, QA_VEHICLE_PLATE);
    record('prep-shift', shiftPrep.ok ? '✅' : '❌', shiftPrep.ok ? `смена+ЕТО ${shiftPrep.shiftId || ''}` : 'PB shift');

    const hasCustT1 = await custPage.locator('.cust-etrn-t1-sign').count();
    g4ok = hasCustT1 === 0;
    stepG(
      'G4',
      g4ok,
      g4ok
        ? `ГО≠заказчик: кнопок T1 в /z нет; заказ ${orderId.slice(0, 8)}…`
        : `лишние cust-etrn-t1-sign: ${hasCustT1}`,
    );

    await custPage.close().catch(() => {});
    await custCtx.close().catch(() => {});
    custPage = null;
    custCtx = null;

    await blockFullStatePush(logistPage);

    let asn = { ok: false, etrn: false };
    try {
      asn = await phaseTimeout('G1-assign', () => logistAssignOrder(logistPage, MARK, orderId), 110000);
    } catch (e) {
      const fact = `назначение timeout/err: ${String(e.message || e).slice(0, 100)}; billingEtrn=${sshBillingEtrnEnabled()}`;
      record('assign', '❌', fact);
      stepG('G1', false, fact);
    }
    if (order409Log.length) {
      stepG('G1', false, `409 при сохранении: ${order409Log.map((x) => x.body).join('; ').slice(0, 200)}`);
    } else if (!gSteps.G1 && (!asn.ok || !asn.etrn)) {
      const fact = `назначение/etrn: ${JSON.stringify(asn).slice(0, 160)}; billingEtrn=${sshBillingEtrnEnabled()}`;
      record('assign', '❌', fact);
      stepG('G1', false, fact);
    } else if (asn.ok && asn.etrn) {
      externalId = asn.externalId;
    }

    const g2 = await logistPage.evaluate((m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      if (!o) return null;
      return typeof orderEtrnReadyForDepart === 'function' ? orderEtrnReadyForDepart(o) : null;
    }, MARK);
    g2ok = !!g2?.ok;
    stepG('G2', g2ok, g2ok ? 'выезд со стоянки до T1 разрешён' : String(g2?.message || 'orderEtrnReadyForDepart fail'));

    const pbOrder = orderId ? sshOrderEtrn(orderId) : null;
    const t1tok = pbOrder?.etrn?.shipperSignToken || asn.token || '';
    const shipperUrl = `${BASE}/z/${slug}/?etrn-t1=${orderId}&t=${encodeURIComponent(t1tok)}`;
    const shipCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    const shipPage = await shipCtx.newPage();
    attachDialogs(shipPage);
    await shipPage.goto(shipperUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PW_LONG,
    });
    await shipPage.waitForTimeout(5000);
    const shipSign = shipPage.locator('#cust-shipper-etrn-sign, .cust-etrn-t1-sign').first();
    if (await shipSign.isVisible().catch(() => false)) {
      await shipSign.click({ timeout: PW_STEP });
      await shipPage.locator('#cust-etrn-t1-confirm').click({ timeout: PW_STEP }).catch(() => {});
    }
    console.log('G-STAGING sign t1 (подпись имитирована, stub Контур)');
    const t1Sign = await shipPage
      .evaluate(async (oid) => {
        window.armadaConfirm = async () => true;
        const link =
          typeof shipperEtrnT1TokenFromUrl === 'function' ? shipperEtrnT1TokenFromUrl() : null;
        const token = link?.token || '';
        let signed = false;
        if (typeof customerSignEtrnT1Direct === 'function') {
          signed = customerSignEtrnT1Direct(oid);
        } else if (typeof signEtrnTitulSandboxAuto === 'function') {
          signed = signEtrnTitulSandboxAuto(oid, 't1', 'shipper');
        } else if (typeof signEtrnTitul === 'function') {
          signed = signEtrnTitul(oid, 't1', 'shipper');
        }
        if (!signed) return { ok: false, err: 'sign_failed' };
        if (typeof persistShipperEtrnT1Immediate === 'function' && token) {
          const r = await persistShipperEtrnT1Immediate(oid, token);
          return { ok: !!r?.ok, err: r?.err || r?.message || '' };
        }
        return { ok: false, err: 'no_shipper_t1_persist' };
      }, orderId)
      .catch((e) => ({ ok: false, err: String(e.message || e) }));
    if (!t1Sign?.ok) {
      record('t1-persist', '❌', `shipper-t1: ${JSON.stringify(t1Sign).slice(0, 120)}`);
    }
    await waitPbTitulSigned(orderId, 't1', 20, 2000);
    await logistPage
      .evaluate(async (oid) => {
        if (typeof fetchServerState === 'function') {
          try {
            await fetchServerState(12000);
          } catch (_) {}
        }
      }, orderId)
      .catch(() => {});

    const drvCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
    const drvPage = await drvCtx.newPage();
    await loginDriver(drvPage, drvPhoneNorm.startsWith('7') ? `+${drvPhoneNorm}` : drvPhone, drvPin, '');
    await drvPage.evaluate(async (m) => {
      if (typeof fetchServerState === 'function') {
        try {
          await fetchServerState(12000);
        } catch (_) {}
      }
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      if (!o) return;
      if (typeof beginDepart === 'function' && o.departOdometer == null) beginDepart(o.id, true);
      if (typeof persistOrderAssignmentImmediate === 'function') {
        await persistOrderAssignmentImmediate(o.id).catch(() => {});
      } else if (typeof persist === 'function') persist();
    }, MARK);
    const drvOrderPb = orderId ? sshFetchOrder(orderId) : null;
    if (drvOrderPb) await mergeOrderBillingIntoPage(drvPage, drvOrderPb);
    await drvPage.waitForTimeout(3000);
    await drvPage.evaluate((m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      if (!o) return;
      o.departOdometer = (o.departOdometer ?? 1000) + 0;
      if (o.startOdometer == null) o.startOdometer = 1010;
      if (!o.arrivedAt) o.arrivedAt = new Date().toISOString();
      if (typeof upsertOrder === 'function') upsertOrder(o);
    }, MARK);
    const g3block = await drvPage.evaluate((m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      if (!o || typeof startLeaveLoading !== 'function') {
        return { blocked: false, err: 'no_order_or_fn' };
      }
      const gate =
        typeof orderEtrnReadyForLeaveLoading === 'function' ? orderEtrnReadyForLeaveLoading(o) : null;
      const mandatory =
        typeof orderEtrnRequiredForTrip === 'function' ? orderEtrnRequiredForTrip(o) : null;
      state.error = '';
      startLeaveLoading(o.id);
      const err = state.error || '';
      const blocked = !!(gate && !gate.ok) || /T1|T2|ЭТрН/i.test(err);
      return {
        blocked,
        err: err.slice(0, 80) || (gate && !gate.ok ? gate.message : ''),
        hasEtrn: !!o.etrn,
        mandatory,
      };
    }, MARK);
    g3ok = !!g3block.blocked;
    stepG(
      'G3',
      g3ok,
      g3ok
        ? `блок выезда с погрузки: ${g3block.err}`
        : `startLeaveLoading не заблокировал (etrn=${g3block.hasEtrn}, mandatory=${g3block.mandatory})`,
    );

    const qrBeforeT2 = await logistPage.evaluate((m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      return o && typeof orderEtrnQrAllowed === 'function' ? orderEtrnQrAllowed(o) : null;
    }, MARK);
    record(
      'G-QR-preT2',
      qrBeforeT2 ? '❌' : '✅',
      qrBeforeT2 ? 'QR до T2 не должен быть доступен' : 'QR до T2=false',
    );

    await waitPbTitulSigned(orderId, 't1', 5, 1000);
    await phaseTimeout('postG3-t2', async () => {
      await adminSignTitul(logistPage, orderId, 't2');
    });
    await waitPbTitulSigned(orderId, 't2', 15, 2000);
    const qrOk = await logistPage.evaluate((m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      return o && typeof orderEtrnQrAllowed === 'function' ? orderEtrnQrAllowed(o) : false;
    }, MARK);

    await phaseTimeout('postG3-leave', async () => {
      await drvPage.evaluate((m) => {
        const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
        if (!o || typeof startLeaveLoading !== 'function') return;
        state.error = '';
        startLeaveLoading(o.id);
        if (typeof persist === 'function') persist();
      }, MARK);
    });

    custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    custPage = await custCtx.newPage();
    await loginCustomerPortal(custPage, slug, custPhone, custPin);

    await phaseTimeout('postG3-t3-t4', async () => {
      console.log('G-STAGING sign t3 (подпись имитирована, stub Контур)');
      await custPage
        .evaluate(async (oid) => {
          window.armadaConfirm = async () => true;
          if (typeof signEtrnTitulSandboxAuto === 'function') signEtrnTitulSandboxAuto(oid, 't3', 'customer');
          else if (typeof signEtrnTitul === 'function') signEtrnTitul(oid, 't3', 'customer');
          if (typeof persistCustomerPortalOrderImmediate === 'function') {
            await persistCustomerPortalOrderImmediate(oid);
          }
        }, orderId)
        .catch(() => {});
      await custPage.waitForTimeout(1500);
      await adminSignTitul(logistPage, orderId, 't4');
    });

    const fin = orderId ? sshOrderEtrn(orderId) : null;
    const tituls = fin?.etrn?.tituls || {};
    g1ok = ['t1', 't2', 't3', 't4'].every((k) => tituls[k] === 'signed');
    stepG(
      'G1',
      g1ok,
      g1ok
        ? `T1→T4 signed, QR после T1=${qrOk}`
        : `tituls=${JSON.stringify(tituls)} QR=${qrOk}`,
    );

    const wh = curlJson(`${API}/epd/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: externalId,
        titul: 't3',
        status: 'signed',
      }),
    });
    let whOk = false;
    try {
      const parsed = JSON.parse(wh.stdout);
      whOk = parsed.ok === true;
    } catch {
      whOk = false;
    }
    await new Promise((r) => setTimeout(r, 3000));
    const pbAfter = orderId ? sshOrderEtrn(orderId) : null;
    g6ok = whOk;
    stepG(
      'G6',
      g6ok,
      g6ok
        ? `webhook ok; pb t3=${pbAfter?.etrn?.tituls?.t3 || '?'}`
        : `webhook fail: ${wh.stdout.slice(0, 120)}`,
    );

    const cancelOut = await logistPage.evaluate(async (m) => {
      const o = (state.orders || []).find((x) => JSON.stringify(x).includes(m));
      if (!o || typeof cancelOrder !== 'function') return { ok: false, err: 'no_cancel' };
      if (!cancelOrder(o.id, 'перепроверка QA')) return { ok: false, err: 'cancel_fn' };
      if (typeof persistAdminOrderImmediate === 'function') {
        const r = await persistAdminOrderImmediate(o.id, { isNew: false });
        return { ok: !!(r && r.ok), status: r?.status, message: r?.message };
      }
      return { ok: false, err: 'no_persistAdminOrderImmediate' };
    }, MARK);
    if (order409Log.length && !cancelOut.ok) {
      record('cleanup', '❌', `409 отмена: ${order409Log.at(-1)?.body?.slice(0, 120)}`);
    } else {
      record('cleanup', cancelOut.ok ? '✅' : '❌', 'отмена «перепроверка QA»');
    }
  } catch (e) {
    const msg = String(e.message || e).slice(0, 100);
    record('fatal', '❌', msg);
    if (/timeout:postG3/i.test(msg) && gSteps.G3?.status === '❌') {
      record('postG3', '❌', msg);
    }
    if (!gSteps.G2) stepG('G2', false, 'не выполнен');
    if (!gSteps.G3) stepG('G3', false, 'не выполнен');
    if (!gSteps.G4) stepG('G4', false, String(e.message || e).slice(0, 80));
    if (!gSteps.G1) stepG('G1', false, 'не выполнен');
    if (!gSteps.G6) stepG('G6', false, 'не выполнен');
  } finally {
    await browser.close();
  }

  const after = sshEntityCounts();
  if (after) {
    const keys = ['admins', 'customers', 'drivers', 'vehicles'];
    const shrunk = keys.some((k) => (after[k] ?? 0) < (baseline[k] ?? 0));
    record(
      'entities',
      shrunk ? '❌' : '✅',
      shrunk ? `было ${JSON.stringify(baseline)} стало ${JSON.stringify(after)}` : JSON.stringify(after),
    );
    if (shrunk) process.exitCode = 3;
  }

  const outPath = path.join(ROOT, 'web-preview/test/g-etrn-staging-write-results.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ mark: MARK, orderId, gSteps, order409Log, results }, null, 2),
  );
  console.log('Wrote', outPath);
  const gIds = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
  const gFailed = gIds.some((id) => gSteps[id]?.status === '❌');
  console.log(
    'ИТОГ:',
    gFailed ? '❌ есть провалы G1–G6' : '✅ G1–G6 пройдены (staging write)',
  );
  process.exit(gFailed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
