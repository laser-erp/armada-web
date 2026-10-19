/**
 * F0.6: после шага топлива ЕТО push содержит fuelLiters/fuelPricePerLiter;
 * сессия водителя видна store.js через globalThis.DRIVER (как в браузере).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadF0Sandbox, seedF0World, setDriverSession } from './f0-eto-harness.mjs';
import {
  chainFetchHandlers,
  guardFetch,
  handleDriverShiftFetch,
  jsonResponse,
  patchStoreSrcForNodeTests,
} from './armada-test-fetch.mjs';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROLE_KEY = 'armada_api_role_token_v1';
const SYNC_KEY = 'armada_api_sync_token_v1';
const LEGACY_KEY = 'armada_api_token_v1';

function assertNoDriverPinInClientStorage(sb, pin) {
  const pinStr = String(pin);
  for (const bag of [sb.localStorage._, sb.sessionStorage._]) {
    for (const [k, v] of Object.entries(bag)) {
      assert.ok(!String(v).includes(pinStr), `PIN в storage: ${k}`);
      assert.ok(!/driver_login_auth|rememberDriverLogin|DRIVER_LOGIN_AUTH/i.test(k));
    }
  }
}

function fakeJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function loadStoreSandbox(fetchImpl) {
  const ev = { addEventListener() {}, removeEventListener() {} };
  const sandbox = {
    console,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Date,
    Set,
    Map,
    Promise,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    structuredClone: (o) => JSON.parse(JSON.stringify(o)),
    localStorage: {
      _: {},
      getItem(k) {
        return this._[k] ?? null;
      },
      setItem(k, v) {
        this._[k] = String(v);
      },
      removeItem(k) {
        delete this._[k];
      },
    },
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {} },
    document: {
      ...ev,
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      querySelectorAll: () => [],
      body: { style: {} },
      documentElement: { style: {} },
    },
    location: { href: 'http://localhost/v/', pathname: '/v/', hostname: 'localhost' },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    fetch: guardFetch(
      fetchImpl
        ? chainFetchHandlers(fetchImpl, async (url, init) => handleDriverShiftFetch(url, init))
        : chainFetchHandlers(async (url, init) => handleDriverShiftFetch(url, init)),
    ),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    uuid: () => '00000000-0000-4000-8000-000000000002',
    bumpDataEpoch: () => {},
    bumpDataEpochAuto: () => {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const storeSrc = patchStoreSrcForNodeTests(readFileSync(path.join(WP, 'store.js'), 'utf8'));
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState;
  if (!sandbox.state.shifts) sandbox.state.shifts = [];
  return sandbox;
}

test('pushServerState: только globalThis.DRIVER — не syncReadOnly, POST /shifts с топливом', async () => {
  const driverTok = fakeJwt('driver');
  let pushedShift = null;
  const sb = loadStoreSandbox(async (url, init) => {
    const u = String(url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
      const body = JSON.parse(init.body || '{}');
      pushedShift = body.shift || body;
      return undefined;
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(200, { recordId: 'rec1' });
    }
    if (u.includes('/state')) return jsonResponse(200, { payload: { dataEpoch: 1, shifts: [] }, id: 'rec1' });
    return undefined;
  });
  sb.API_BASE = 'http://localhost/armada-api';
  sb.localStorage.setItem(ROLE_KEY, driverTok);
  vm.runInNewContext('DRIVER = "";', sb);
  sb.globalThis.DRIVER = 'Иванов Иван';
  sb.state.shift = {
    id: 'sh-f0',
    startedAt: '2026-10-12T06:00:00.000Z',
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    spaceId: 'sp-f0-qa',
    odometer: 1000,
    fuelLiters: 33,
    fuelPricePerLiter: 58.5,
    etoRefueled: true,
    orders: [],
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.state.dataEpoch = 2;
  sb.reconcileBeforePush = async () => {};

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.notEqual(r.syncReadOnly, true);
  assert.equal(r.driverShiftSync, true);
  assert.equal(pushedShift.fuelLiters, 33);
  assert.equal(pushedShift.fuelPricePerLiter, 58.5);
});

test('ЕТО «Заправлялся»: push после finishEtoFuelStep содержит литры и цену', async () => {
  const sb = loadF0Sandbox();
  seedF0World(sb);
  setDriverSession(sb, 'Иванов Иван');
  let pushed = null;
  sb.pushServerState = async () => {
    pushed = sb.snapshot();
    return { ok: true };
  };
  sb.pushServerStateQueued = async () => sb.pushServerState();
  sb.state.shift = {
    id: 'sh-yes',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    odometer: 1000,
    orders: [],
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '58.5';
  sb.submitNumber();
  sb.__numEl.value = '33';
  sb.submitNumber();
  assert.ok(pushed, 'push после топлива');
  const sh = (pushed.shifts || []).find((s) => s.id === 'sh-yes');
  assert.equal(sh.fuelLiters, 33);
  assert.equal(sh.fuelPricePerLiter, 58.5);
});

test('ЕТО «Не заправлялся»: fuelLiters=0, цена с прошлой заправки', async () => {
  const sb = loadF0Sandbox();
  seedF0World(sb);
  setDriverSession(sb, 'Иванов Иван');
  const prevDay = '2026-10-11T18:00:00.000Z';
  sb.state.shifts = [
    {
      id: 'sh-prev',
      startedAt: prevDay,
      endedAt: prevDay,
      driverName: 'Иванов Иван',
      vehiclePlate: 'А111АА77',
      odometer: 99000,
      fuelLiters: 40,
      fuelPricePerLiter: 58.5,
      etoRefueled: true,
      orders: [],
    },
  ];
  let pushed = null;
  sb.pushServerState = async () => {
    pushed = sb.snapshot();
    return { ok: true };
  };
  sb.pushServerStateQueued = async () => sb.pushServerState();
  sb.state.shift = {
    id: 'sh-no',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    odometer: 100000,
    orders: [],
  };
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.answerEtoRefuel(false);
  assert.equal(sb.state.shift.fuelLiters, 0);
  assert.equal(sb.state.shift.etoRefueled, false);
  assert.ok(Math.abs(sb.state.shift.fuelPricePerLiter - 58.5) < 0.01);
  assert.ok(pushed);
  const sh = (pushed.shifts || []).find((s) => s.id === 'sh-no');
  assert.equal(sh.fuelLiters, 0);
  assert.ok(Math.abs(sh.fuelPricePerLiter - 58.5) < 0.01);
});

test('mirrorDriverSessionToGlobal: enterAsDriver выставляет globalThis.DRIVER', () => {
  const driverJs = readFileSync(path.join(WP, 'driver.js'), 'utf8');
  assert.match(driverJs, /function mirrorDriverSessionToGlobal/);
  assert.match(driverJs, /mirrorDriverSessionToGlobal\(\)/);
});

test('F0.6 staging: sync-токен → verify-driver → ЕТО «Заправлялся» → PATCH с топливом (JWT водителя)', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let patchBody = null;
  let patchBearer = '';
  let verifyCalls = 0;

  const sb = loadF0Sandbox({
    fetch: chainFetchHandlers(async (url, init) => {
      const u = String(url);
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (u.includes('/auth/verify-driver')) {
        verifyCalls++;
        return jsonResponse(200, {
          token: driverTok,
          driver: { id: 'drv-staff', name: 'Иванов Иван' },
        });
      }
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
        const h = init.headers || {};
        patchBearer = h.Authorization || h.authorization || '';
        const body = JSON.parse(init.body || '{}');
        patchBody = body;
        return undefined;
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, { payload: { dataEpoch: 1, shifts: [] }, id: 'rec1' });
      }
      return undefined;
    }, async (url, init) => handleDriverShiftFetch(url, init)),
  });
  seedF0World(sb);
  setDriverSession(sb, 'Иванов Иван');
  sb.API_BASE = 'http://localhost/armada-api';
  sb.localStorage.setItem(LEGACY_KEY, syncTok);
  const driverPin = '1234';
  sb.reconcileBeforePush = async () => {};
  sb.pushServerStateQueued = async () => sb.pushServerState();

  const verified = await sb.armadaApiVerifyDriver('+79001234567', driverPin, 'drv-staff');
  assert.ok(verified && verified.token);
  assert.equal(sb.armadaApiRoleToken(), driverTok);
  assert.equal(sb.armadaApiSyncToken(), syncTok);
  assert.equal(verifyCalls, 1);
  assertNoDriverPinInClientStorage(sb, driverPin);

  await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(sb.armadaApiRoleToken(), driverTok);

  sb.state.shift = {
    id: 'sh-sync-bootstrap',
    startedAt: '2026-10-12T06:50:00.000Z',
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    odometer: 100500,
    orders: [],
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '58.5';
  sb.submitNumber();
  sb.__numEl.value = '33';
  sb.submitNumber();

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.notEqual(r.syncReadOnly, true);
  assert.match(patchBearer, new RegExp(`Bearer ${driverTok.replace(/\./g, '\\.')}`));
  assert.equal(sb.armadaApiTokenRole(), 'driver');
  const sh = patchBody?.shift || patchBody;
  assert.ok(sh, 'смена в PATCH');
  assert.equal(sh.fuelLiters, 33);
  assert.equal(sh.fuelPricePerLiter, 58.5);
});

test('F0.6: без verify-driver при sync JWT push ЕТО уходит в syncReadOnly (регрессия staging)', async () => {
  const syncTok = fakeJwt('sync');
  const sb = loadStoreSandbox(async (url) => {
    if (String(url).includes('/auth/login')) return jsonResponse(200, { token: syncTok });
    return jsonResponse(404, {});
  });
  sb.localStorage.setItem(LEGACY_KEY, syncTok);
  sb.globalThis.DRIVER = 'Иванов Иван';
  sb.reconcileBeforePush = async () => {};
  sb.snapshotForApiPush = () => ({ dataEpoch: 1, shifts: [] });

  const r = await sb.pushServerState();
  assert.equal(r.syncReadOnly, true);
});
