/**
 * Узкий localStorage-кэш: space водителя из сессии (DRIVER + company / JWT).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeDriverJwt({ spaceId, companyId }) {
  const payload = Buffer.from(
    JSON.stringify({ role: 'driver', spaceId, companyId, exp: 9999999999 })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

function loadSandbox() {
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
    location: { pathname: '/v/', href: 'http://localhost/v/' },
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  let storeSrc = readFileSync(path.join(WP, 'store.js'), 'utf8');
  storeSrc = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  vm.runInNewContext(readFileSync(path.join(WP, 'space-modules.js'), 'utf8'), sandbox, {
    filename: 'space-modules.js',
  });
  sandbox.state = sandbox.__armadaState;
  return sandbox;
}

const sb = loadSandbox();
const spDriver = 'sp-driver-99';

sb.localStorage.setItem('armada_api_token_v1', fakeDriverJwt({ spaceId: spDriver, companyId: 'co1' }));
sb.DRIVER = 'Иван Тестов';
sb.DRIVER_COMPANY_ID = 'co1';
sb.state.companies = [{ id: 'co1', name: 'ТК', spaceId: spDriver, roles: ['own'] }];
sb.state.drivers = [{ id: 'd1', name: 'Иван Тестов', companyId: 'co1', spaceId: spDriver }];
sb.state.orders = [
  { id: 'o1', spaceId: spDriver },
  { id: 'o2', spaceId: 'sp-other' },
];

const sid = sb.driverSessionScopeSpaceId();
assert.equal(sid, spDriver, 'driverSessionScopeSpaceId from JWT/company');

const ids = sb.localCacheScopeSpaceIds();
assert.ok(ids.has(spDriver), 'localCacheScopeSpaceIds contains driver space');

const snap = sb.scopedLocalCacheSnapshot();
assert.ok((snap.cacheScope || []).includes(spDriver), 'scoped snapshot cacheScope');
assert.ok(!snap.orders.some((o) => o.id === 'o2'), 'foreign space order stripped');

console.log('local-cache-driver-scope.test.mjs: passed');
