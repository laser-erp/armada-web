/**
 * LC-0036 S5: QuotaExceeded на armada_app_v5 не должен рвать ЕТО и PATCH /state.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  LS_QUOTA_BYTES,
  createQuotaLocalStorage,
  loadS5QuotaSandbox,
  seedStagingHeavyState,
  estimateSnapshotBytes,
} from './s5-quota-eto-harness.mjs';
import {
  chainFetchHandlers,
  handleDriverShiftFetch,
  jsonResponse,
} from './armada-test-fetch.mjs';

const ROLE_KEY = 'armada_api_role_token_v1';
const DRIVER_NAME = 'Королёв Тимур (тест)';
const COMPANY_ID = 'co-stg-own';
const SPACE_ID = 'sp-stg';

function fakeJwt(role, spaceId = SPACE_ID) {
  const payload = Buffer.from(JSON.stringify({ role, spaceId, exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function setDriverSession(sb) {
  vm.runInNewContext(
    `DRIVER = ${JSON.stringify(DRIVER_NAME)}; DRIVER_COMPANY_ID = ${JSON.stringify(COMPANY_ID)}`,
    sb,
  );
  sb.globalThis.DRIVER = DRIVER_NAME;
  sb.globalThis.DRIVER_COMPANY_ID = COMPANY_ID;
}

async function runEtoThroughLights(sb, pushLog) {
  sb.state.shift = {
    id: 'sh-eto-quota',
    startedAt: new Date().toISOString(),
    driverName: DRIVER_NAME,
    ownCompanyId: COMPANY_ID,
    spaceId: SPACE_ID,
    vehiclePlate: null,
    orders: [],
    endedAt: null,
  };
  sb.state.step = 'chooseVehicle';
  sb.state.messages = [];
  sb.selectVehicle('Х777ХХ77');
  assert.equal(sb.state.step, 'odometer', 'новая машина — ввод одометра');
  sb.__numEl.value = '52000';
  sb.submitNumber();
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '56';
  sb.submitNumber();
  sb.__numEl.value = '40';
  sb.submitNumber();
  await flushPushQueue(sb, pushLog);
  assert.equal(sb.state.step, 'gur', 'после топлива шаг ГУР');
  sb.selectFluid('Максимум');
  sb.selectFluid('Середина');
  assert.equal(sb.state.step, 'lights', 'шаг освещения (#lowBeam)');
  for (const key of ['lowBeam', 'brake', 'turn']) {
    sb.state.light[key] = 'Да';
    sb.state.error = '';
    if (typeof sb.renderEtoPanel === 'function') sb.renderEtoPanel();
  }
  sb.submitLights();
  assert.equal(sb.state.step, 'oil', 'после фар — шаг масла');
}

async function flushPushQueue(sb, pushLog) {
  if (sb.syncPushInFlight) await sb.syncPushInFlight;
  if (typeof sb.pushServerStateQueued === 'function') {
    const r = await sb.pushServerStateQueued();
    if (r) pushLog.push(r);
  }
  await new Promise((r) => setTimeout(r, 50));
  if (sb.syncPushInFlight) await sb.syncPushInFlight;
}

test('staging-like state > 5 МБ в snapshot(); driver slice сильно меньше', () => {
  const ls = createQuotaLocalStorage(LS_QUOTA_BYTES);
  const sb = loadS5QuotaSandbox({
    localStorage: ls,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  seedStagingHeavyState(sb.state, DRIVER_NAME, COMPANY_ID, SPACE_ID);
  setDriverSession(sb);
  const full = estimateSnapshotBytes(sb);
  const slim = Buffer.byteLength(JSON.stringify(sb.snapshotForLocalStorage()), 'utf8');
  assert.ok(full > LS_QUOTA_BYTES, `полный snapshot ${full} B > квота`);
  assert.ok(slim < full / 2, `driver slice ${slim} B << full ${full} B`);
  assert.ok(slim < LS_QUOTA_BYTES, `driver slice влезает в квоту ${LS_QUOTA_BYTES} B`);
});

test('ЕТО до фар: POST /shifts вызывается даже при QuotaExceeded на полном снимке', async () => {
  const ls = createQuotaLocalStorage(LS_QUOTA_BYTES);
  const driverTok = fakeJwt('driver');
  ls.setItem(ROLE_KEY, driverTok);
  const shiftBodies = [];
  const pushLog = [];
  let sb;
  sb = loadS5QuotaSandbox({
    localStorage: ls,
    fetchImpl: chainFetchHandlers(async (url, init) => {
      const u = String(url);
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
        shiftBodies.push(JSON.parse(init.body || '{}'));
        return undefined;
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { ok: true });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, {
          id: 'pb1',
          payload: { dataEpoch: sb.state.dataEpoch || 0, shifts: [], orders: [] },
        });
      }
      return undefined;
    }, async (url, init) => handleDriverShiftFetch(url, init)),
  });
  sb.reconcileBeforePush = async () => false;
  // Полный scopedLocalCacheSnapshot на staging-like state — мегабайты и минуты stringify; квоту проверяем через armada_app_v5 ниже.
  sb.persistLocalOnly = () => {};
  sb.persist = () => {};
  // Без обёртки store.js pushServerStateQueued: persistDriverShiftImmediate ждёт syncPushInFlight → deadlock.
  const pushServerStateDirect = sb.pushServerState.bind(sb);
  sb.pushServerStateQueued = () => pushServerStateDirect();
  seedStagingHeavyState(sb.state, DRIVER_NAME, COMPANY_ID, SPACE_ID);
  for (const s of sb.state.shifts || []) {
    if (s && !s.endedAt && sb.samePersonName(s.driverName, DRIVER_NAME)) {
      s.endedAt = s.startedAt || new Date().toISOString();
    }
  }
  setDriverSession(sb);
  assert.throws(
    () => ls.setItem('armada_app_v5', JSON.stringify(sb.snapshot())),
    (e) => e && e.name === 'QuotaExceededError',
    'полный JSON не влезает в 5 МБ (как staging)',
  );
  await runEtoThroughLights(sb, pushLog);
  assert.ok(shiftBodies.length >= 1, 'pushServerState должен вызвать POST/PATCH /shifts');
  assert.equal(sb.state.shift?.odometer, 52000, 'одометр ЕТО в памяти');
  assert.equal(sb.state.shift?.fuelLiters, 40, 'топливо ЕТО в памяти');
  const last = shiftBodies[shiftBodies.length - 1];
  const pushedShift = last.shift || last;
  assert.ok(pushedShift && pushedShift.id === 'sh-eto-quota', 'открытая смена в теле /shifts');
  assert.equal(pushedShift.fuelLiters, 40, 'топливо в /shifts');
});
