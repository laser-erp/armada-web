/**
 * lc-0036 S5: полный браузерный путь — E2E sync bootstrap, initCloudSync, вход, ЕТО → PATCH.
 * node --test web-preview/test/lc-0036-s5-browser-path.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadF0Sandbox, seedF0World, setDriverSession } from './f0-eto-harness.mjs';
import {
  chainFetchHandlers,
  handleDriverShiftFetch,
  jsonResponse,
} from './armada-test-fetch.mjs';

const LEGACY_KEY = 'armada_api_token_v1';
const SYNC_KEY = 'armada_api_sync_token_v1';
const ROLE_KEY = 'armada_api_role_token_v1';

function fakeJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function httpMethod(init) {
  return String((init && init.method) || 'GET').toUpperCase();
}

function withDriverShiftApi(handler) {
  return chainFetchHandlers(handler, async (url, init) => handleDriverShiftFetch(url, init));
}

/** Как Playwright addInitScript в lc-0036-s5-r1012.mjs — только sync-ключ. */
function e2eInitSyncToken(sb, syncTok) {
  if (!sb.localStorage.getItem(SYNC_KEY)) {
    sb.localStorage.setItem(SYNC_KEY, syncTok);
  }
}

test('только sync JWT при активной смене: pushServerState syncReadOnly, PATCH не вызывается', async () => {
  const syncTok = fakeJwt('sync');
  let patchAttempted = false;
  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      if (u.includes('/state') && init && init.method === 'PATCH') {
        patchAttempted = true;
        return jsonResponse(200, { recordId: 'rec1' });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  sb.localStorage.setItem(SYNC_KEY, syncTok);
  setDriverSession(sb, 'Иванов Иван');
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? { classList: { add() {}, remove() {} } } : null);
  sb.state.shift = {
    id: 'sh-open',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    orders: [],
  };
  sb.reconcileBeforePush = async () => {};
  sb.snapshotForApiPush = () => sb.snapshot();
  const r = await sb.pushServerState();
  assert.equal(r.syncReadOnly, true);
  assert.equal(patchAttempted, false);
});

test('401 на GET /state с sync-токеном не стирает JWT роли водителя', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let stateGets = 0;
  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      if (u.includes('/state') && (!init || !init.method || init.method === 'GET')) {
        stateGets++;
        if (stateGets === 1) return jsonResponse(401, { error: 'unauthorized' });
        return jsonResponse(200, {
          payload: { dataEpoch: 1, shifts: [], drivers: sb.state.drivers, spaces: sb.state.spaces },
          id: 'rec1',
        });
      }
      if (u.includes('/auth/login')) {
        return jsonResponse(200, { token: fakeJwt('sync') });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  sb.localStorage.setItem(SYNC_KEY, syncTok);
  sb.localStorage.setItem(ROLE_KEY, driverTok);
  setDriverSession(sb, 'Иванов Иван');
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? { classList: { add() {}, remove() {} } } : null);

  await sb.fetchArmadaApi('/state', { headers: sb.armadaApiJsonHeaders() }, 5000);
  assert.equal(sb.armadaApiRoleToken(), driverTok);
});

test('verify-driver → initCloudSync(401) → push ЕТО: JWT водителя и PATCH /shifts', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let stateGets = 0;
  let shiftWrites = 0;

  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      const method = httpMethod(init);
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) shiftWrites++;
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(200, {
          token: driverTok,
          driver: { id: 'drv-staff', name: 'Иванов Иван' },
        });
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        stateGets++;
        if (stateGets === 1) return jsonResponse(401, { error: 'unauthorized' });
        return jsonResponse(200, {
          payload: { dataEpoch: 1, shifts: [], drivers: sb.state.drivers, spaces: sb.state.spaces },
          id: 'rec1',
        });
      }
      if (u.includes('/auth/login')) {
        return jsonResponse(200, { token: syncTok });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  e2eInitSyncToken(sb, syncTok);

  await sb.armadaApiVerifyDriver('+79001234567', '4567', 'drv-staff');
  assert.equal(sb.armadaApiRoleToken(), driverTok);

  await sb.initCloudSync().catch(() => {});
  assert.equal(sb.armadaApiRoleToken(), driverTok, 'initCloudSync не должен сбрасывать JWT водителя после verify-driver');

  setDriverSession(sb, 'Иванов Иван');
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? { classList: { add() {}, remove() {} } } : null);
  sb.state.shift = {
    id: 'sh-init-sync',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    orders: [],
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.reconcileBeforePush = async () => {};
  const r = await sb.pushServerState();
  assert.notEqual(r.syncReadOnly, true);
  assert.equal(r.ok, true);
  assert.equal(shiftWrites, 1);
});

