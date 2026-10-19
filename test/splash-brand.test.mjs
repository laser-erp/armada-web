import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(index.includes('splash-progress-bar'), 'splash progress bar');
assert.ok(!index.includes('Учёт перевозок</div>'), 'old splash subtitle removed');
assert.ok(index.includes('armada-mark.svg'), 'unified mark in index');
assert.ok(readFileSync(path.join(root, 'brand/armada-wordmark.css'), 'utf8').includes('splash-progress-bar'));

console.log('splash-brand.test.mjs: ok');
