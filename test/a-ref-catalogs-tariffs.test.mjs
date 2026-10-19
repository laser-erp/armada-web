/**
 * Сценарий A — справочники и тарифы (docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md).
 * Запуск: node --test web-preview/test/a-ref-catalogs-tariffs.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadARefSandbox, wireDraftTariffDom, seedCompany } from './a-ref-harness.mjs';

const CO = 'qa-a-ref-co';
const EXPECTED_TYPE_IDS = [
  'board',
  'tent',
  'furgon',
  'ref',
  'iso',
  'gazelle',
  'medium',
  'heavy',
  'manipulator',
  'tral',
  'avtokran',
];

describe('A. Справочники и тарифы', () => {
  it('A1 — 11 типов ТС и матчинг reqBodyType / vehicleTypeIds с парком', () => {
    const sb = loadARefSandbox(CO);
    const fr = sb.armadaFleetRates;
    assert.equal(fr.RATES_BY_TYPE_IDS.length, 11);
    for (const id of EXPECTED_TYPE_IDS) {
      assert.ok(fr.RATES_BY_TYPE_IDS.includes(id), `нет типа ${id}`);
    }

    assert.equal(sb.bodyTypeOrderMatch('tent', 'tent'), true);
    assert.equal(sb.bodyTypeOrderMatch('ref', 'ref'), true);
    assert.equal(sb.bodyTypeOrderMatch('board', 'tent'), false);

    const fleet = [
      { plate: 'T1', bodyTypeId: 'tent', payloadTons: 10, bodyLengthM: 6, bodyWidthM: 2.4, bodyHeightM: 2.5 },
      { plate: 'R1', bodyTypeId: 'ref', payloadTons: 8, bodyLengthM: 6, bodyWidthM: 2.4, bodyHeightM: 2.5 },
    ];
    const byReq = sb.fleetVehiclesMatchingOrder(fleet, { reqBodyType: 'tent', reqPayloadTons: 5 });
    assert.equal(byReq.length, 1);
    assert.equal(byReq[0].plate, 'T1');

    const byIds = sb.fleetVehiclesMatchingOrder(fleet, { vehicleTypeIds: ['ref'], reqPayloadTons: 5 });
    assert.equal(byIds.length, 1);
    assert.equal(byIds[0].plate, 'R1');
  });

  it('A2 — shiftOptions: workHours + deliveryHours + price в rates', () => {
    const sb = loadARefSandbox(CO);
    const fr = sb.armadaFleetRates;
    const defaults = fr.defaultRates();
    const codes = defaults.city.shiftOptions.map((r) => r.code);
    assert.ok(codes.includes('3+1'));
    assert.ok(codes.includes('4+1'));
    assert.ok(codes.includes('5+1'));

    const row = { code: '4+1', workHours: 4, deliveryHours: 1, price: 16000 };
    const companyFmt = fr.shiftOptionToCompanyFormat(row);
    assert.equal(companyFmt.workHours, 4);
    assert.equal(companyFmt.deliveryHours, 1);
    assert.equal(companyFmt.price, 16000);
    assert.equal(fr.shiftOptionAmount(row), 16000);

    const legacy = { code: '5+1', shift: 18500 };
    assert.equal(fr.shiftOptionAmount(legacy), 18500);

    const blockHourly = {
      hourlyRate: 4100,
      shiftOptions: [{ code: '4+1', workHours: 4, deliveryHours: 1 }],
    };
    const blockLegacyPrice = {
      hourlyRate: 4100,
      shiftOptions: [{ code: '4+1', workHours: 4, deliveryHours: 1, price: 18000 }],
    };
    const ord41 = { cityShiftCode: '4+1' };
    assert.equal(fr.cityBasePriceFromHourlyAndShift(blockHourly, ord41), 20500);
    assert.equal(fr.cityBasePriceFromHourlyAndShift(blockLegacyPrice, ord41), 20500);
    assert.equal(fr.shiftEffectiveHourlyRate(blockHourly, ord41), 4100);
    assert.equal(fr.shiftEffectiveHourlyRate(blockLegacyPrice, ord41), 4100);
    const coHourly = {
      id: CO,
      ratesByType: [{ type: 'board', companyOverride: true, city: blockHourly }],
      ratesCorrectedByOwner: true,
    };
    const veh = { bodyTypeId: 'board', rates: null };
    const ordTrip = { cityShiftCode: '4+1', tripPrice: 18000 };
    assert.equal(fr.orderTripPrice(ordTrip), 18000);
    assert.equal(fr.shiftEffectiveHourlyRate(blockHourly, ordTrip), 0);
    for (const wh of [2, 5, 11, 9]) {
      const ordVar = Object.assign({}, ordTrip, { workHours: wh, orderPricingMode: 'trip' });
      const q = fr.calculateOrderPrice(veh, coHourly, ordVar, { distanceKm: 30 });
      assert.equal(q.base, 18000, `tripPrice workHours=${wh}`);
      assert.equal(q.total, 18000, `tripPrice workHours=${wh}`);
    }
  });

  it('A2b — виды оплаты: рейс / почасовая / смена (правило 11.10)', () => {
    const sb = loadARefSandbox(CO);
    const fr = sb.armadaFleetRates;
    const block = {
      hourlyRate: 4100,
      shiftOptions: [
        { code: '5+1', workHours: 5, deliveryHours: 1, isMinimum: true },
        { code: '7+1', workHours: 7, deliveryHours: 1 },
      ],
    };
    const co = {
      id: CO,
      ratesByType: [{ type: 'board', companyOverride: true, city: block }],
      ratesCorrectedByOwner: true,
    };
    const veh = { bodyTypeId: 'board', rates: null };

    const trip = { orderPricingMode: 'trip', tripPrice: 18000, workHours: 9 };
    assert.equal(fr.calculateOrderPrice(veh, co, trip, { distanceKm: 30 }).total, 18000);

    const hourly3 = { orderPricingMode: 'hourly', workHours: 3 };
    assert.equal(fr.calculateOrderPrice(veh, co, hourly3, { distanceKm: 30 }).total, 24600);

    const hourly8 = { orderPricingMode: 'hourly', workHours: 8 };
    assert.equal(fr.calculateOrderPrice(veh, co, hourly8, { distanceKm: 30 }).total, 32800);

    const shift71 = { orderPricingMode: 'shift', cityShiftCode: '7+1' };
    assert.equal(fr.carrierBaseForOrder(shift71, co), 32800);

    const noMinBlock = {
      hourlyRate: 4100,
      shiftOptions: [
        { code: '3+1', workHours: 3, deliveryHours: 1 },
        { code: '7+1', workHours: 7, deliveryHours: 1 },
      ],
    };
    const coNoMin = {
      id: CO,
      ratesByType: [{ type: 'board', companyOverride: true, city: noMinBlock }],
      ratesCorrectedByOwner: true,
    };
    const hourly3bare = { orderPricingMode: 'hourly', workHours: 3 };
    const qBare = fr.calculateOrderPrice(veh, coNoMin, hourly3bare, { distanceKm: 30 });
    assert.equal(qBare.total, 12300);
    assert.equal(qBare.hourlyMinimumMissing, true);
    assert.equal(fr.hourlyMinimumConfiguredForOrder(hourly3bare, coNoMin), false);

    const markedMin = {
      hourlyRate: 4100,
      shiftOptions: [
        { code: '3+1', workHours: 3, deliveryHours: 1 },
        { code: '7+1', workHours: 7, deliveryHours: 1, isMinimum: true },
      ],
    };
    const coMarked = {
      id: CO,
      ratesByType: [{ type: 'board', companyOverride: true, city: markedMin }],
      ratesCorrectedByOwner: true,
    };
    assert.equal(fr.minimumPackageHoursFromBlock(markedMin), 8);
    assert.equal(fr.calculateOrderPrice(veh, coMarked, hourly3bare, { distanceKm: 30 }).total, 32800);
  });

  it('A3 — vehicles[].rates null → наследование companies[].ratesByType', () => {
    const sb = loadARefSandbox(CO);
    const fr = sb.armadaFleetRates;
    const co = {
      id: CO,
      ratesByType: [
        {
          type: 'board',
          companyOverride: true,
          city: {
            hourlyRate: 4100,
            shiftOptions: [{ workHours: 4, deliveryHours: 1, price: 20500 }],
          },
          intercity: { perKm: 90 },
        },
      ],
      ratesCorrectedByOwner: true,
    };
    const vehInherited = { companyId: CO, bodyTypeId: 'board', rates: null };
    const inherited = fr.resolveRatesForVehicle(vehInherited, co);
    assert.equal(inherited.city.hourlyRate, 4100);
    assert.equal(fr.shiftOptionAmount(inherited.city.shiftOptions[0]), 20500);
    assert.equal(inherited._inheritedFromCompany, false);
    assert.equal(inherited._vehicleOverride, undefined);

    const vehOwn = {
      companyId: CO,
      bodyTypeId: 'board',
      rates: {
        correctedByOwner: true,
        city: { hourlyRate: 9999, shiftOptions: [{ code: '4+1', workHours: 4, deliveryHours: 1, price: 50000 }] },
      },
    };
    const own = fr.resolveRatesForVehicle(vehOwn, co);
    assert.equal(own.city.hourlyRate, 9999);
    assert.equal(own._vehicleOverride, true);

    const vehTopFlag = {
      companyId: CO,
      bodyTypeId: 'board',
      correctedByOwner: true,
      rates: { city: { hourlyRate: 7777, shiftOptions: [{ code: '4+1', workHours: 4, deliveryHours: 1 }] } },
    };
    const topResolved = fr.resolveRatesForVehicle(vehTopFlag, co);
    assert.equal(topResolved.city.hourlyRate, 7777);
    assert.equal(topResolved._vehicleOverride, true);

    const base = fr.carrierBaseForOrder({ reqBodyType: 'board', tripMode: 'city', routeKm: 30 }, co);
    assert.equal(base, 32800);

    const base41 = fr.carrierBaseForOrder(
      { reqBodyType: 'board', tripMode: 'city', routeKm: 30, cityShiftCode: '4+1' },
      co
    );
    assert.equal(base41, 20500);
    const base71 = fr.carrierBaseForOrder(
      { reqBodyType: 'board', tripMode: 'city', routeKm: 30, cityShiftCode: '7+1' },
      co
    );
    assert.equal(base71, 32800);
  });

  it('A4 — ручной расчёт: applyClientTariff и updatePerKmPreview', () => {
    const sb = loadARefSandbox(CO);
    const fin = {
      minWorkHours: 4,
      podachaHours: 1,
      podachaEmptyKmLimit: 20,
      defaultRatePerHourWork: 3000,
      defaultRatePerKmCash: 80,
      cityKmThreshold: 100,
    };
    const order = {
      id: 'ord-a4',
      ownCompanyId: CO,
      workHours: 5,
      emptyKmBefore: 0,
      loadedKm: 40,
      emptyKmAfter: 0,
    };
    const calc = sb.calculateClientTariff(order, fin);
    assert.equal(calc.totalCash, 18000);
    sb.applyClientTariff(order);
    assert.equal(order.rateCash, 18000);

    order.ratePerHourWork = 3500;
    order.workHours = 6;
    const calc2 = sb.calculateClientTariff(order, fin);
    assert.equal(calc2.totalCash, 6 * 3500 + 3500);

    wireDraftTariffDom(sb, {
      ratePerHourWork: 3000,
      workHours: 4,
      ratePerKmCash: 80,
      emptyKmAfter: 0,
      estimateKm: '',
    });
    sb.updatePerKmPreview(order);
    const preview = sb.document.getElementById('perkm-preview');
    assert.match(preview.innerHTML, /15\s?000|15000/);
    assert.match(preview.innerHTML, /Сумма нал/);
  });

  it('A5 — наценка агента percent / fixed / by_type и recommendedRate', () => {
    const sb = loadARefSandbox(CO);
    sb.state.admins = [
      { id: 'adm-agent', role: 'agent', markupPercent: 20, markupType: 'percent' },
    ];
    sb.currentAdmin = sb.state.admins[0];

    assert.equal(sb.clientPriceFromCarrier(10000, 'agent', { type: 'percent', value: 20 }), 12000);
    assert.equal(sb.clientPriceFromCarrier(10000, 'dispatcher'), 10000);
    assert.equal(sb.clientPriceFromCarrier(10000, 'agent', { type: 'fixed', value: 1500 }), 11500);
    assert.equal(sb.clientPriceFromCarrier(10000, 'agent', { type: 'by_type', value: 10 }), 11000);

    const rec10 = sb.recommendedRate(8000, 30, 10);
    const rec25 = sb.recommendedRate(8000, 30, 25);
    assert.equal(rec10, 16000);
    assert.equal(rec25, 22857.14);
    assert.ok(rec25 > rec10);
  });

  it('A6 — смена тарифа фирмы: существующие заказы не пересчитываются (H-UI-4, правило 12.10)', () => {
    const sb = loadARefSandbox(CO);
    const co = sb.state.companies[0];
    co.finance = {
      minWorkHours: 4,
      podachaHours: 1,
      defaultRatePerHourWork: 3000,
      defaultRatePerKmCash: 80,
      cityKmThreshold: 100,
    };
    const mk = (id, closed) => ({
      id,
      ownCompanyId: CO,
      workHours: 4,
      ratePerHourWork: 3000,
      ratePerKmCash: 80,
      emptyKmBefore: 0,
      loadedKm: 30,
      emptyKmAfter: 0,
      closedAt: closed ? '2026-10-10T18:00:00Z' : null,
      rateCash: 0,
      rateWithoutVat: 0,
      rateWithVat: 0,
      freight: 0,
    });
    const open = mk('o-open', false);
    sb.state.orders = [open, mk('o-closed', true)];
    assert.equal(sb.applyClientTariff(open), true);
    assert.equal(open.rateCash, 15000);

    co.finance.defaultRatePerHourWork = 4000;
    assert.equal(sb.recalculateOrderTariffsForCompany(CO), 0);
    assert.equal(open.rateCash, 15000);
    assert.equal(sb.state.orders[1].rateCash, 0);

    const fresh = Object.assign({}, mk('o-new', false), {
      createdAt: '2026-10-12T09:00:00.000Z',
      ratePerHourWork: 4000,
    });
    assert.equal(sb.applyClientTariff(fresh), true);
    assert.equal(fresh.rateCash, 20000);
  });

  it('A7 — автогенерация 10–12 перевозчиков: в приложении нет', () => {
    assert.equal(typeof globalThis.generateTestWorldCarriers, 'undefined');
    const sb = loadARefSandbox(CO);
    assert.equal(typeof sb.generateTestWorldCarriers, 'undefined');
  });
});
