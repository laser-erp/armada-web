/**
 * QA раздел B «Тарификация заказа» (docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md).
 * Запуск: node --test web-preview/test/b-tariff-scenarios.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadTariffSandbox,
  seedCompany,
  round2,
} from '../../scripts/qa-tariff-harness.mjs';

const CO_ID = 'qa-co-b-tariff';

function finBase() {
  return {
    minWorkHours: 4,
    podachaHours: 1,
    podachaEmptyKmLimit: 20,
    defaultRatePerHourWork: 3000,
    defaultRatePerKmCash: 80,
    cityKmThreshold: 100,
    ratePerKmOutsideKad: 95,
  };
}

describe('B. Тарификация заказа (сценарии тестового мира)', () => {
  it('B1 почасовой пакет — minWorkHours, ratePerHourWork', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const cases = [
      { o: { workHours: 5, emptyKmBefore: 0, loadedKm: 40, emptyKmAfter: 0 }, expect: 18000 },
      { o: { workHours: 6, estimateWorkHours: 6, emptyKmBefore: 5, loadedKm: 30, emptyKmAfter: 5 }, expect: 21000 },
      { o: { workHours: 3, emptyKmBefore: 0, loadedKm: 20, emptyKmAfter: 0 }, expect: 15000 },
    ];
    for (const c of cases) {
      const r = sb.calculateClientTariff(c.o, fin);
      assert.ok(r, 'calculateClientTariff');
      assert.equal(r.totalCash, c.expect, JSON.stringify(c.o));
      assert.match(r.summary, /работа \d+ ч/);
    }
  });

  it('B2 смена: findTariffRuleForOrder + tripPrice в заявке', () => {
    const sb = loadTariffSandbox();
    seedCompany(sb, CO_ID);
    const fin = sb.financeForCompanyId(CO_ID);
    const pick = sb.findTariffRuleForOrder({ reqBodyType: 'board', reqPayloadTons: 3 }, fin);
    assert.equal(pick.missingRate, false);
    assert.equal(pick.finance.defaultRatePerHourWork, 3000);

    const fromRule = sb.calculateClientTariff(
      { workHours: 2, emptyKmBefore: 0, loadedKm: 10, emptyKmAfter: 0 },
      pick.finance
    );
    assert.equal(fromRule.totalCash, 15000);

    sb.armadaFleetRates.setCatalogTariffRules([
      {
        code: 'board_default',
        group: 'board',
        data: {
          vehicleType: 'board',
          rates: {
            city: {
              hourlyRate: 2250,
              shiftOptions: [{ workHours: 7, deliveryHours: 1, price: 22000 }],
            },
            intercity: { perKm: 87 },
          },
        },
      },
    ]);
    const co = {
      id: CO_ID,
      ratesByType: [
        {
          type: 'board',
          companyOverride: true,
          city: {
            hourlyRate: 2250,
            shiftOptions: [{ workHours: 7, deliveryHours: 1, price: 22000 }],
          },
          intercity: { perKm: 87 },
        },
      ],
      ratesCorrectedByOwner: true,
    };
    const shiftBase = sb.armadaFleetRates.carrierBaseForOrder(
      { vehicleTypeIds: ['board'], tripMode: 'city', routeKm: 50 },
      co
    );
    assert.equal(shiftBase, 2250 * 8);
    const row = co.ratesByType[0].city.shiftOptions[0];
    assert.equal(sb.armadaFleetRates.shiftOptionAmount(row), 22000);
    const legacyCity = sb.armadaFleetRates.resolveRatesForVehicle(
      { bodyTypeId: 'board', rates: null },
      co
    ).city;
    assert.equal(sb.armadaFleetRates.shiftEffectiveHourlyRate(legacyCity, { cityShiftCode: '7+1' }), 2250);
    for (const wh of [1, 5, 12]) {
      const base = sb.armadaFleetRates.carrierBaseForOrder(
        {
          vehicleTypeIds: ['board'],
          tripMode: 'city',
          routeKm: 50,
          cityShiftCode: '7+1',
          workHours: wh,
          tripPrice: 22000,
        },
        co
      );
      assert.equal(base, 22000, `tripPrice в заявке при workHours=${wh}`);
    }
  });

  it('B3 переработка / сверх км (cityKmThreshold, packageKm)', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const cases = [
      { o: { workHours: 4, loadedKm: 70, emptyKmBefore: 0, emptyKmAfter: 0 }, expect: 15000, excessKm: 0 },
      { o: { workHours: 5, emptyKmBefore: 10, loadedKm: 95, emptyKmAfter: 15 }, expect: 19600, excessKm: 20 },
      { o: { workHours: 2, emptyKmBefore: 10, loadedKm: 100, emptyKmAfter: 10 }, expect: 16600, excessKm: 20 },
    ];
    for (const c of cases) {
      const r = sb.calculateClientTariff(c.o, fin);
      assert.equal(r.totalCash, c.expect);
      assert.equal(r.excessKm, c.excessKm);
    }
  });

  it('B4 минималка часов max(факт, minWorkHours)', () => {
    const sb = loadTariffSandbox();
    const fin = Object.assign(finBase(), { minWorkHours: 5 });
    const cases = [
      { workHours: 2, expectWorkCharged: 5, expectTotal: 5 * 3000 + 3000 },
      { workHours: 5, expectWorkCharged: 5, expectTotal: 18000 },
      { workHours: 7, expectWorkCharged: 7, expectTotal: 7 * 3000 + 3000 },
    ];
    for (const c of cases) {
      const r = sb.calculateClientTariff(
        { workHours: c.workHours, emptyKmBefore: 0, loadedKm: 30, emptyKmAfter: 0 },
        fin
      );
      assert.equal(r.totalCash, c.expectTotal);
      assert.match(r.summary, new RegExp(`работа ${c.expectWorkCharged} ч`));
    }
  });

  it('B5 подача 1–2 ч (emptyKmBefore, podachaEmptyKmLimit)', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const baseWork = 4 * 3000;
    const cases = [
      { o: { workHours: 4, emptyKmBefore: 15, loadedKm: 20, emptyKmAfter: 0 }, podachaH: 1, expect: baseWork + 3000 },
      { o: { workHours: 4, emptyKmBefore: 25, loadedKm: 20, emptyKmAfter: 0 }, podachaH: 2, expect: baseWork + 6000 },
      { o: { workHours: 4, emptyKmBefore: 18, loadedKm: 20, emptyKmAfter: 0 }, podachaH: 1, expect: baseWork + 3000 },
    ];
    for (const c of cases) {
      const r = sb.calculateClientTariff(c.o, fin);
      assert.equal(r.podachaHoursCharged, c.podachaH);
      assert.equal(r.totalCash, c.expect);
    }
  });

  it('B6 межгород ₽/км (tripMode intercity, suggestCustomerOrderPrice)', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();

    const cityInter = sb.calculateClientTariff(
      { tripMode: 'intercity', workHours: 4, emptyKmBefore: 10, loadedKm: 100, emptyKmAfter: 10 },
      fin
    );
    assert.equal(cityInter.totalCash, 16900);

    const r2 = sb.calculateClientTariff(
      { tripMode: 'intercity', workHours: 4, emptyKmBefore: 0, loadedKm: 250, emptyKmAfter: 0 },
      fin
    );
    assert.equal(r2.totalCash, 29250);

    seedCompany(sb, CO_ID);
    const quote = sb.suggestCustomerOrderPrice({
      ownCompanyId: CO_ID,
      routeKm: 250,
      tripMode: 'intercity',
      fulfillment: 'direct',
      reqBodyType: 'board',
      estimateWorkHours: 4,
      loadedKm: 230,
      emptyKmBefore: 10,
      emptyKmAfter: 10,
    });
    assert.equal(quote.minimumCash, 29250);

    seedCompany(sb, CO_ID, { defaultRatePerHourWork: 0, tariffRules: [] });
    const onlyKm = sb.suggestCustomerOrderPrice({
      ownCompanyId: CO_ID,
      routeKm: 250,
      tripMode: 'intercity',
      fulfillment: 'direct',
      reqBodyType: 'board',
    });
    assert.equal(onlyKm.minimumCash, 250 * 95);
    assert.equal(onlyKm.tariffMissing, true);
  });

  it('B7 deliveryHours смены не связаны с timeLoadedHours автоматически', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const shift = { workHours: 4, deliveryHours: 1, price: 16000 };
    assert.equal(sb.armadaFleetRates.shiftOptionAmount(shift), 16000);

    const oFact = {
      workHours: 2,
      timeLoadedHours: 9,
      emptyKmBefore: 0,
      loadedKm: 40,
      emptyKmAfter: 0,
    };
    const r = sb.calculateClientTariff(oFact, fin);
    assert.equal(r.totalCash, 15000, 'считаем workHours/minWork, не timeLoadedHours');
    assert.match(r.summary, /работа 4 ч/);

    const oOnlyLoaded = {
      timeLoadedHours: 9,
      emptyKmBefore: 0,
      loadedKm: 40,
      emptyKmAfter: 0,
    };
    const r2 = sb.calculateClientTariff(oOnlyLoaded, fin);
    assert.equal(r2.totalCash, 15000, 'без workHours — estimateWorkHours 0, минимум 4 ч');

    const order = { workHours: 0, timeLoadedHours: 6 };
    if (!(order.workHours > 0) && order.timeLoadedHours > 0) order.workHours = +order.timeLoadedHours;
    assert.equal(order.workHours, 6, 'подстановка workHours из timeLoadedHours только при закрытии (паттерн app.js)');
    const afterClose = sb.calculateClientTariff(
      { workHours: order.workHours, emptyKmBefore: 0, loadedKm: 30, emptyKmAfter: 0 },
      fin
    );
    assert.equal(afterClose.totalCash, 6 * 3000 + 3000);
  });

  it('B8 хранение на стоянке (overnightNights, markStaysLoadedOvernight)', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const base = 4 * 3000 + 3000;

    const withStorage = sb.calculateClientTariff(
      {
        workHours: 4,
        emptyKmBefore: 0,
        loadedKm: 20,
        emptyKmAfter: 0,
        overnightNights: 2,
        overnightStorageRateCash: 2500,
      },
      fin
    );
    assert.equal(withStorage.storageCash, 5000);
    assert.equal(withStorage.totalCash, base + 5000);
    assert.match(withStorage.summary, /хранение 2×2500/);

    const order = { overnightNights: 1, staysLoadedOvernight: false };
    sb.markStaysLoadedOvernight(order);
    assert.equal(order.staysLoadedOvernight, true);
    assert.equal(order.overnightNights, 2);
    assert.equal(sb.payrollRate({ rateCash: 20000, overnightStorageRateCash: 2500, overnightNights: 2 }), 15000);
  });

  it('B8b ночная котировка: vehicleAt ночью и тег night (не «сейчас» днём)', () => {
    const sb = loadTariffSandbox();
    const co = seedCompany(sb, CO_ID);
    co.ratesCorrectedByOwner = true;
    co.ratesByType = [
      {
        type: 'board',
        companyOverride: true,
        city: {
          hourlyRate: 2250,
          shiftOptions: [{ code: '7+1', workHours: 7, deliveryHours: 1, price: 22000 }],
        },
        intercity: { perKm: 87 },
      },
    ];
    co.acceptanceRules = sb.armadaFleetRates.defaultAcceptanceRules();
    const vehicle = sb.state.vehicles[0];
    const dayNow = new Date('2026-10-12T12:00:00+03:00');
    const nightVehicleAt = '2026-10-13T23:30:00+03:00';
    const order = {
      orderPricingMode: 'shift',
      cityShiftCode: '7+1',
      pricingUrgency: 'night',
      vehicleAt: nightVehicleAt,
      reqBodyType: 'board',
      vehicleTypeIds: ['board'],
      tripMode: 'city',
      routeKm: 40,
    };
    const tags = sb.armadaFleetRates.urgencyTagsForOrder(order, co, dayNow);
    assert.ok(tags.includes('night'), `tags=${JSON.stringify(tags)}`);
    const quote = sb.armadaFleetRates.calculateOrderPrice(vehicle, co, order, { now: dayNow });
    assert.ok(quote.tags.includes('night'), `quote.tags=${JSON.stringify(quote.tags)}`);
    assert.ok(quote.multiplier > 1.01, `multiplier=${quote.multiplier}`);
    const base = 2250 * 8;
    assert.equal(quote.base, base);
    assert.equal(quote.total, Math.round(base * quote.multiplier));
  });

  it('B8d смена 7+1: applyClientTariff при закрытии не сбрасывает rateCash на почасовой пакет', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const nightRate = 26400;
    const order = {
      orderPricingMode: 'shift',
      cityShiftCode: '7+1',
      rateCash: nightRate,
      priceForClient: nightRate,
      workHours: 2,
      timeLoadedHours: 2,
      ratePerHourWork: 1750,
      emptyKmBefore: 0,
      loadedKm: 40,
      emptyKmAfter: 0,
    };
    const legacy = sb.calculateClientTariff(order, fin);
    assert.ok(legacy && legacy.totalCash > 0 && legacy.totalCash < nightRate, `legacy=${legacy?.totalCash}`);
    sb.applyClientTariff(order);
    assert.equal(order.rateCash, nightRate);
  });

  it('B8e смена 7+1: applyClientTariff без fleet-rates (как на /v водителя)', () => {
    const sb = loadTariffSandbox();
    const fin = finBase();
    const nightRate = 26400;
    const order = {
      orderPricingMode: 'shift',
      cityShiftCode: '7+1',
      rateCash: nightRate,
      workHours: 4,
      ratePerHourWork: 1750,
      emptyKmBefore: 10,
      loadedKm: 35,
      emptyKmAfter: 8,
    };
    const prevFr = sb.armadaFleetRates;
    sb.armadaFleetRates = null;
    sb.applyClientTariff(order);
    sb.armadaFleetRates = prevFr;
    assert.equal(order.rateCash, nightRate);
    const legacy = sb.calculateClientTariff(order, fin);
    assert.ok(legacy && legacy.totalCash === 8750, `legacy=${legacy?.totalCash}`);
  });

  it('B8f QA-close: calculateClientTariff для смены 7+1 — флот+хранение, не legacy 8750/11250', () => {
    const sb = loadTariffSandbox();
    const co = seedCompany(sb, CO_ID, {
      defaultRatePerHourWork: 1750,
      minWorkHours: 4,
      podachaHours: 1,
      podachaEmptyKmLimit: 20,
      cityKmThreshold: 100,
      defaultRatePerKmCash: 80,
    });
    const nightVehicleAt = '2026-10-13T23:30:00+03:00';
    const draft = {
      ownCompanyId: CO_ID,
      fulfillment: 'direct',
      orderPricingMode: 'shift',
      cityShiftCode: '7+1',
      pricingUrgency: 'night',
      vehicleAt: nightVehicleAt,
      reqBodyType: 'board',
      vehicleTypeIds: ['board'],
      tripMode: 'city',
      routeKm: 40,
    };
    const quote = sb.suggestDispatcherOrderPrice(draft);
    assert.ok(quote && quote.minimumCash > 0, 'quote');
    const order = {
      ...draft,
      rateCash: Math.round(quote.minimumCash),
      priceForClient: Math.round(quote.minimumCash),
      workHours: 4,
      emptyKmBefore: 10,
      loadedKm: 35,
      emptyKmAfter: 8,
      overnightStorageRateCash: 2500,
      overnightNights: 0,
    };
    sb.markStaysLoadedOvernight(order);
    const fin = sb.financeForCompanyId(CO_ID);
    const calc = sb.calculateClientTariff(order, fin);
    assert.ok(calc, 'calculateClientTariff');
    const veh = sb.armadaFleetRates.vehicleForOrderPricing(order, CO_ID);
    const fq = sb.armadaFleetRates.calculateOrderPrice(veh, co, order, {
      now: new Date(nightVehicleAt),
    });
    const expectTotal = fq.total + (calc.storageCash || 0);
    assert.notEqual(calc.totalCash, 8750, 'не legacy 5×1750');
    assert.notEqual(calc.totalCash, 11250, 'не legacy пакет+хранение без флота');
    assert.equal(calc.totalCash, expectTotal, `calc=${calc.totalCash} expect=${expectTotal}`);
  });

  it('B8c ночная смена 7+1: suggestDispatcherOrderPrice с тегом/лейблом «ноч»', () => {
    const sb = loadTariffSandbox();
    const co = seedCompany(sb, CO_ID);
    co.ratesCorrectedByOwner = true;
    co.ratesByType = [
      {
        type: 'board',
        companyOverride: true,
        city: {
          hourlyRate: 2250,
          shiftOptions: [{ code: '7+1', workHours: 7, deliveryHours: 1, price: 22000 }],
        },
        intercity: { perKm: 87 },
      },
    ];
    co.acceptanceRules = sb.armadaFleetRates.defaultAcceptanceRules();
    const nightVehicleAt = '2026-10-13T23:30:00+03:00';
    const draft = {
      ownCompanyId: CO_ID,
      fulfillment: 'direct',
      orderPricingMode: 'shift',
      cityShiftCode: '7+1',
      pricingUrgency: 'night',
      vehicleAt: nightVehicleAt,
      reqBodyType: 'board',
      vehicleTypeIds: ['board'],
      tripMode: 'city',
      routeKm: 40,
      vehiclePlate: 'А111АА77',
    };
    const quote = sb.suggestDispatcherOrderPrice(draft);
    assert.ok(quote && quote.minimumCash > 0, 'quote');
    const tagHit =
      (Array.isArray(quote.tags) && quote.tags.some((t) => /night/i.test(String(t)))) ||
      (Array.isArray(quote.surchargeLabels) &&
        quote.surchargeLabels.some((l) => /ноч/i.test(String(l))));
    assert.ok(tagHit, `tags=${JSON.stringify(quote.tags)} labels=${JSON.stringify(quote.surchargeLabels)}`);
    assert.ok(quote.multiplier > 1.01, `multiplier=${quote.multiplier}`);
  });
});
