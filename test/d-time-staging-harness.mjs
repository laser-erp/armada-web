/**
 * Общие утилиты QA D-time на staging (туннель 9443, SSH readonly).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const BASE = 'https://staging.app.armada.sx';
/** Локальный forward на staging :443 (9443 в облаке иногда без TLS). */
let _hostRules = 'MAP staging.app.armada.sx 127.0.0.1:9443';

export function hostRules() {
  return _hostRules;
}

export async function resolvePlaywrightTunnel() {
  const { spawnSync: sp } = await import('node:child_process');
  for (const port of [9443, 9445]) {
    if (!(await portOpen('127.0.0.1', port))) continue;
    const r = sp(
      'curl',
      [
        '-sk',
        '--connect-timeout',
        '4',
        '--resolve',
        `staging.app.armada.sx:${port}:127.0.0.1`,
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        `https://staging.app.armada.sx:${port}/`,
      ],
      { encoding: 'utf8' },
    );
    if (String(r.stdout || '').trim() === '200') {
      _hostRules = `MAP staging.app.armada.sx 127.0.0.1:${port}`;
      return { ok: true, port };
    }
  }
  if (await portOpen('127.0.0.1', 9443)) return { ok: true, port: 9443, warn: 'https_probe_failed' };
  return { ok: false, error: 'нет рабочего HTTPS-туннеля (9443/9445)' };
}
export const SSH_HOST = process.env.SSH_HOST || '176.12.67.35';
export const SSH_KEY = process.env.SSH_KEY || path.join(os.homedir(), '.ssh', 'armada_staging');
export const ARMADA_SPACE = 'b713867e-1c60-4391-bf27-8262c1206e11';
export const SUPER_INN = process.env.STAGING_LOGIST_INN || '7802655283';
export const PORTAL_SLUG = process.env.D_TIME_PORTAL_SLUG || 'pb713867e';

export function portOpen(host, port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port }, () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.setTimeout(1500, () => {
      s.destroy();
      resolve(false);
    });
  });
}

export async function ensureTunnel() {
  if (await portOpen('127.0.0.1', 9443)) return { ok: true };
  if (!fs.existsSync(SSH_KEY)) return { ok: false, error: 'нет ключа SSH и туннель 9443 не слушает' };
  const r = spawnSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-f',
      '-N',
      '-L',
      '127.0.0.1:9443:127.0.0.1:443',
      `root@${SSH_HOST}`,
    ],
    { stdio: 'ignore' },
  );
  if (r.status !== 0) return { ok: false, error: `ssh tunnel exit ${r.status}` };
  await new Promise((r) => setTimeout(r, 800));
  return (await portOpen('127.0.0.1', 9443)) ? { ok: true } : { ok: false, error: 'туннель не поднялся' };
}

export function sshPy(pythonBody, readonly = true) {
  if (!fs.existsSync(SSH_KEY)) return { error: 'no_ssh_key' };
  const inner = `timeout 55 python3 - <<'PY'\n${pythonBody}\nPY`;
  const r = spawnSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-i', SSH_KEY, `root@${SSH_HOST}`, inner],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (r.status !== 0) return { error: (r.stderr || r.stdout || 'ssh failed').trim().slice(0, 400) };
  const line = (r.stdout || '').split('\n').filter((l) => l.startsWith('JSON=')).pop();
  if (!line) return { error: 'no_json', raw: (r.stdout || '').slice(0, 300) };
  try {
    return { data: JSON.parse(line.slice(5)) };
  } catch {
    return { error: 'json_parse' };
  }
}

export function entityCountsPy() {
  return `
import json, sqlite3
db=sqlite3.connect("file:/opt/pocketbase-staging/pb_data/data.db?mode=ro", uri=True)
p=json.loads(db.execute('select payload from app_state where key="main" limit 1').fetchone()[0])
counts={k:len(p.get(k) or []) for k in ("admins","customers","drivers","vehicles","orders")}
print("JSON="+json.dumps({"counts":counts}, ensure_ascii=False))
`;
}

