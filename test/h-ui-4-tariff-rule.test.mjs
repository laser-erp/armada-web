/**
 * H-UI-4 — смена тарифа перевозчика (правило Евгения 12.10 09:30).
 * Запуск: node --test web-preview/test/h-ui-4-tariff-rule.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadARefSandbox } from './a-ref-harness.mjs';

const CO = 'qa-h-ui-4-co';

function finV1() {
  return {
    minWorkHours: 4,
    podachaHours: 1,
    defaultRatePerHourWork: 3000,
    defaultRatePerKmCash: 80,
    cityKmThreshold: 100,
  };
}

function sampleOrder(id, extra = {}) {
  return {
    id,
    ownCompanyId: CO,
    createdAt: '2026-10-11T10:00:00.000Z',
    workHours: 4,
    emptyKmBefore: 0,
    loadedKm: 30,
    emptyKmAfter: 0,
    ratePerHourWork: 3000,
    ratePerKmCash: 80,
    rateCash: 0,
    rateWithoutVat: 0,
    rateWithVat: 0,
    freight: 0,
    ...extra,
  };
}

describe('H-UI-4 — тариф перевозчика без пересчёта старых заказов', () => {
  it('H-UI-4a — открытый и закрытый заказы не меняются после смены finance и recalculateOrderTariffsForCompany', () => {
    const sb = loadARefSandbox(CO);
    const co = sb.state.companies[0];
    co.finance = finV1();

    const open = sampleOrder('o-open');
    const closed = sampleOrder('o-closed', {
      closedAt: '2026-10-10T18:00:00Z',
      rateCash: 12000,
      freight: 12000,
    });
    sb.state.orders = [open, closed];
    assert.equal(sb.applyClientTariff(open), true);
    assert.equal(open.rateCash, 15000);

    co.finance = Object.assign({}, finV1(), { defaultRatePerHourWork: 5000 });
    assert.equal(sb.recalculateOrderTariffsForCompany(CO), 0);
    assert.equal(open.rateCash, 15000);
    assert.equal(open.ratePerHourWork, 3000);
    assert.equal(closed.rateCash, 12000);

    const cancelled = sampleOrder('o-cancel', {
      cancelledAt: '2026-10-09T12:00:00Z',
      rateCash: 11111,
    });
    sb.state.orders.push(cancelled);
    assert.equal(sb.recalculateOrderTariffsForCompany(CO), 0);
    assert.equal(cancelled.rateCash, 11111);
  });

  it('H-UI-4b — новый заказ после смены тарифа считается по новым ставкам (applyClientTariff)', () => {
    const sb = loadARefSandbox(CO);
    const co = sb.state.companies[0];
    co.finance = Object.assign({}, finV1(), { defaultRatePerHourWork: 4000 });

    const fresh = sampleOrder('o-new', {
      createdAt: '2026-10-12T09:00:00.000Z',
      ratePerHourWork: 4000,
      ratePerKmCash: 80,
    });
    assert.equal(sb.applyClientTariff(fresh), true);
    assert.equal(fresh.rateCash, 20000);
  });

  it('H-UI-4c — carrierBaseForOrder для новой заявки берёт актуальный ratesByType компании', () => {
    const sb = loadARefSandbox(CO);
    const co = sb.state.companies[0];
    const fr = sb.armadaFleetRates;
    co.ratesByType = [
      {
        type: 'board',
        companyOverride: true,
        city: {
          hourlyRate: 4100,
          shiftOptions: [{ code: '4+1', workHours: 4, deliveryHours: 1, price: 20500 }],
        },
      },
    ];
    co.ratesCorrectedByOwner = true;
    const orderDraft = { reqBodyType: 'board', tripMode: 'city', routeKm: 30, cityShiftCode: '4+1' };

    const baseOld = fr.carrierBaseForOrder(orderDraft, co);
    assert.equal(baseOld, 20500);

    co.ratesByType[0].city.hourlyRate = 5000;
    co.ratesByType[0].city.shiftOptions[0].price = 25000;

    const baseNew = fr.carrierBaseForOrder(orderDraft, co);
    assert.equal(baseNew, 25000);
    assert.ok(baseNew > baseOld);
  });
});
