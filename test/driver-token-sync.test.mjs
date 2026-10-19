/**
 * lc-0036 S5: JWT водителя не подменяется на sync в кабинете / при открытой смене.
 * Запуск: node --test web-preview/test/driver-token-sync.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  chainFetchHandlers,
  guardFetch,
  handleDriverShiftFetch,
  jsonResponse,
  patchStoreSrcForNodeTests,
} from './armada-test-fetch.mjs';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function loadStoreSandbox(fetchImpl, docQuerySelector) {
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
    sessionStorage: {
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
    document: {
      ...ev,
      querySelector: docQuerySelector || (() => null),
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      querySelectorAll: () => [],
      body: { style: {} },
      documentElement: { style: {} },
    },
    location: { href: 'http://localhost/v/', pathname: '/v/', hostname: 'localhost', assign() {}, replace() {} },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    fetch: guardFetch(
      chainFetchHandlers(fetchImpl, async (url, init) => handleDriverShiftFetch(url, init)),
    ),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000099' },
    uuid: () => '00000000-0000-4000-8000-000000000098',
    bumpDataEpoch: () => {},
    bumpDataEpochAuto: () => {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const storeSrc = patchStoreSrcForNodeTests(readFileSync(path.join(WP, 'store.js'), 'utf8'));
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState || sandbox.globalThis.__armadaState;
  if (!sandbox.state.shifts) sandbox.state.shifts = [];
  return sandbox;
}

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

test('ensureArmadaApiToken(sync) не логинит sync при JWT водителя в сессии', async () => {
  let loginCalls = 0;
  const sb = loadStoreSandbox(async (url) => {
    if (String(url).includes('/auth/login')) {
      loginCalls++;
      return jsonResponse(200, { token: fakeJwt('sync') });
    }
    return jsonResponse(404, {});
  });
  const driverTok = fakeJwt('driver');
  sb.localStorage.setItem('armada_api_token_v1', driverTok);
  sb.DRIVER = 'Иванов Иван';
  sb.globalThis.DRIVER = 'Иванов Иван';

  const ok = await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(ok, true);
  assert.equal(sb.armadaApiToken(), driverTok);
  assert.equal(sb.armadaApiTokenRole(), 'driver');
  assert.equal(loginCalls, 0);
});

test('ensureArmadaApiToken(sync) логинит sync без сессии водителя', async () => {
  let loginCalls = 0;
  const syncTok = fakeJwt('sync');
  const sb = loadStoreSandbox(async (url) => {
    if (String(url).includes('/auth/login')) {
      loginCalls++;
      return jsonResponse(200, { token: syncTok });
    }
    return jsonResponse(404, {});
  });
  sb.DRIVER = '';

  const ok = await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(ok, true);
  assert.equal(sb.armadaApiToken(), syncTok);
  assert.equal(sb.armadaApiTokenRole(), 'sync');
  assert.equal(loginCalls, 1);
});

test('pushServerState: sync — syncReadOnly; driver — не read-only', async () => {
  const syncTok = fakeJwt('sync');
  const syncSb = loadStoreSandbox(async (url) => {
    if (String(url).includes('/auth/login')) return jsonResponse(200, { token: syncTok });
    return jsonResponse(404, {});
  });
  syncSb.localStorage.setItem('armada_api_token_v1', syncTok);
  const rSync = await syncSb.pushServerState();
  assert.equal(rSync.syncReadOnly, true);

  let patchStateCount = 0;
  const driverSb = loadStoreSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'PATCH') {
      patchStateCount++;
      return jsonResponse(403, {});
    }
    if (u.includes('/shifts') && method === 'POST') {
      return jsonResponse(200, { rev: 1, dataEpoch: 2, shift: JSON.parse(init.body || '{}').shift });
    }
    return jsonResponse(404, {});
  });
  driverSb.localStorage.setItem('armada_api_token_v1', fakeJwt('driver'));
  driverSb.DRIVER = 'Иванов';
  driverSb.globalThis.DRIVER = 'Иванов';
  driverSb.reconcileBeforePush = async () => {};
  driverSb.snapshotForApiPush = () => ({ dataEpoch: 1 });
  driverSb.patchServerStatePayload = async () => ({ ok: true });
  driverSb.state.shift = {
    id: 'sh-tok',
    spaceId: 'sp1',
    driverName: 'Иванов',
    startedAt: '2026-10-12T08:00:00.000Z',
  };
  driverSb.state.shifts = [structuredClone(driverSb.state.shift)];
  const rDriver = await driverSb.pushServerState();
  assert.equal(rDriver.ok, true);
  assert.equal(rDriver.driverShiftSync, true);
  assert.equal(patchStateCount, 0);
  assert.notEqual(rDriver.syncReadOnly, true);
});

test('enterAsDriver не вызывает ensureArmadaApiToken(sync) при driver JWT', async () => {
  const driverJs = readFileSync(path.join(WP, 'driver.js'), 'utf8');
  assert.match(
    driverJs,
    /armadaApiPreserveDriverJwtInCabinet/,
    'enterAsDriver не подменяет JWT на sync при активной сессии водителя',
  );
});

test('fetchArmadaApi 401 в кабинете водителя не сбрасывает JWT на sync', async () => {
  const driverTok = fakeJwt('driver');
  let loginCalls = 0;
  let stateGets = 0;
  const sb = loadStoreSandbox(
    async (url) => {
      if (String(url).includes('/auth/login')) {
        loginCalls++;
        return jsonResponse(200, { token: fakeJwt('sync') });
      }
      if (String(url).includes('/state')) {
        stateGets++;
        return jsonResponse(stateGets === 1 ? 401 : 200, { payload: { dataEpoch: 0 } });
      }
      return jsonResponse(404, {});
    },
    (sel) => (sel === '#driver.show' ? {} : null),
  );
  sb.localStorage.setItem('armada_api_token_v1', driverTok);
  sb.globalThis.DRIVER = 'Иванов Иван';
  const res = await sb.fetchArmadaApi('/state', { headers: sb.armadaApiJsonHeaders() }, 5000);
  assert.equal(res.status, 401);
  assert.equal(sb.armadaApiToken(), driverTok);
  assert.equal(loginCalls, 0);
});

test('вход водителя → фоновый sync → pushServerState: POST /shifts с JWT водителя', async () => {
  const driverTok = fakeJwt('driver');
  let loginCalls = 0;
  let patchBearer = '';
  const sb = loadStoreSandbox(
    async (url, init) => {
      const u = String(url);
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (u.includes('/auth/login')) {
        loginCalls++;
        return jsonResponse(200, { token: fakeJwt('sync') });
      }
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
        const h = init.headers || {};
        patchBearer = h.Authorization || h.authorization || '';
        return undefined;
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, { payload: { dataEpoch: 1, shifts: [] }, id: 'rec1' });
      }
      return undefined;
    },
    (sel) => (sel === '#driver.show' ? {} : null),
  );
  sb.localStorage.setItem('armada_api_token_v1', driverTok);
  sb.globalThis.DRIVER = 'Иванов Иван';
  sb.state.dataEpoch = 1;
  sb.state.shift = {
    id: 'sh1',
    spaceId: 'sp1',
    driverName: 'Иванов Иван',
    startedAt: '2026-10-12T06:00:00.000Z',
    vehiclePlate: 'А111АА77',
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];

  await sb.fetchServerState(3000);
  await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(sb.armadaApiToken(), driverTok);
  assert.equal(loginCalls, 0);

  sb.reconcileBeforePush = async () => {};
  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.notEqual(r.syncReadOnly, true);
  assert.match(patchBearer, /^Bearer /);
  assert.equal(sb.armadaApiTokenRole(), 'driver');
  assert.equal(loginCalls, 0);
});

test('миграция: sync JWT из armada_api_token_v1 → armada_api_sync_token_v1', () => {
  const syncTok = fakeJwt('sync');
  const sb = loadStoreSandbox(async () => jsonResponse(404, {}));
  sb.localStorage.setItem(LEGACY_KEY, syncTok);
  assert.equal(sb.armadaApiSyncToken(), syncTok);
  assert.equal(sb.localStorage.getItem(LEGACY_KEY), null);
  assert.equal(sb.armadaApiTokenRole(), 'sync');
});

test('стартовый sync → verify-driver → фоновый sync → POST /shifts с JWT водителя (раздельные ключи)', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  const driverPin = '5678';
  let loginCalls = 0;
  let patchBearer = '';
  const sb = loadStoreSandbox(
    async (url, init) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        loginCalls++;
        return jsonResponse(200, { token: syncTok });
      }
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(200, {
          token: driverTok,
          driver: { id: 'd1', name: 'Иванов Иван' },
        });
      }
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (u.includes('/shifts') && (method === 'POST' || method === 'PATCH')) {
        const h = init.headers || {};
        patchBearer = h.Authorization || h.authorization || '';
        return undefined;
      }
      if (u.includes('/state') && method === 'PATCH') {
        return jsonResponse(200, { recordId: 'rec1' });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, { payload: { dataEpoch: 1, shifts: [] }, id: 'rec1' });
      }
      return undefined;
    },
    (sel) => (sel === '#driver.show' ? {} : null),
  );
  sb.localStorage.setItem(LEGACY_KEY, syncTok);
  sb.globalThis.DRIVER = 'Иванов Иван';
  sb.state.shift = {
    id: 'sh1',
    spaceId: 'sp1',
    driverName: 'Иванов Иван',
    startedAt: '2026-10-12T06:00:00.000Z',
    vehiclePlate: 'А111АА77',
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];

  const verified = await sb.armadaApiVerifyDriver('+79991234567', driverPin, 'd1');
  assert.ok(verified && verified.token);
  assert.equal(sb.armadaApiRoleToken(), driverTok);
  assert.equal(sb.armadaApiSyncToken(), syncTok);
  assertNoDriverPinInClientStorage(sb, driverPin);

  await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(sb.armadaApiRoleToken(), driverTok);
  assert.equal(loginCalls, 0);

  sb.reconcileBeforePush = async () => {};
  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.notEqual(r.syncReadOnly, true);
  assert.match(patchBearer, new RegExp(`Bearer ${driverTok.replace(/\./g, '\\.')}`));
  assert.equal(sb.armadaApiTokenRole(), 'driver');
});

test('фоновый sync не затирает JWT водителя в отдельном ключе роли', async () => {
  const syncTok = fakeJwt('sync');
  const driverTok = fakeJwt('driver');
  let loginCalls = 0;
  const sb = loadStoreSandbox(async (url) => {
    if (String(url).includes('/auth/login')) {
      loginCalls++;
      return jsonResponse(200, { token: fakeJwt('sync') });
    }
    return jsonResponse(404, {});
  });
  sb.localStorage.setItem(SYNC_KEY, syncTok);
  sb.localStorage.setItem(ROLE_KEY, driverTok);
  sb.globalThis.DRIVER = 'Иванов Иван';

  await sb.ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
  assert.equal(sb.armadaApiRoleToken(), driverTok);
  assert.equal(sb.armadaApiSyncToken(), syncTok);
  assert.equal(loginCalls, 0);
});
