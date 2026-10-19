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

assert.equal(api.armadaPublicLandingHref(''), '/landing.html');
assert.equal(api.armadaPublicLandingHref('?x=1'), '/landing.html?x=1');

const fb = api.armadaAppRootBootFallbackAction;
assert.equal(fb(true).action, 'none');
assert.equal(fb(false).action, 'redirect');
assert.equal(fb(false).href, '/landing.html');

assert.equal(api.armadaShouldRedirectGuestToLanding({ pathname: '/', getLocalStorageItem: () => '', getSessionStorageItem: () => '' }).redirect, true);

console.log('entry-root-routing.test.mjs: ok');
