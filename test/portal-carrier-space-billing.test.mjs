/**
 * Портал: space перевозчика для create_order — без fallback на space заказчика.
 * Запуск: node --test web-preview/test/portal-carrier-space-billing.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadBillingAppSandbox() {
  const sb = loadTariffSandbox();
  vm.runInNewContext(readFileSync(path.join(ROOT, 'billing.js'), 'utf8'), sb, { filename: 'billing.js' });
  return sb;
}

describe('портал — space перевозчика и create_order', () => {
  it('carrierSpaceIdForPortalOrder не подставляет spaceId карточки заказчика', () => {
    const sb = loadBillingAppSandbox();
    const customerCo = { id: 'co-cust', spaceId: 'sp-customer-only' };
    const carrierNoSpace = { id: 'co-carrier', roles: ['own'] };
    const sid = sb.carrierSpaceIdForPortalOrder(carrierNoSpace, customerCo);
    assert.equal(sid, null);
  });

  it('billingGuard(create_order) без spaceId — явный отказ, не ok', () => {
    const sb = loadBillingAppSandbox();
    const g = sb.billingGuard(null, 'create_order');
    assert.equal(g.ok, false);
    assert.ok(g.message && String(g.message).length > 0);
  });
});
