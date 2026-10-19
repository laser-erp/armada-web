#!/usr/bin/env node
/** F0.6 staging: оба варианта заправки в реальном UI + сверка с логистом. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { stagingLogistLoginFromEnv } from './staging-logist-login.mjs';

const BASE = 'https://staging.app.armada.sx';
const HOST_RULES = 'MAP staging.app.armada.sx 127.0.0.1:9443';
const TIMEOUT = 120000;
const DRIVER_PHONE = '79000000001';
const PLATE = 'О 535 МВ 198';
const SSH = ['ssh', '-S', '/tmp/armada-staging.ctl', '-o', 'BatchMode=yes', 'root@176.12.67.35'];

function step(code, ok, detail) {
  console.log(ok ? `ШАГ ${code}: готово` : `ШАГ ${code}: ошибка, ${detail}`);
}

function resolveDriverPin() {
  for (const pin of ['0001', '1111', '9001']) {
    const r = spawnSync(
      'curl',
      [
        '-sk',
        '--max-time',
        '20',
        '--resolve',
        'staging.app.armada.sx:9443:127.0.0.1',
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-d',
        JSON.stringify({ phone: DRIVER_PHONE, pin }),
        `${BASE}:9443/armada-api/auth/verify-driver`,
        '-w',
        '\n%{http_code}',
      ],
      { encoding: 'utf8', timeout: 25000 },
    );
    const code = parseInt((r.stdout || '').trim().split('\n').pop(), 10) || 0;
    if (code === 200) return pin;
  }
  return '';
}

function shiftFuelFromDb(shiftId) {
  const py = `
import json,sqlite3
sid=${JSON.stringify(shiftId)}
conn=sqlite3.connect("file:/opt/pocketbase-staging/pb_data/data.db?mode=ro", uri=True)
p=json.loads(conn.execute('SELECT payload FROM app_state WHERE key="main"').fetchone()[0])
s=next((x for x in (p.get("shifts") or []) if x and x.get("id")==sid),{})
print("JSON="+json.dumps({"fuelLiters":s.get("fuelLiters"),"fuelPricePerLiter":s.get("fuelPricePerLiter"),"etoRefueled":s.get("etoRefueled")}, ensure_ascii=False))
`;
  const r = spawnSync(SSH[0], [...SSH.slice(1), `timeout 50 python3 - <<'PY'\n${py}\nPY`], { encoding: 'utf8' });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('JSON='));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(5));
  } catch {
    return null;
  }
}

async function dismissOnboarding(page) {
  await page
    .evaluate(() => {
      document.querySelectorAll('.onboard-tooltip, .onboard-overlay').forEach((el) => el.remove());
    })
    .catch(() => {});
  const next = page.locator('.onboard-tooltip button, .onboard-actions button, [data-onboard-next]');
  for (let i = 0; i < 5; i++) {
    if (!(await next.first().isVisible().catch(() => false))) break;
    await next.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page
    .evaluate(() => {
      document.querySelectorAll('.onboard-tooltip, .onboard-overlay').forEach((el) => el.remove());
    })
    .catch(() => {});
}

/** После пройденного ЕТО кнопка «Повторить» — #eto-restart-panel внутри details, не #eto-restart. */
async function clickEtoRestart(page) {
  await page.evaluate(() => {
    if (typeof armadaConfirm === 'function') {
      window.__armadaConfirmOrig = armadaConfirm;
      window.armadaConfirm = async () => true;
    }
  });
  const panelBtn = page.locator('#eto-restart-panel');
  const legacyBtn = page.locator('#eto-restart');
  const etoDone = await page.getByText(/ЕТО на сегодня пройден/i).isVisible().catch(() => false);
  if (etoDone) {
    if (!(await panelBtn.isVisible().catch(() => false))) {
      const summary = page.locator('details.eto-restart-details summary');
      if (await summary.isVisible().catch(() => false)) await summary.click({ timeout: TIMEOUT });
    }
    if (await panelBtn.isVisible().catch(() => false)) {
      await panelBtn.click({ timeout: TIMEOUT });
      await page.waitForTimeout(2000);
      return;
    }
  }
  if (await legacyBtn.isVisible().catch(() => false)) {
    await legacyBtn.click({ timeout: TIMEOUT });
    await page.waitForTimeout(2000);
  }
}

