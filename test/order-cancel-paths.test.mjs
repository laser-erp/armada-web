/**
 * Пути отмены заказа: единый applyOrderCancellation (H5 cancel_signed, логист, заказчик, водитель, API).
 * Запуск: node web-preview/test/order-cancel-paths.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOrderCancellation, normalizeOrderCancellationOnSave } from '../../armada-api/src/order-cancel.js';
import { mergeCustomerOrderIntoState } from '../../armada-api/src/routes/customer-orders.js';
import {
  baseOrder,
  loadOrderCancelSandbox,
  setSandboxAdmin,
  setSandboxCustomer,
  setSandboxDriver,
} from './order-cancel-harness.mjs';

function assertCancelFields(o, { reason, role, namePart }) {
  assert.ok(o.cancelledAt, 'cancelledAt');
  assert.equal(o.cancelReason, reason);
  assert.ok(o.cancelledBy, 'cancelledBy');
  if (role) assert.equal(o.cancelledBy.role, role);
  if (namePart) assert.ok(String(o.cancelledBy.name || '').includes(namePart));
}

// —— applyOrderCancellation (ядро) ——
{
  const o = baseOrder('o-core');
  applyOrderCancellation(o, {
    reason: 'Тест ядра',
    cancelledBy: { id: 'adm1', name: 'Логист', role: 'agent' },
    at: '2026-10-11T10:00:00.000Z',
  });
  assert.equal(o.cancelledAt, '2026-10-11T10:00:00.000Z');
  assertCancelFields(o, { reason: 'Тест ядра', role: 'agent', namePart: 'Логист' });
}

// —— cancelOrder (логист: список/карточка) ——
{
  const sb = loadOrderCancelSandbox();
  setSandboxAdmin(sb, { id: 'adm-h', name: 'Петров', role: 'dispatcher', spaceId: 'sp-test' });
  const o = baseOrder('o-admin', { ownerAdminId: 'adm-h' });
  sb.state.orders = [o];
  assert.equal(await sb.cancelOrder('o-admin', 'Отменён из списка'), true);
  assertCancelFields(o, { reason: 'Отменён из списка', role: 'dispatcher', namePart: 'Петров' });
  assert.equal(sb.assignedPending().some((x) => x.id === 'o-admin'), false);
}

// —— mergeLocalOrders: локальная отмена не теряется при stale GET /state (H-UI-1) ——
{
  const sb = loadOrderCancelSandbox();
  sb.state.orders = [{ id: 'o-stale', customer: 'QA', ownerAdminId: 'adm-h' }];
  const localCancelled = [
    {
      id: 'o-stale',
      customer: 'QA',
      ownerAdminId: 'adm-h',
      cancelledAt: '2026-10-12T08:00:00.000Z',
      cancelReason: 'перепроверка QA',
      cancelledBy: { id: 'adm-h', name: 'Петров', role: 'dispatcher' },
    },
  ];
  assert.equal(sb.mergeLocalOrders(localCancelled), true);
  assert.equal(sb.state.orders[0].cancelledAt, '2026-10-12T08:00:00.000Z');
}

// —— cancelOrder: дубликат в shift.orders + PATCH /admin/orders (карточка H-UI-1) ——
{
  const sb = loadOrderCancelSandbox();
  setSandboxAdmin(sb, { id: 'adm-h', name: 'Петров', role: 'dispatcher', spaceId: 'sp-test' });
  const o = baseOrder('o-shift-dup', { ownerAdminId: 'adm-h' });
  const stale = { ...o };
  sb.state.orders = [o];
  sb.state.shifts = [{ id: 'sh1', orders: [stale] }];
  let pushed = null;
  sb.persistAdminOrderImmediate = async (order) => {
    pushed = order;
    return { ok: true };
  };
  assert.equal(await sb.cancelOrder('o-shift-dup', 'перепроверка QA'), true);
  assert.ok(pushed && pushed.cancelledAt, 'PATCH /admin/orders с cancelledAt');
  assert.equal(sb.state.shifts[0].orders[0], o, 'смена ссылается на канонический заказ');
  assert.ok(sb.state.shifts[0].orders[0].cancelledAt, 'копия в смене не без cancelledAt');
}

// —— cancelOrderFromExchangeSigned (биржа H5) ——
{
  const sb = loadOrderCancelSandbox();
  setSandboxAdmin(sb, { id: 'adm-ex', name: 'Сидоров', role: 'agent' });
  const signed = baseOrder('o-signed', {
    bookStatus: 'confirmed',
    transportApp: { signedAt: '2026-10-12T10:00:00.000Z' },
    onExchange: false,
  });
  sb.cancelOrderFromExchangeSigned(signed, { penalty: 1000 });
  assert.ok(signed.cancelledAt, 'order.cancelledAt при cancel_signed');
  assert.equal(signed.bookStatus, 'cancelled');
  assert.ok(signed.transportApp.cancelledAt);
  assert.equal(signed.transportApp.cancellationPenalty, 1000);
  assert.equal(sb.orderBlocksOpenShiftGroup(signed), false);
}

// —— cancelOrderForCustomer (портал / API customer-orders) ——
{
  const sb = loadOrderCancelSandbox();
  setSandboxCustomer(sb, { companyId: 'co-cust', name: 'ООО Клиент' });
  const o = baseOrder('o-cust', { customerId: 'co-cust' });
  sb.state.orders = [o];
  assert.equal(sb.cancelOrderForCustomer('o-cust', 'Отмена заказчиком'), true);
  assertCancelFields(o, { reason: 'Отмена заказчиком', role: 'customer', namePart: 'Клиент' });
}

{
  const remote = { dataEpoch: 1, orders: [] };
  const order = {
    id: 'o-api',
    customerId: 'co-cust',
    customer: 'Клиент',
    bookStatus: 'cancelled',
    cancelReason: 'Через API',
  };
  const merged = mergeCustomerOrderIntoState(remote, { order });
  const stored = merged.orders.find((x) => x.id === 'o-api');
  assert.ok(stored.cancelledAt, 'API merge → cancelledAt');
  assert.equal(stored.cancelReason, 'Через API');
  assert.equal(stored.cancelledBy.role, 'customer');
}

// —— cancelOrderForDriver (водитель) ——
{
  const sb = loadOrderCancelSandbox();
  setSandboxDriver(sb, 'Иванов И.И.', 'sp-test');
  const o = baseOrder('o-drv');
  sb.state.orders = [o];
  assert.equal(sb.cancelOrderForDriver('o-drv', 'Не могу выехать'), true);
  assertCancelFields(o, { reason: 'Не могу выехать', role: 'driver', namePart: 'Иванов' });
}

// —— heal: bookStatus без cancelledAt ——
{
  const sb = loadOrderCancelSandbox();
  const o = baseOrder('o-heal', { bookStatus: 'cancelled', transportApp: { cancelledAt: '2026-10-01T12:00:00.000Z' } });
  assert.equal(sb.healOrderCancellationCanonical(o), true);
  assert.equal(o.cancelledAt, '2026-10-01T12:00:00.000Z');
}

// —— admin claim биржа: срочный → cancelOrderFromExchangeSigned (не только блок) ——
{
  const adminJs = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin.js'),
    'utf8',
  );
  const claimStart = adminJs.indexOf('function confirmClaimExchangeAfterGuard');
  assert.ok(claimStart >= 0, 'confirmClaimExchangeAfterGuard');
  const claimBlock = adminJs.slice(claimStart, claimStart + 4500);
  assert.match(claimBlock, /conflict\.urgent/, 'биржа: срочный конфликт отдельно от обычного');
  assert.match(claimBlock, /cancelOrderFromExchangeSigned/, 'биржа: отмена подписанного через единую функцию');
}

console.log('order-cancel-paths.test.mjs: ok');
