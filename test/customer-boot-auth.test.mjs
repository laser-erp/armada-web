/**
 * /z/: app.js → companyInMySpace вызывает isSuperAdmin; нужен auth.js в бандле boot-loader.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bootSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'boot-loader.js'),
  'utf8'
);

const isZBlock = bootSrc.match(/else if \(isZ\) ([^\n]+)/);
assert.ok(isZBlock, 'isZ branch in shellScripts');
const zLine = isZBlock[1];
const zFiles = [...zLine.matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
const authIdx = zFiles.indexOf('auth.js');
const customerIdx = zFiles.indexOf('customer.js');
assert.ok(authIdx >= 0, '/z bundle must include auth.js');
assert.ok(customerIdx > authIdx, 'auth.js before customer.js on /z');

const appSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js'),
  'utf8'
);
assert.match(appSrc, /function companyInMySpace/, 'companyInMySpace in app.js');
assert.match(appSrc, /isSuperAdmin\(\)/, 'companyInMySpace uses isSuperAdmin');

const tail = bootSrc.match(/files\.push\('vehicle-podbor\.js', 'app\.js'\)/);
assert.ok(tail, 'app.js always last in shellScripts bundle');