async function loginDriverPage(page, pin) {
  await page.goto(`${BASE}/v/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForSelector('#drv-login-phone', { timeout: TIMEOUT });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  });
  await page.evaluate(async () => {
    if (typeof fetchServerState === 'function') await fetchServerState(60000);
  });
  await page.fill('#drv-login-phone', '+79000000001');
  await page.click('#drv-login-phone-ok');
  await page.waitForSelector('#drv-login-pin-wrap', { state: 'visible', timeout: TIMEOUT });
  await page.fill('#drv-login-pin', pin);
  await page.click('#drv-login-ok');
  await page.waitForSelector('#driver.show', { timeout: TIMEOUT });
  await dismissOnboarding(page);
}

async function advanceToFuel(page, plate) {
  await page.locator('#btn-eto').click({ timeout: TIMEOUT });
  await page.waitForSelector('#eto-panel.show', { timeout: TIMEOUT });
  const openShiftBtn = page.getByRole('button', { name: 'Открыть смену' });
  if (await openShiftBtn.count().catch(() => 0)) {
    await openShiftBtn.first().click({ timeout: TIMEOUT });
    await page.waitForTimeout(2500);
  }
  const fuelVisible = await page.locator('#eto-fuel-yes').isVisible().catch(() => false);
  const etoDone = await page.getByText(/ЕТО на сегодня пройден/i).isVisible().catch(() => false);
  if (etoDone || (!fuelVisible && (await page.locator('#eto-restart-panel, #eto-restart').count()))) {
    await clickEtoRestart(page);
    if (await openShiftBtn.count().catch(() => 0)) {
      await openShiftBtn.first().click({ timeout: TIMEOUT }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }
  if (await page.evaluate(() => state.orderStep === 'closePrevShiftParking').catch(() => false)) {
    const odo = await page.evaluate(() => {
      const prev = state.draft?.closePrevShiftId
        ? (state.shifts || []).find((s) => s.id === state.draft.closePrevShiftId)
        : null;
      return (prev?.parkingOdometer || prev?.odometer || state.shift?.etoOdometerSuggest || 100000) + 10;
    });
    await page.locator('#num').fill(String(odo));
    await page.locator('#num-ok').click();
    await page.waitForTimeout(2000);
  }
  let plateBtn = page.locator('#eto-body button.plate').filter({ hasText: plate }).first();
  if ((await plateBtn.count().catch(() => 0)) === 0) {
    plateBtn = page.locator('#eto-body button.plate').first();
  }
  if (await plateBtn.isVisible().catch(() => false)) {
    await plateBtn.click();
    await page.waitForTimeout(1500);
  }
  const keep = page.locator('#eto-odo-keep');
  if (await keep.isVisible().catch(() => false)) {
    await keep.click();
    await page.waitForTimeout(1500);
  } else if (await page.locator('#num').isVisible().catch(() => false)) {
    const min = await page.evaluate(() => {
      const s = state.shift || {};
      return (
        (typeof driverEtoOdometerMin === 'function' ? driverEtoOdometerMin(s) : null) ??
        s.etoOdometerSuggest ??
        s.lastOdometerPoint ??
        100000
      );
    });
    await page.locator('#num').fill(String(+min + 5));
    await page.locator('#num-ok').click();
    await page.waitForTimeout(2000);
  }
  return await page.locator('#eto-fuel-yes').isVisible().catch(() => false);
}

async function finishEtoFromGur(page) {
  for (const label of ['Максимум', 'Середина']) {
    const b = page.locator('#eto-body button.fluid', { hasText: label }).first();
    if (await b.isVisible().catch(() => false)) await b.click();
    await page.waitForTimeout(400);
  }
  for (const key of ['lowBeam', 'brake', 'turn']) {
    const y = page.locator(`#eto-body button[data-key="${key}"][data-val="Да"]`);
    if (await y.isVisible().catch(() => false)) await y.click();
  }
  const lo = page.locator('#lights-ok');
  if (await lo.isVisible().catch(() => false)) {
    await lo.click();
    await page.waitForTimeout(500);
  }
  const oil = page.locator('#eto-body button.fluid', { hasText: 'Минимум' }).first();
  if (await oil.isVisible().catch(() => false)) await oil.click();
  await page.waitForTimeout(3000);
  await page
    .evaluate(async () => {
      try {
        if (typeof pushServerStateQueued === 'function') await pushServerStateQueued();
      } catch (e) {
        console.warn('push skip', e && e.message);
      }
    })
    .catch(() => {});
}

