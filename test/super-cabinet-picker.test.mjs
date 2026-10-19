import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pickerSrc = readFileSync(path.join(root, 'admin-super-cabinet-picker.js'), 'utf8');
const adminSrc = readFileSync(path.join(root, 'admin.js'), 'utf8');
const testFnStart = adminSrc.indexOf('function isTestSpaceForSuperAdmin(sp)');
const testFnEnd = adminSrc.indexOf('function splitSpacesForSuperAdmin', testFnStart);

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sandbox = {
  esc,
  state: { spaces: [], adminOwnerFilter: 'all' },
  localStorage: {
    _m: new Map(),
    getItem(k) {
      return this._m.get(k) ?? null;
    },
    setItem(k, v) {
      this._m.set(k, String(v));
    },
  },
  findSpaceById(id) {
    return (sandbox.state.spaces || []).find((s) => s.id === id) || null;
  },
  isSuperAdmin() {
    return true;
  },
  findArmadaLogistCompany() {
    return null;
  },
  onSuperCabinetFilterPicked() {},
  paintAdminOwnerFilters() {},
  paintCatalogOwnerFilters() {},
};
vm.runInNewContext(adminSrc.slice(testFnStart, testFnEnd), sandbox);
vm.runInNewContext(pickerSrc, sandbox);

const {
  superCabinetPickerSpaces,
  cabinetSettingsEffectiveSpaceId,
  rememberSuperCabinetPick,
  isTestSpaceForSuperAdmin,
} = sandbox;

test('isTestSpaceForSuperAdmin: QA и ИП x', () => {
  assert.equal(isTestSpaceForSuperAdmin({ id: 'x', name: 'ИП ТЕСТ QA 01' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'x', name: 'QA smoke' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'x', name: 'ИП x' }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'x', name: 'ИП Реальный', isTest: true }), true);
  assert.equal(isTestSpaceForSuperAdmin({ id: 'x', name: 'ООО Восток' }), false);
});

test('superCabinetPickerSpaces: без тестовых, Армада первая после «Все»', () => {
  sandbox.state.spaces = [
    { id: 'sp-beta', name: 'Бета Транс' },
    { id: 'sp-arm', name: 'ООО «Армада»', inn: '7802655283' },
    { id: 'chain-par-1', name: 'Chain-par 1' },
  ];
  const rows = superCabinetPickerSpaces({ showTest: false, allowAll: true, allowNone: true });
  assert.equal(rows[0].id, 'all');
  assert.equal(rows[1].id, 'sp-arm');
  assert.ok(!rows.some((r) => r.id === 'chain-par-1'));
});

test('superCabinetPickerSpaces: поиск по ИНН', () => {
  sandbox.state.spaces = [
    { id: 'sp-arm', name: 'ООО «Армада»', inn: '7802655283' },
    { id: 'sp-other', name: 'Другая', inn: '1111111111' },
  ];
  const rows = superCabinetPickerSpaces({
    showTest: false,
    allowAll: false,
    allowNone: false,
    query: '7802655283',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'sp-arm');
});

test('cabinetSettingsEffectiveSpaceId: при «Все» — Армада или последний', () => {
  sandbox.state.spaces = [
    { id: 'sp-arm', name: 'ООО «Армада»' },
    { id: 'sp-nech', name: 'ИП Нечаев' },
  ];
  sandbox.state.adminOwnerFilter = 'all';
  rememberSuperCabinetPick('sp-nech');
  assert.equal(cabinetSettingsEffectiveSpaceId(), 'sp-nech');
  sandbox.localStorage._m.delete('armada_super_cabinet_last');
  assert.equal(cabinetSettingsEffectiveSpaceId(), 'sp-arm');
});
