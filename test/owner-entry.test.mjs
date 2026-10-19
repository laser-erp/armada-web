import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryRoute = readFileSync(path.join(root, 'entry-route.js'), 'utf8');
assert.match(entryRoute, /\/\(o\)/, 'entry-route knows /o/');
assert.match(entryRoute, /owner-login/, 'owner-login screen');

const boot = readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
const isOBlock = boot.match(/if \(isO\) \{[\s\S]*?\} else if \(isV\)/);
assert.ok(isOBlock, 'isO branch in boot-loader');
assert.match(isOBlock[0], /owner-auth\.js/, '/o bundle includes owner-auth.js');
assert.doesNotMatch(isOBlock[0], /'auth\.js'/, '/o bundle must not load auth.js');

const store = readFileSync(path.join(root, 'store.js'), 'utf8');
assert.match(store, /'owner'/, 'ENTRY_MODES includes owner');

console.log('owner-entry.test.mjs: ok');
