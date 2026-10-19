import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const store = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store.js'), 'utf8');
assert.match(store, /function createOwnerDriverCabinet/, 'createOwnerDriverCabinet in store.js');
assert.match(store, /cabinetKind:'owner_driver'/, 'owner cabinet kind');
assert.match(store, /accountKind:'owner_driver'/, 'owner driver account');

const ent = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin-entitlements.js'), 'utf8');
assert.match(ent, /ent-new-owner-submit/, 'super create form');

console.log('create-owner-driver.test.mjs: ok');
