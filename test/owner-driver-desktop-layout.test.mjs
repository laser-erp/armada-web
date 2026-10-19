/**
 * Разметка компьютерного вида кабинета собственника (S2): shell, sidebar, таблицы.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const od = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
const css = readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(od, /owner-driver-shell/, 'shell layout in owner-driver.js');
assert.match(od, /owner-driver-sidebar-head/, 'sidebar profile head');
assert.match(od, /od-nav-logout/, 'logout in sidebar');
assert.match(od, /od-nav-exchange/, 'exchange nav');
assert.match(od, /od-nav-profile/, 'profile nav');
assert.match(od, /owner-driver-data-table/, 'desktop tables markup');
assert.match(od, /owner-driver-only-mobile/, 'mobile list preserved');
assert.match(od, /ownerDriverTripsTableHtml/, 'trips table renderer');
assert.match(od, /owner-driver-handoff/, 'workflow handoff class');

assert.match(css, /@media \(min-width:1024px\)/, 'desktop breakpoint in styles');
assert.match(css, /\.owner-driver-sidebar/, 'sidebar styles');
assert.match(css, /\.owner-driver-only-desktop/, 'desktop-only blocks');

console.log('owner-driver-desktop-layout.test.mjs: ok');
