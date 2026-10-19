/**
 * Поле «время подачи» при создании заказа (readVehicleAtFromDom без мутации DOM).
 * Запуск: node web-preview/test/create-vehicle-time.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(path.join(root, 'app.js'), 'utf8');

function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `end marker not found after ${startMarker}`);
  return src.slice(start, end);
}

const timeBlock = sliceBetween(
  appSrc,
  'function parseRuDate(s)',
  'function wireVehicleAtHint',
);

const stubs = `
function $(id){ return (__dom && __dom[id]) || null; }
`;

const sandbox = { __dom: {} };
vm.runInNewContext(stubs + timeBlock, sandbox);

const {
  normalizeTimeHmInput,
  maskTimeHmInput,
  isTimeHmInputInProgress,
  timeHmForVehicleAtRead,
  fromRuDateTimeParts,
  readVehicleAtFromDom,
} = sandbox;

assert.equal(normalizeTimeHmInput('14:30'), '14:30');
assert.equal(normalizeTimeHmInput('1430'), '14:30');
assert.equal(normalizeTimeHmInput('9:05'), '09:05');
assert.equal(normalizeTimeHmInput('00:00'), '00:00');
assert.equal(normalizeTimeHmInput('23:59'), '23:59');
assert.equal(normalizeTimeHmInput(''), '');
assert.equal(normalizeTimeHmInput('25:00'), '25:00');

assert.equal(maskTimeHmInput('1430'), '14:30');
assert.equal(maskTimeHmInput('1'), '1');
assert.equal(maskTimeHmInput('14'), '14');

assert.equal(isTimeHmInputInProgress('1'), true);
assert.equal(isTimeHmInputInProgress('14'), true);
assert.equal(isTimeHmInputInProgress('14:3'), true);
assert.equal(isTimeHmInputInProgress('14:30'), false);
assert.equal(isTimeHmInputInProgress('9:05'), false);
assert.equal(isTimeHmInputInProgress('1430'), false);

assert.equal(timeHmForVehicleAtRead('1'), null);
assert.equal(normalizeTimeHmInput('1'), '01:00', 'normalize alone still pads single digit');
assert.equal(timeHmForVehicleAtRead('14:3'), null);
assert.equal(timeHmForVehicleAtRead('14:30'), '14:30');
assert.equal(timeHmForVehicleAtRead('1430'), '14:30');

const dom = sandbox.__dom;
dom['create-vehicle-date'] = { value: '16.10.2026' };
dom['create-vehicle-time'] = { value: '1' };
const before = dom['create-vehicle-time'].value;
const partial = readVehicleAtFromDom('create');
assert.equal(dom['create-vehicle-time'].value, before, 'read must not rewrite field on partial input');
assert.equal(partial, null);

dom['create-vehicle-time'].value = '14:30';
const iso = readVehicleAtFromDom('create');
assert.ok(iso);
const d = new Date(iso);
assert.equal(d.getDate(), 16);
assert.equal(d.getMonth(), 9);
assert.equal(d.getFullYear(), 2026);
assert.equal(d.getHours(), 14);
assert.equal(d.getMinutes(), 30);

const bad = fromRuDateTimeParts('16.10.2026', '25:00');
assert.equal(bad, null);

dom['d-vehicle-date'] = { value: '16.10.2026' };
dom['d-vehicle-time'] = { value: '09:15' };
assert.equal(readVehicleAtFromDom('d'), fromRuDateTimeParts('16.10.2026', '09:15'));

console.log('create-vehicle-time.test.mjs: OK');
