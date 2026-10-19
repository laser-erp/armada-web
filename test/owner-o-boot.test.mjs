/**
 * /o/: owner-auth.js вместо auth.js — app.js не должен падать на migrateAdmins / isSuperAdmin.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const bootSrc = readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
const isOBlock = bootSrc.match(/if \(isO\) \{[\s\S]*?\} else if \(isV\)/);
assert.ok(isOBlock, 'isO branch in shellScripts');
assert.match(isOBlock[0], /'owner-auth\.js'/, '/o bundle must include owner-auth.js');
assert.doesNotMatch(isOBlock[0], /'auth\.js'/, '/o bundle must not load auth.js');

const appSrc = readFileSync(path.join(root, 'app.js'), 'utf8');
assert.match(
  appSrc,
  /if\(typeof migrateAdmins==='function'\) migrateAdmins\(\);/,
  'app.js boot migrateAdmins guarded for /o/'
);

const ownerAuthSrc = readFileSync(path.join(root, 'owner-auth.js'), 'utf8');
assert.match(ownerAuthSrc, /function isSuperAdmin\(/, 'owner-auth.js provides isSuperAdmin');
