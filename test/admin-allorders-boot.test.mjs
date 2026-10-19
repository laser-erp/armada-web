/**
 * /a/: admin.js до app.js; loginAdmin → renderAdmin → updateAdminEtrnSignBadge требует allOrders.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  adminRouteScriptBundle,
  loadAdminBootScripts,
} from './admin-boot-harness.mjs';

function setCurrentAdmin(sandbox, row) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(row)}`, sandbox);
}

test('boot /a/: store.js и admin.js до app.js', () => {
  const b = adminRouteScriptBundle();
  const storeIdx = b.indexOf('store.js');
  const adminIdx = b.indexOf('admin.js');
  const appIdx = b.indexOf('app.js');
  assert.ok(storeIdx >= 0 && adminIdx > storeIdx, 'store до admin');
  assert.ok(adminIdx > storeIdx, 'admin после store');
  assert.ok(appIdx > adminIdx, 'admin.js before app.js');
});

test('allOrders после store.js (до app.js)', () => {
  const { sandbox } = loadAdminBootScripts('store.js');
  assert.equal(typeof sandbox.allOrders, 'function', 'перенести allOrders в store.js');
  sandbox.state.orders = [
    { id: 'o2', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'o1', createdAt: '2026-01-01T00:00:00Z' },
  ];
  const ids = sandbox.allOrders().map((o) => o.id);
  assert.deepEqual(ids, ['o2', 'o1']);
});

test('renderAdmin после admin.js без app.js — как loginAdmin при заказах в state', () => {
  const { sandbox } = loadAdminBootScripts('admin.js');
  assert.equal(typeof sandbox.renderAdmin, 'function');
  setCurrentAdmin(sandbox, { id: 'adm1', name: 'Логист', isSuper: false, spaceId: 'sp1' });
  vm.runInContext(
    `state.orders = [{ id: 'o1', createdAt: '2026-01-01T00:00:00Z', ownerAdminId: 'adm1' }];`,
    sandbox,
  );
  let err = null;
  try {
    sandbox.renderAdmin();
  } catch (e) {
    err = e;
  }
  assert.ok(!err, err ? `ожидали без ошибки до app.js: ${err.message}` : 'renderAdmin ok');
});
