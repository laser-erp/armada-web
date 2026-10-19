import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const od = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
const sm = readFileSync(path.join(root, 'space-modules.js'), 'utf8');

assert.match(sm, /exchange/, 'exchange in space-modules');
assert.match(od, /renderOwnerDriverExchange/, 'exchange screen');
assert.match(od, /renderOwnerDriverTariff/, 'tariff screen');
assert.match(od, /od-nav-profile/, 'profile nav');
assert.match(od, /OWNER_DRIVER_EXCHANGE_LOCK_MSG/, 'lock message');

console.log('owner-driver-exchange-ui.test.mjs: ok');
