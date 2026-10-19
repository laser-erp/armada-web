/**
 * /v: app.js вызывает migrateAdmins() при загрузке — нужен auth.js в бандле boot-loader.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bootSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'boot-loader.js'),
  'utf8'
);

const isVBlock = bootSrc.match(/if \(isV\) \{[\s\S]*?\} else if \(isA\)/);
assert.ok(isVBlock, 'isV branch in shellScripts');
assert.match(isVBlock[0], /'auth\.js'/, '/v bundle must include auth.js before app.js');
assert.match(isVBlock[0], /'owner-driver\.js'/, '/v bundle must include owner-driver.js');

const appSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js'),
  'utf8'
);
const topMigrate = appSrc.match(
  /^migrateCompanies\(\);\s*\nif\(typeof migrateAdmins==='function'\) migrateAdmins\(\);/m
);
assert.ok(topMigrate, 'app.js boot migrateAdmins guarded — /v still needs auth.js for loginAdmin');
