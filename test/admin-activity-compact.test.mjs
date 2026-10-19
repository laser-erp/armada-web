import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminSrc = readFileSync(path.join(root, 'admin.js'), 'utf8');
const start = adminSrc.indexOf('function isTestSpaceForSuperAdmin(sp)');
const end = adminSrc.indexOf('function renderAdminActivity()', start);
assert.ok(start >= 0 && end > start, 'slice admin.js: activity helpers');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const stubs = `
function activityLogWhen(at){
  try{
    return new Date(at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }catch(_){ return '—'; }
}
`;
const sandbox = { esc };
vm.runInNewContext(stubs + adminSrc.slice(start, end), sandbox);
const {
  isTestSpaceForSuperAdmin,
  splitSpacesForSuperAdmin,
  renderOpsLogHtml,
} = sandbox;

test('isTestSpaceForSuperAdmin', () => {
  assert.equal(isTestSpaceForSuperAdmin({ id: 'chain-par-1', name: 'Chain 1' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'load-1015-x', name: 'X' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'staging-space', name: 'Тестовое пространство' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'armada', name: 'ООО «Армада»' }), false);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'real-co', name: 'ИП Реальный' }), false);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'qa1', name: 'QA smoke' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'ipx', name: 'ИП x' }), true);
});

test('splitSpacesForSuperAdmin: 2 real + 3 test', () => {
  const spaces = [
    { id: 'chain-par-2', name: 'Chain-par 2' },
    { id: 'chain-par-1', name: 'Chain-par 1' },
    { id: 'staging-space', name: 'Тестовое пространство' },
    { id: 'ooo-vostok', name: 'ООО Восток' },
    { id: 'ip-sever', name: 'ИП Север' },
  ];
  const { real, test } = splitSpacesForSuperAdmin(spaces);
  assert.equal(real.length, 2);
  assert.equal(test.length, 3);
  assert.ok(real.every((sp) => !String(sp.id).startsWith('chain-par-')));
  assert.ok(test.some((sp) => sp.id === 'chain-par-1'));
});

test('renderOpsLogHtml and test fold labels', () => {
  const opsHtml = renderOpsLogHtml([
    { at: '2026-10-15T10:00:00Z', kind: 'etrn', detail: 'ok' },
  ]);
  assert.match(opsHtml, /Технический журнал ЭТрН/);
  assert.match(opsHtml, /<details class="activity-log-fold">/);
  assert.match(opsHtml, /Для разбора ошибок ЭТрН/);

  const { real, test } = splitSpacesForSuperAdmin([
    { id: 'real-1', name: 'Бета' },
    { id: 'chain-par-9', name: 'Chain-par 9' },
    { id: 'chain-par-8', name: 'Chain-par 8' },
    { id: 'chain-par-7', name: 'Chain-par 7' },
    { id: 'real-2', name: 'Альфа' },
  ]);
  const mainEpd = real.map((sp) => sp.name).join('|');
  assert.ok(!mainEpd.includes('Chain-par'), 'chain-par only in test group');
  assert.equal(test.length, 3);
  const foldSummary = `Тестовые пространства · ${test.length}`;
  assert.equal(foldSummary, 'Тестовые пространства · 3');
});
