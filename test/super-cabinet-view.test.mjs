/**
 * Супер в режиме одного кабинета: UI-фильтр не режет snapshot для PATCH /state.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadOrderSaveSandbox } from './order-save-409-harness.mjs';

function setCurrentAdmin(sb, row) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(row)}`, sb);
}

const sb = loadOrderSaveSandbox(async () => ({ ok: false, status: 404 }));
setCurrentAdmin(sb, { id: 'admin-super', name: 'Супер', isSuper: true, spaceId: 'sp-armada' });
sb.state.spaces = [
  { id: 'sp-armada', name: 'АРМАДА', ownCompanyId: 'co-a' },
  { id: 'sp-nech', name: 'ИП Нечаев', ownCompanyId: 'co-n' },
];
sb.state.companies = [
  { id: 'co-a', name: 'АРМАДА', spaceId: 'sp-armada', roles: ['own'] },
  { id: 'co-n', name: 'Нечаев', spaceId: 'sp-nech', roles: ['own'] },
];
sb.state.orders = [
  {
    id: 'o-a',
    spaceId: 'sp-armada',
    ownCompanyId: 'co-a',
    customer: 'A',
    ownerAdminId: 'admin-super',
  },
  { id: 'o-n', spaceId: 'sp-nech', ownCompanyId: 'co-n', customer: 'N', ownerAdminId: 'adm-nech' },
];
sb.state.adminOwnerFilter = 'sp-armada';

assert.equal(sb.superAdminCabinetViewActive(), true);
assert.equal(sb.adminSuperUiActive(), false);

const snap = sb.snapshot();
assert.equal(snap.spaces.length, 2, 'snapshot keeps all spaces');
assert.equal(snap.orders.length, 2, 'snapshot keeps all orders');

sb.localStorage.setItem('armada_admin_legacy_tenant_state', '1');
sb.localStorage.setItem('armada_admin_legacy_orders_shifts_state', '1');
const pushPayload = sb.snapshotForApiPush();
assert.equal(pushPayload.spaces.length, 2, 'PATCH payload keeps all spaces');
assert.equal((pushPayload.orders || []).length, 2, 'PATCH keeps all orders in memory');

assert.equal(sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'o-n')), false);
assert.equal(sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'o-a')), true);

sb.state.adminOwnerFilter = 'all';
assert.equal(sb.adminSuperUiActive(), true);
assert.equal(sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'o-n')), true);

console.log('super-cabinet-view tests passed');