test('E2E bootstrap → initCloudSync → doLoginDriverPin → ЕТО: POST /shifts с JWT водителя', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let shiftBearer = '';
  let shiftWrites = 0;
  let initCloudDone = false;

  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      const method = httpMethod(init);
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
        shiftWrites++;
        const h = init.headers || {};
        shiftBearer = h.Authorization || h.authorization || shiftBearer;
        return undefined;
      }
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(200, {
          token: driverTok,
          driver: { id: 'drv-staff', name: 'Иванов Иван', companyId: 'co-f0-own' },
        });
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, {
          payload: { dataEpoch: 1, shifts: [], drivers: sb.state.drivers, spaces: sb.state.spaces },
          id: 'rec1',
        });
      }
      if (u.includes('/auth/login')) {
        return jsonResponse(200, { token: syncTok });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  e2eInitSyncToken(sb, syncTok);

  const navBtn = () => ({
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
  });
  ['btn-home', 'btn-eto', 'btn-orders', 'btn-shifts', 'btn-cabinet'].forEach((id) => sb.$(id) || sb.document.getElementById(id));
  for (const id of ['btn-home', 'btn-eto', 'btn-orders', 'btn-shifts', 'btn-cabinet']) {
    sb.$(id);
    const el = sb.document.getElementById(id);
    if (el) {
      el.removeAttribute = () => {};
      el.setAttribute = () => {};
    }
  }
  const driverScreen = { classList: { add() {}, remove() {} } };
  const origGet = sb.document.getElementById.bind(sb.document);
  sb.document.getElementById = (id) => {
    if (['btn-home', 'btn-eto', 'btn-orders', 'btn-shifts', 'btn-cabinet'].includes(id)) return navBtn();
    if (id === 'driver') return driverScreen;
    return origGet(id);
  };
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? driverScreen : null);

  const initPromise = sb.initCloudSync().then(() => {
    initCloudDone = true;
  });

  sb.driverLoginPhoneEl = () => ({ value: '+79001234567' });
  sb.$('drv-login-pin').value = '4567';
  sb.driverLoginStep = 'pin';
  sb.driverLoginSelected = sb.state.drivers[0];

  await sb.doLoginDriverPin((msg) => {
    if (msg) throw new Error(msg);
  });

  await new Promise((r) => setTimeout(r, 50));
  await initPromise;
  assert.ok(initCloudDone);
  assert.equal(sb.armadaApiRoleToken(), driverTok);

  sb.state.shift = {
    id: 'sh-s5',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    odometer: 100500,
    orders: [],
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.pushServerStateQueued = async () => sb.pushServerState();
  sb.reconcileBeforePush = async () => {};

  sb.answerEtoRefuel(true);
  sb.__numEl.value = '58.5';
  sb.submitNumber();
  sb.__numEl.value = '33';
  sb.submitNumber();

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.notEqual(r.syncReadOnly, true);
  assert.equal(shiftWrites >= 1, true);
  assert.match(shiftBearer, new RegExp(`Bearer ${driverTok.replace(/\./g, '\\.')}`));
});

test('E2E sync bootstrap: verify-driver → 401 sync до кабинета — JWT роли и POST /shifts', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let shiftWrites = 0;

  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      const method = httpMethod(init);
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) shiftWrites++;
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(200, {
          token: driverTok,
          driver: { id: 'drv-staff', name: 'Иванов Иван', companyId: 'co-f0-own' },
        });
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        return jsonResponse(401, { error: 'unauthorized' });
      }
      if (u.includes('/auth/login')) {
        return jsonResponse(200, { token: syncTok });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  e2eInitSyncToken(sb, syncTok);
  vm.runInNewContext('DRIVER = ""; DRIVER_COMPANY_ID = null;', sb);
  sb.globalThis.DRIVER = '';

  await sb.armadaApiVerifyDriver('+79001234567', '4567', 'drv-staff');
  assert.equal(sb.armadaApiRoleToken(), driverTok);

  const syncHeaders = { Authorization: `Bearer ${syncTok}`, Accept: 'application/json' };
  const staleSync401 = await sb.fetchArmadaApi('/state', { headers: syncHeaders }, 5000);
  assert.equal(staleSync401.status, 401);
  assert.equal(
    sb.armadaApiRoleToken(),
    driverTok,
    '401 по sync-запросу до входа в кабинет не должен стирать JWT водителя',
  );

  setDriverSession(sb, 'Иванов Иван');
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? { classList: { add() {}, remove() {} } } : null);
  sb.state.shift = {
    id: 'sh-s5-race',
    startedAt: new Date().toISOString(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    orders: [],
  };
  sb.reconcileBeforePush = async () => {};
  const r = await sb.pushServerState();
  assert.notEqual(r.syncReadOnly, true);
  assert.equal(r.ok, true);
  assert.equal(shiftWrites, 1);
});

test('401 на PATCH с JWT водителя — сброс роли и сессии, без sync-подмены', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let patchCalls = 0;

  const sb = loadF0Sandbox({
    fetch: withDriverShiftApi(async (url, init) => {
      const u = String(url);
      if (u.includes('/state') && init && init.method === 'PATCH') {
        patchCalls++;
        return jsonResponse(401, { error: 'unauthorized' });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, {
          payload: { dataEpoch: 1, shifts: [], drivers: sb.state.drivers, spaces: sb.state.spaces },
          id: 'rec1',
        });
      }
      return undefined;
    }),
  });
  seedF0World(sb);
  sb.API_BASE = 'http://localhost/armada-api';
  sb.localStorage.setItem(SYNC_KEY, syncTok);
  sb.localStorage.setItem(ROLE_KEY, driverTok);
  setDriverSession(sb, 'Иванов Иван');
  sb.document.querySelector = (sel) => (sel === '#driver.show' ? { classList: { add() {}, remove() {} } } : null);

  const writeHeaders = sb.armadaApiJsonHeadersForWrite();
  await sb.fetchArmadaApi('/state', { method: 'PATCH', headers: writeHeaders, body: '{}' }, 5000);
  assert.equal(patchCalls, 1);
  assert.equal(sb.armadaApiRoleToken(), '');
  assert.equal(sb.armadaApiSyncToken(), syncTok, 'sync JWT не трогаем при 401 водителя');
  assert.equal(sb.globalThis.DRIVER, '');
});

test('restoreDriverSession без JWT роли — не восстанавливать кабинет', () => {
  const syncTok = fakeJwt('sync');
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.localStorage.setItem(SYNC_KEY, syncTok);
  const sessKey = 'armada_driver_session_v1';
  sb.localStorage.setItem(sessKey, JSON.stringify({ name: 'Иванов Иван', companyId: 'co-f0-own' }));
  assert.equal(sb.restoreDriverSession(), false);
  assert.equal(sb.globalThis.DRIVER, '');
});
