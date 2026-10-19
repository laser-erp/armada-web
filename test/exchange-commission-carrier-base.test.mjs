/**
 * Комиссия биржи: база = цена перевозчику (не заказчику).
 * Запуск: node --test web-preview/test/exchange-commission-carrier-base.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadBillingSandbox() {
  const sb = loadTariffSandbox({
    bumpDataEpoch: () => {},
    looksClosedOrder: (o) => !!(o && o.closedAt),
  });
  vm.runInNewContext(readFileSync(path.join(ROOT, 'billing.js'), 'utf8'), sb, { filename: 'billing.js' });
  return sb;
}

describe('биржа — база комиссии от перевозчика', () => {
  it('без цены перевозчика base=0, даже если есть цена заказчика', () => {
    const sb = loadBillingSandbox();
    const order = { rateCash: 150000, freight: 150000, priceForClient: 150000 };
    assert.equal(sb.billingOrderCommissionBase(order), 0);
    assert.equal(sb.calcExchangeCommissionAmount(order, { commissionRate: 0.04 }), 0);
  });

  it('priceForCarrier 100000 и rate 4% → amount 4000', () => {
    const sb = loadBillingSandbox();
    const order = { priceForCarrier: 100000, rateCash: 200000 };
    assert.equal(sb.billingOrderCommissionBase(order), 100000);
    assert.equal(sb.calcExchangeCommissionAmount(order, { commissionRate: 0.04 }), 4000);
  });

  it('carrierPrice и min/cap', () => {
    const sb = loadBillingSandbox();
    assert.equal(
      sb.calcExchangeCommissionAmount({ carrierPrice: 1000 }, { commissionRate: 0.04 }),
      500,
      'минимум 500',
    );
    assert.equal(
      sb.calcExchangeCommissionAmount(
        { priceForCarrier: 10_000_000 },
        { commissionRate: 0.04, commissionCap: 15000 },
      ),
      15000,
      'потолок 15000',
    );
  });
});