export function ordersByMarkPy(mark) {
  const m = JSON.stringify(mark);
  return `
import json, sqlite3
mark=${m}
db=sqlite3.connect("file:/opt/pocketbase-staging/pb_data/data.db?mode=ro", uri=True)
p=json.loads(db.execute('select payload from app_state where key="main" limit 1').fetchone()[0])
orders=[]
for o in p.get("orders") or []:
    if not o: continue
    blob=json.dumps(o, ensure_ascii=False)
    if mark in blob or mark in (o.get("cargoDescription") or ""):
        orders.append({
            "id": o.get("id"),
            "seq": o.get("sequentialNumber"),
            "bookStatus": o.get("bookStatus"),
            "bookedPlate": o.get("bookedPlate"),
            "vehicleAt": o.get("vehicleAt"),
            "emptyKmBefore": o.get("emptyKmBefore"),
            "emptyKmAfter": o.get("emptyKmAfter"),
            "linkEmptyAfterToNext": o.get("linkEmptyAfterToNext"),
            "emptyAfterLinkedFromNext": o.get("emptyAfterLinkedFromNext"),
            "timeTotalHours": o.get("timeTotalHours"),
            "closedAt": o.get("closedAt"),
            "cancelledAt": o.get("cancelledAt"),
        })
print("JSON="+json.dumps({"orders":orders}, ensure_ascii=False))
`;
}

async function waitAppReady(page, fnName, ms = 90000) {
  const step = 1000;
  const n = Math.ceil(ms / step);
  for (let i = 0; i < n; i++) {
    const ready = await page.evaluate((name) => typeof globalThis[name] === 'function', fnName).catch(() => false);
    if (ready) return true;
    await page.waitForTimeout(step);
  }
  return false;
}

export async function loginSuper(page, pin) {
  await page.goto(`${BASE}/a/`, { timeout: 120000, waitUntil: 'load' });
  await page.waitForSelector('#admin-login-inn', { timeout: 90000 }).catch(() => {});
  if (!(await waitAppReady(page, 'loginAdmin'))) throw new Error('loginAdmin не загрузился');
  const ok = await page.evaluate(
    async ({ inn, pin }) => {
      const variants = [String(inn || '').trim(), String(inn || '').replace(/\D/g, '')];
      const seen = new Set();
      for (const loginVal of variants) {
        if (!loginVal || seen.has(loginVal)) continue;
        seen.add(loginVal);
        const innEl = document.getElementById('admin-login-inn');
        const pi = document.getElementById('pin-input');
        if (!innEl || !pi || typeof loginAdmin !== 'function') return false;
        innEl.value = loginVal;
        pi.value = String(pin || '').trim();
        await loginAdmin();
        await new Promise((r) => setTimeout(r, 4500));
        if (typeof currentAdmin !== 'undefined' && currentAdmin) return true;
      }
      return !!(typeof currentAdmin !== 'undefined' && currentAdmin);
    },
    { inn: SUPER_INN, pin },
  );
  if (!ok) {
    await page.waitForSelector('#admin.show', { timeout: 60000 }).catch(() => {});
  }
  if (!(await page.locator('#admin.show').isVisible().catch(() => false))) {
    throw new Error('вход логиста не удался (#admin не visible)');
  }
}

export async function loginCustomerPortal(page, phone, pin) {
  await page.goto(`${BASE}/z/${PORTAL_SLUG}/`, { timeout: 120000, waitUntil: 'load' });
  await page.waitForSelector('#cust-login-phone', { timeout: 60000 });
  if (!(await waitAppReady(page, 'loginCustomer'))) throw new Error('loginCustomer не загрузился');
  const ok = await page.evaluate(
    async ({ phone, pin }) => {
      if (typeof initPortalScopeFromPage === 'function') initPortalScopeFromPage();
      if (typeof initCloudSync === 'function') {
        try {
          await initCloudSync();
        } catch (_) {}
      }
      await new Promise((r) => setTimeout(r, 1500));
      const ph = document.getElementById('cust-login-phone');
      const pi = document.getElementById('cust-login-pin');
      if (!ph || !pi || typeof loginCustomer !== 'function') return false;
      ph.value = String(phone || '').trim();
      pi.value = String(pin || '').trim();
      await loginCustomer();
      await new Promise((r) => setTimeout(r, 5000));
      return !!document.querySelector('#customer-portal.show');
    },
    { phone, pin },
  );
  if (!ok) throw new Error('вход заказчика не удался');
  await page.waitForSelector('#customer-portal.show', { timeout: 60000 });
}

