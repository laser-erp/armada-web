/**
 * Широкий экран: CSS-якоря раскладки (1024 / 1280).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const admin = readFileSync(path.join(root, 'admin.js'), 'utf8');

assert.match(css, /@media \(min-width:1024px\)[\s\S]*\.phone\.wide[\s\S]*max-width:100%/, 'admin shell full width at 1024');
assert.match(css, /\.kanban-col[\s\S]*flex:1 1 0/, 'kanban columns grow on desktop');
assert.match(css, /@media \(min-width:1280px\)[\s\S]*\.admin-order-wide-cols/, 'order two-column grid at 1280');
assert.match(html, /admin-order-wide-cols/, 'create order wide columns in index.html');
assert.match(html, /admin-order-wide-aside/, 'create aside column');
assert.match(admin, /admin-order-wide-aside/, 'detail order aside column');
assert.match(admin, /detailAsideHtml/, 'detail bundles assign/docs aside');

console.log('wide-desktop-layout.test.mjs: ok');