async function loginLogist(page, pin) {
  const login = stagingLogistLoginFromEnv().login;
  await page.goto(`${BASE}/a/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForSelector('#admin-login-inn', { timeout: TIMEOUT });
  await page.waitForTimeout(5000);
  return page.evaluate(
    async ({ raw, pin: p }) => {
      document.getElementById('admin-login-inn').value = raw;
      document.getElementById('pin-input').value = p;
      await loginAdmin();
      await new Promise((r) => setTimeout(r, 10000));
      return !!document.getElementById('admin')?.classList.contains('show');
    },
    { raw: login, pin },
  );
}

async function main() {
  const pin = String(process.env.STAGING_SUPER_PIN || '').trim();
  const drvPin = resolveDriverPin();
  if (!drvPin || !pin) {
    step('F0.6-browser', false, 'нет PIN водителя или логиста');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: [`--host-resolver-rules=${HOST_RULES}`, '--ignore-certificate-errors'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);

  console.log('ШАГ F0.6-browser-yes: начат');
  try {
    await loginDriverPage(page, drvPin);
    const atFuel = await advanceToFuel(page, PLATE);
    if (!atFuel) throw new Error('не дошли до шага топлива');
    await dismissOnboarding(page);
    await page.locator('#eto-fuel-yes').click({ force: true });
    await page.waitForTimeout(800);
    await page.locator('#num').fill('58.5');
    await page.locator('#num-ok').click();
    await page.waitForTimeout(800);
    await page.locator('#num').fill('33');
    await page.locator('#num-ok').click();
    await page.waitForTimeout(800);
    const uiYes = await page.evaluate(() => ({
      fuelLiters: state.shift?.fuelLiters,
      fuelPricePerLiter: state.shift?.fuelPricePerLiter,
      shiftId: state.shift?.id,
    }));
    await finishEtoFromGur(page);
    const dbYes = shiftFuelFromDb(uiYes.shiftId);
    const okYes =
      uiYes.fuelLiters === 33 &&
      Math.abs(+(uiYes.fuelPricePerLiter || 0) - 58.5) < 0.01 &&
      dbYes?.fuelLiters === 33;
    step(
      'F0.6-browser-yes',
      okYes,
      `UI л=${uiYes.fuelLiters} ц=${uiYes.fuelPricePerLiter}; PB л=${dbYes?.fuelLiters} ц=${dbYes?.fuelPricePerLiter}`,
    );

    await clickEtoRestart(page);
    await advanceToFuel(page, PLATE);

    console.log('ШАГ F0.6-browser-no: начат');
    await dismissOnboarding(page);
    await page.locator('#eto-fuel-no').click({ force: true });
    await page.waitForTimeout(1500);
    const uiNo = await page.evaluate(() => ({
      fuelLiters: state.shift?.fuelLiters,
      fuelPricePerLiter: state.shift?.fuelPricePerLiter,
      etoRefueled: state.shift?.etoRefueled,
      shiftId: state.shift?.id,
    }));
    const priceOk = Math.abs(+(uiNo.fuelPricePerLiter || 0) - 58.5) < 0.01;
    const okNo = uiNo.fuelLiters === 0 && uiNo.etoRefueled === false && priceOk;
    step(
      'F0.6-browser-no',
      okNo,
      `UI л=${uiNo.fuelLiters} ref=${uiNo.etoRefueled} ц=${uiNo.fuelPricePerLiter} (ожид. цена 58.5 с прошлой заправки)`,
    );

    const ctxL = await browser.newContext({ ignoreHTTPSErrors: true });
    const pL = await ctxL.newPage();
    if (await loginLogist(pL, pin)) {
      await pL.evaluate(async (sid) => {
        if (typeof fetchServerState === 'function') await fetchServerState(60000);
        const s = (state.shifts || []).find((x) => x && x.id === sid);
        return s
          ? { fuelLiters: s.fuelLiters, fuelPricePerLiter: s.fuelPricePerLiter }
          : null;
      }, uiNo.shiftId);
      const lf = await pL.evaluate((sid) => {
        const s = (state.shifts || []).find((x) => x && x.id === sid);
        return s ? { fuelLiters: s.fuelLiters, fuelPricePerLiter: s.fuelPricePerLiter } : null;
      }, uiNo.shiftId);
      step(
        'F0.6-logist',
        lf && lf.fuelLiters === 0 && Math.abs(+(lf.fuelPricePerLiter || 0) - 58.5) < 0.01,
        `логист смена: л=${lf?.fuelLiters} ц=${lf?.fuelPricePerLiter}`,
      );
    } else step('F0.6-logist', false, 'вход логиста');
    await ctxL.close();
  } catch (e) {
    step('F0.6-browser', false, e.message || String(e));
  }
  await browser.close();
}

main();