async function dismissDriverOnboarding(page) {
  await page
    .evaluate(() => {
      try {
        localStorage.setItem('armada_onboard_driver_v1', '1');
      } catch (_) {}
      document.querySelectorAll('.onboard-tooltip').forEach((el) => el.remove());
    })
    .catch(() => {});
}

export async function loginDriver(page, phone, pin) {
  const TIMEOUT = 120000;
  await page.goto(`${BASE}/v/`, { waitUntil: 'commit', timeout: TIMEOUT });
  await dismissDriverOnboarding(page);
  await page.waitForSelector('#drv-login-phone', { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT }).catch(() => {});
  for (let i = 0; i < 15; i++) {
    const t = await page
      .evaluate(() => typeof globalThis.doLoginDriverPin === 'function' && typeof tryDriverPhoneLogin === 'function')
      .catch(() => false);
    if (t) break;
    await page.waitForTimeout(1500);
  }
  await page
    .evaluate(async () => {
      if (typeof fetchServerState === 'function') await fetchServerState(60000);
      for (let i = 0; i < 10; i++) {
        const n = (typeof state !== 'undefined' && state.drivers ? state.drivers.length : 0) || 0;
        if (n > 0) break;
        await new Promise((r) => setTimeout(r, 1500));
        if (typeof fetchServerState === 'function') await fetchServerState(30000).catch(() => {});
      }
    })
    .catch(() => {});
  const pinStep = await page.evaluate(async (phoneVal) => {
    const ph = document.getElementById('drv-login-phone');
    const errEl = document.getElementById('drv-login-error');
    const showErr = (m) => {
      if (errEl) errEl.textContent = m;
    };
    if (!ph || typeof tryDriverPhoneLogin !== 'function') return { ok: false, reason: 'no_fn' };
    const dial = typeof formatPhone === 'function' ? formatPhone(phoneVal) : phoneVal;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (typeof fetchServerState === 'function') await fetchServerState(45000).catch(() => {});
      if (typeof syncDriversCatalogForLogin === 'function') await syncDriversCatalogForLogin(showErr).catch(() => {});
      ph.value = dial;
      await tryDriverPhoneLogin(dial, showErr);
      await new Promise((r) => setTimeout(r, 2500));
      const wrap = document.getElementById('drv-login-pin-wrap');
      if (wrap && wrap.style.display !== 'none') return { ok: true };
    }
    return { ok: false, err: errEl?.textContent || 'phone_step' };
  }, String(phone || '').trim());
  if (!pinStep.ok) throw new Error(`вход водителя: телефон (${pinStep.err || pinStep.reason || 'fail'})`);
  const logged = await page.evaluate(async (pinVal) => {
    const pinEl = document.getElementById('drv-login-pin');
    const errEl = document.getElementById('drv-login-error');
    const showErr = (m) => {
      if (errEl) errEl.textContent = m;
    };
    if (!pinEl) return { ok: false, reason: 'no_pin_el' };
    pinEl.value = String(pinVal || '').trim();
    if (typeof doLoginDriverPin === 'function') await doLoginDriverPin(showErr);
    else if (typeof loginDriver === 'function') loginDriver();
    else document.getElementById('drv-login-ok')?.click();
    await new Promise((r) => setTimeout(r, 8000));
    return { ok: !!document.querySelector('#driver.show'), err: errEl?.textContent || '' };
  }, pin);
  if (!logged.ok) throw new Error(`вход водителя: PIN (${logged.err || logged.reason || 'fail'})`);
  await page.waitForSelector('#driver.show', { timeout: TIMEOUT });
  await page.locator('#btn-eto').click({ timeout: TIMEOUT }).catch(() => {});
  await page.waitForSelector('#eto-panel.show', { timeout: TIMEOUT }).catch(() => {});
}

export function chromiumArgs() {
  return ['--ignore-certificate-errors', `--host-resolver-rules=${hostRules()}`];
}

