import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const storeSrc = readFileSync(path.join(root, 'store.js'), 'utf8');
const bootSrc = readFileSync(path.join(root, 'boot-loader.js'), 'utf8');

assert.match(storeSrc, /refreshAdminListForLoginInflight/, 'dedup inflight promise in store.js');
assert.match(storeSrc, /REFRESH_ADMIN_LOGIN_LIST_TIMEOUT_MS\s*=\s*10000/, 'login list timeout 10s');
assert.match(
  storeSrc,
  /refreshAdminListForLogin[\s\S]*?return true;/,
  'refreshAdminListForLogin resolves true (no pin-error on background fail)',
);

assert.match(
  bootSrc,
  /early !== 'admin-pin'[\s\S]*openDedicatedEntryScreen/,
  'boot-loader does not call openDedicatedEntryScreen for /a (app.js boot once)',
);

let inflight = null;
let coreCalls = 0;
async function coreSlow() {
  coreCalls += 1;
  await new Promise((r) => setTimeout(r, 40));
  return false;
}
async function refreshLikeStore() {
  if (!inflight) {
    inflight = coreSlow()
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
  return true;
}

const parallel = await Promise.all([refreshLikeStore(), refreshLikeStore(), refreshLikeStore()]);
assert.equal(coreCalls, 1, 'parallel refreshAdminListForLogin shares one core call');
assert.deepEqual(parallel, [true, true, true]);

console.log('admin-login-list-refresh-dedup.test.mjs: ok');
