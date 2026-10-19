/**
 * Портал /z: «Повторить» — какие поля копируются, дата пустая, новый номер при отправке.
 * node --test web-preview/test/customer-repeat-order.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadAppSlice() {
  const src = readFileSync(path.join(WP, 'app.js'), 'utf8');
  const start = src.indexOf('function orderAddressByKind');
  const end = src.indexOf('function looksClosedOrder', start);
  assert.ok(start >= 0 && end > start, 'orderRepeat slice');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(src.slice(start, end), sandbox);
  return sandbox;
}

test('orderRepeatSourceFields — копирует груз, маршрут, контакты, кузов, способы', () => {
  const { orderRepeatSourceFields } = loadAppSlice();
  const o = {
    id: 'ord-old',
    sequentialNumber: 42,
    closedAt: '2026-10-01T12:00:00.000Z',
    vehicleAt: '2026-10-01T08:00:00.000Z',
    priceForClient: 50000,
    rateCash: 48000,
    loadingAddress: 'Москва, склад 1',
    unloadingAddress: 'Тула, завод',
    loadingContactName: 'Иван',
    loadingContactPhone: '+79001112233',
    cargoDescription: 'Паллеты',
    cargoKind: 'general',
    reqPayloadTons: 3,
    vehicleTypeIds: ['tent'],
    loadingMethods: ['rear'],
    unloadingMethods: ['side'],
    loadingAddressNote: 'со двора',
    unloadingAddressNote: 'на рампу',
    contactName: 'Петр',
    contactPhone: '+79004445566',
  };
  const rep = orderRepeatSourceFields(o);
  assert.equal(rep.loadingAddress, 'Москва, склад 1');
  assert.equal(rep.unloadingAddress, 'Тула, завод');
  assert.equal(rep.cargoDescription, 'Паллеты');
  assert.equal(rep.loadingContactName, 'Иван');
  assert.deepEqual(rep.vehicleTypeIds, ['tent']);
  assert.deepEqual(rep.loadingMethods, ['rear']);
  assert.equal(rep.loadingAddressNote, 'со двора');
  assert.equal(rep.contactName, 'Петр');
  assert.equal(rep.priceForClient, undefined);
  assert.equal(rep.sequentialNumber, undefined);
  assert.equal(rep.vehicleAt, undefined);
});

test('customerApplyRepeatSourceToForm — дата и цена пустые', () => {
  const customerSrc = readFileSync(path.join(WP, 'customer.js'), 'utf8');
  assert.match(customerSrc, /function customerClearRepeatPricingFields/);
  assert.match(customerSrc, /cust-vehicle-date/);
  assert.match(customerSrc, /orderRepeatSourceFields/);
  assert.match(customerSrc, /function customerRepeatOrderById/);
});

test('submit создаёт новый sequentialNumber (контракт в customer.js)', () => {
  const customerSrc = readFileSync(path.join(WP, 'customer.js'), 'utf8');
  assert.match(customerSrc, /nextSequentialNumber\(\)/);
  assert.match(customerSrc, /persistCustomerPortalOrderImmediate/);
});