const API_TUNNEL = () => {
  const portMatch = /127\.0\.0\.1:(\d+)/.exec(hostRules());
  const port = portMatch ? portMatch[1] : '9443';
  return `https://staging.app.armada.sx:${port}/armada-api`;
};

export function adminApiToken(pin) {
  const portMatch = /127\.0\.0\.1:(\d+)/.exec(hostRules());
  const port = portMatch ? portMatch[1] : '9443';
  const r = spawnSync(
    'curl',
    [
      '-sk',
      '--max-time',
      '120',
      '--resolve',
      `staging.app.armada.sx:${port}:127.0.0.1`,
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      JSON.stringify({ login: SUPER_INN, pin: String(pin || '').trim() }),
      `${API_TUNNEL()}/auth/verify-admin`,
      '-w',
      '\n%{http_code}',
    ],
    { encoding: 'utf8', timeout: 130000 },
  );
  const raw = (r.stdout || '').trim();
  const code = parseInt(raw.split('\n').pop(), 10) || 0;
  if (code !== 200) return '';
  const body = raw.split('\n').slice(0, -1).join('\n');
  const m = body.match(/"token"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  try {
    const json = JSON.parse(body || '{}');
    return json?.token || '';
  } catch {
    return '';
  }
}

export function apiCurlJson(method, urlPath, body, token) {
  const portMatch = /127\.0\.0\.1:(\d+)/.exec(hostRules());
  const port = portMatch ? portMatch[1] : '9443';
  const headers = ['-H', 'Content-Type: application/json'];
  if (token) headers.push('-H', `Authorization: Bearer ${token}`);
  const args = [
    '-sk',
    '--max-time',
    '120',
    '--resolve',
    `staging.app.armada.sx:${port}:127.0.0.1`,
    '-X',
    method,
    ...headers,
    '-w',
    '\n%{http_code}',
  ];
  const url = `${API_TUNNEL()}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
  let tmp = null;
  if (body != null) {
    tmp = path.join(os.tmpdir(), `d-time-api-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(body));
    args.push('--data-binary', `@${tmp}`);
  }
  args.push(url);
  const r = spawnSync('curl', args, { encoding: 'utf8', timeout: 130000, maxBuffer: 8 * 1024 * 1024 });
  if (tmp) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
  const raw = (r.stdout || '').trim();
  const lines = raw.split('\n');
  const status = parseInt(lines.pop(), 10) || 0;
  const text = lines.join('\n');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status, json, text: text.slice(0, 800) };
}

/** PIN водителя: перебор кандидатов через verify-driver (hash в PB, PIN не логируем). */
export function resolveDriverPinFromDb(
  driverPhone = process.env.STAGING_DRIVER_PHONE || '+79009009001',
  driverId = '7bcd4f62-418c-47c1-9de0-32c2f54e5b80',
) {
  const py = `
import json,sqlite3
driver_id=${JSON.stringify(driverId)}
conn=sqlite3.connect("file:/opt/pocketbase-staging/pb_data/data.db?mode=ro", uri=True)
p=json.loads(conn.execute('select payload from app_state where key="main" limit 1').fetchone()[0])
h=(p.get("tenantMeta") or {}).get("pinHashes",{}).get("drivers",{}).get("id:"+driver_id)
print("JSON="+json.dumps({"ok":bool(h)}))
`;
  const has = sshPy(py);
  if (!has.data?.ok) return '';
  const portMatch = /127\.0\.0\.1:(\d+)/.exec(hostRules());
  const port = portMatch ? portMatch[1] : '9445';
  const candidates = ['9001', '1111', '2222', '111111'];
  for (const pin of candidates) {
    const r = spawnSync(
      'curl',
      [
        '-sk',
        '--max-time',
        '20',
        '--resolve',
        `staging.app.armada.sx:${port}:127.0.0.1`,
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-d',
        JSON.stringify({ phone: driverPhone, pin }),
        `https://staging.app.armada.sx:${port}/armada-api/auth/verify-driver`,
        '-w',
        '\n%{http_code}',
      ],
      { encoding: 'utf8', timeout: 25000 },
    );
    const raw = (r.stdout || '').trim();
    const code = parseInt(raw.split('\n').pop(), 10) || 0;
    if (code === 200) return pin;
  }
  return '';
}
