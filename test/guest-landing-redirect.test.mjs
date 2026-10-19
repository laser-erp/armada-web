import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'guest-landing-redirect.js'), 'utf8');

function loadApi() {
  const sandbox = {
    console,
    location: undefined,
    document: undefined,
    atob: (str) => Buffer.from(str, 'base64').toString('utf8'),
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'guest-landing-redirect.js' });
  return sandbox;
}

const api = loadApi();
const should = api.armadaShouldRedirectGuestToLanding;

assert.equal(api.armadaIsExactAppRootPath('/'), true);
assert.equal(api.armadaIsExactAppRootPath('/index.html'), true);
assert.equal(api.armadaIsExactAppRootPath('/a/'), false);
assert.equal(api.armadaIsExactAppRootPath('/landing.html'), false);

const emptyStore = () => ({ ls: {}, ss: {} });
function env(pathname, store, search) {
  const s = store || emptyStore();
  return {
    pathname,
    search: search || '',
    getLocalStorageItem: (k) => s.ls[k] || '',
    getSessionStorageItem: (k) => s.ss[k] || '',
  };
}

function expectRedirect(pathname, store, search, href) {
  const r = should(env(pathname, store, search));
  assert.equal(r.redirect, true, pathname);
  assert.equal(r.href, href);
}
function expectNoRedirect(pathname, store) {
  const r = should(env(pathname, store));
  assert.equal(r.redirect, false, pathname);
}

expectRedirect('/', emptyStore(), '', '/landing.html');
expectRedirect('/index.html', emptyStore(), '', '/landing.html');
expectRedirect('/index.html', emptyStore(), '?theme=light', '/landing.html?theme=light');
expectNoRedirect('/a/');

const cust = emptyStore();
cust.ls.armada_customer_session_v1 = JSON.stringify({ companyId: 'co-1', phone: '+7900' });
expectNoRedirect('/', cust);

const admin = emptyStore();
admin.ls.armada_admin_session_v1 = JSON.stringify({ id: 'a1', name: 'Logist' });
expectNoRedirect('/', admin);

const driver = emptyStore();
driver.ls.armada_driver_session_v1 = JSON.stringify({ name: 'Ivan', companyId: 'c1' });
expectNoRedirect('/', driver);

const owner = emptyStore();
owner.ss.armada_owner_driver_session_v1 = '1';
owner.ls.armada_api_role_token_v1 = makeJwt({ role: 'owner_driver', exp: Math.floor(Date.now() / 1000) + 3600 });
assert.equal(
  api.armadaHasStoredAppSession(
    (k) => owner.ls[k] || '',
    (k) => owner.ss[k] || ''
  ),
  true
);
expectNoRedirect('/', owner);

console.log('guest-landing-redirect.test.mjs: ok');

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}
