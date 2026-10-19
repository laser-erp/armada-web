/**
 * F1-КМ: километраж и расчёты в таблице логиста (docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md).
 * Запуск: node --test web-preview/test/f1-km-kilometrage.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadF1KmSandbox,
  kmFromOdometers,
  manualMetrics,
} from './f1-km-harness.mjs';

const CO = 'qa-f1-km-co';
const PLATE = 'А111АА77';

function baseOrder(extra = {}) {
  return {
    id: 'o-f1',
    vehiclePlate: PLATE,
    ownCompanyId: CO,
    driverName: 'Тестовый водитель',
    driverPercent: 30,
    rateCash: 25000,
    payrollRate: 20000,
    rateWithoutVat: 18000,
    fuelPricePerLiter: 80,
    vehicleRent: 5000,
    salaryBonus: 1000,
    previousOdometer: 100000,
    departOdometer: 100000,
    ...extra,
  };
}

describe('F1-КМ километраж и таблица логиста', () => {
  const sb = loadF1KmSandbox(CO);
  const {
    dayTotal,
    dayTotalForAdmin,
    dayTotalAdminHint,
    driverShiftDayKm,
    driverDayKmDisplay,
    driverOrderTripKm,
    metrics,
    payrollRate,
    selectedRate,
    linkEmptyAfterFromNextEmptyBefore,
    sumOrderMoney,
    round2,
  } = sb;
  const DRIVER_DAY_KM_MAX = 2000;

  it('F1-КМ.1 порожний до = погрузка − выезд (выезд = ЕТО)', () => {
    const eto = 100000;
    const depart = 100000;
    const load = 100028;
    const calc = kmFromOdometers({ etoOdo: eto, departOdo: depart, loadOdo: load, unloadOdo: 100090 });
    assert.equal(calc.emptyKmBefore, 28);
    const o = baseOrder({
      startOdometer: load,
      endOdometer: 100090,
      emptyKmBefore: load - eto,
      loadedKm: 100090 - load,
    });
    assert.equal(o.emptyKmBefore, calc.emptyKmBefore);
    assert.equal(o.emptyKmBefore, load - depart);
  });

  it('F1-КМ.2 гружёный = выгрузка − погрузка', () => {
    const load = 100028;
    const unload = 100095;
    const calc = kmFromOdometers({
      etoOdo: 100000,
      departOdo: 100000,
      loadOdo: load,
      unloadOdo: unload,
    });
    assert.equal(calc.loadedKm, 67);
    const o = baseOrder({ startOdometer: load, endOdometer: unload, loadedKm: unload - load });
    assert.equal(o.loadedKm, calc.loadedKm);
  });

  it('F1-КМ.3 порожний после (последний заказ) = стоянка − выгрузка', () => {
    const unload = 100095;
    const parking = 100118;
    const calc = kmFromOdometers({
      etoOdo: 100000,
      departOdo: 100000,
      loadOdo: 100028,
      unloadOdo: unload,
      parkingOdo: parking,
    });
    assert.equal(calc.emptyKmAfter, 23);
    const o = baseOrder({
      endOdometer: unload,
      emptyKmAfter: parking - unload,
      loadedKm: 67,
      emptyKmBefore: 28,
    });
    assert.equal(o.emptyKmAfter, calc.emptyKmAfter);
  });

  it('F1-КМ.4 два заказа: порожний после 1-го = порожний до 2-го', () => {
    sb.state.orders = [];
    const o1 = baseOrder({
      id: 'o1',
      sequentialNumber: 1,
      closedAt: '2026-10-11T12:00:00',
      startOdometer: 100025,
      endOdometer: 100080,
      emptyKmBefore: 25,
      loadedKm: 55,
      emptyKmAfter: 0,
      linkEmptyAfterToNext: true,
      emptyAfterLinkedFromNext: false,
    });
    const o2 = baseOrder({
      id: 'o2',
      sequentialNumber: 2,
      startOdometer: 100095,
      endOdometer: 100140,
      emptyKmBefore: 15,
      loadedKm: 45,
      emptyKmAfter: null,
      departOdometer: 100080,
      previousOdometer: 100080,
    });
    sb.state.orders = [o1, o2];
    const prev = linkEmptyAfterFromNextEmptyBefore(o2);
    assert.ok(prev);
    assert.equal(prev.id, 'o1');
    assert.equal(prev.emptyKmAfter, 15);
    assert.equal(prev.emptyKmAfter, o2.emptyKmBefore);
    assert.equal(prev.emptyAfterLinkedFromNext, true);

    const sumKm = dayTotal(o1) + dayTotal(o2);
    const eto = 100000;
    const parking = 100160;
    const dayOdo = parking - eto;
    const shift = { odometer: eto, parkingOdometer: parking };
    assert.equal(dayTotal(o1), 25 + 55 + 15);
    assert.equal(dayTotal(o2), 15 + 45);
    assert.notEqual(sumKm, dayOdo, 'сумма dayTotal по строкам дублирует связку 15 км');
    const tot = sumOrderMoney([o1, o2], shift);
    assert.equal(tot.km, dayOdo);
    assert.notEqual(tot.km, sumKm);
  });

  it('F1-КМ.5 итого км по заказу = сумма трёх участков (dayTotal)', () => {
    const o = baseOrder({ emptyKmBefore: 12, loadedKm: 48, emptyKmAfter: 9 });
    assert.equal(dayTotal(o), 69);
    assert.equal(dayTotal(o), 12 + 48 + 9);
  });

  it('F1-КМ.6 км за день водителя и смена = стоянка − ЕТО', () => {
    const shift = {
      odometer: 100000,
      parkingOdometer: 100185,
      endedAt: '2026-10-11T20:00:00',
    };
    const orders = [
      baseOrder({ emptyKmBefore: 20, loadedKm: 60, emptyKmAfter: 5 }),
      baseOrder({ id: 'o2', emptyKmBefore: 0, loadedKm: 0, emptyKmAfter: 0 }),
    ];
    assert.equal(driverShiftDayKm(shift), 185);
    const disp = driverDayKmDisplay(shift, orders);
    assert.equal(disp.km, 185);
    assert.equal(disp.hint, '');
    const logistSum = sumOrderMoney(orders.filter((x) => x.id !== 'o2'));
    assert.equal(logistSum.km, dayTotal(orders[0]));
  });

  it('F1-КМ.7 metrics.km = dayTotal у закрытых заказов (одометр без «до стоянки»)', () => {
    sb.state.drivers = [{ name: 'Тестовый водитель', companyId: CO, salaryPercent: 30 }];
    const o = baseOrder({
      closedAt: '2026-10-11T15:00:00',
      startOdometer: 100020,
      endOdometer: 100095,
      previousOdometer: 100000,
      emptyKmBefore: 20,
      loadedKm: 75,
      emptyKmAfter: 15,
    });
    assert.equal(dayTotal(o), 110);
    const m = metrics(o);
    const payBase = payrollRate(o);
    const hand = manualMetrics(
      { ...o, payrollRate: payBase, rateCash: selectedRate(o) },
      m.cons,
      o.fuelPricePerLiter,
    );
    assert.equal(m.km, dayTotal(o));
    assert.equal(m.km, hand.km);
    assert.equal(m.fuelLitersCalc, hand.fuelLiters);
    assert.equal(m.fuelCostCalc, hand.fuelCost);
    assert.equal(m.cushion, hand.cushion);
    assert.equal(m.driverPay, hand.driverPay);
    assert.equal(m.netProfit, hand.netProfit);
    assert.equal(m.costPerKmNoVat, hand.costPerKmNoVat);
    assert.equal(m.km, 110);
    assert.notEqual(m.km, 95, 'kmParkingToEnd без emptyKmAfter давал бы 95');
    assert.equal(m.fuelLitersCalc, round2((110 * m.cons) / 100));
  });

  it('F1-КМ.7b metrics.km = dayTotal при двух закрытых заказах в смене', () => {
    sb.state.orders = [];
    const o1 = baseOrder({
      id: 'o1',
      sequentialNumber: 1,
      closedAt: '2026-10-11T12:00:00',
      startOdometer: 100025,
      endOdometer: 100080,
      previousOdometer: 100000,
      emptyKmBefore: 25,
      loadedKm: 55,
      emptyKmAfter: 0,
      linkEmptyAfterToNext: true,
      emptyAfterLinkedFromNext: false,
    });
    const o2 = baseOrder({
      id: 'o2',
      sequentialNumber: 2,
      closedAt: '2026-10-11T14:00:00',
      startOdometer: 100095,
      endOdometer: 100140,
      previousOdometer: 100080,
      emptyKmBefore: 15,
      loadedKm: 45,
      emptyKmAfter: 5,
      departOdometer: 100080,
    });
    sb.state.orders = [o1, o2];
    linkEmptyAfterFromNextEmptyBefore(o2);
    assert.equal(dayTotal(o1), 95);
    assert.equal(metrics(o1).km, 95);
    assert.equal(metrics(o2).km, dayTotal(o2));
    assert.equal(dayTotal(o2), 65);
  });

  it('F1-КМ.8 выброс > DRIVER_DAY_KM_MAX: у водителя и логиста «—», в суммы не входит', () => {
    assert.equal(DRIVER_DAY_KM_MAX, 2000);
    const shift = { odometer: 1000, parkingOdometer: 4500 };
    assert.equal(driverShiftDayKm(shift), null);
    const disp = driverDayKmDisplay(shift, []);
    assert.equal(disp.km, null);
    assert.equal(disp.hint, 'проверьте одометр ЕТО');
    const o = baseOrder({ emptyKmBefore: 500, loadedKm: 2500, emptyKmAfter: 100 });
    assert.equal(driverOrderTripKm(o), null);
    assert.equal(dayTotal(o), 3100);
    assert.equal(dayTotalForAdmin(o), null);
    assert.equal(dayTotalAdminHint(o), 'проверьте одометр');
    const tot = sumOrderMoney([o]);
    assert.equal(tot.km, 0);
  });
});
