/**
 * Песочница F1-КМ: функции км и metrics из app.js + sumOrderMoney из admin.js.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox, seedCompany } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = path.join(ROOT, 'admin.js');

export function loadF1KmSandbox(companyId = 'qa-f1-km-co') {
  const sb = loadTariffSandbox({ DRIVER: 'Тестовый водитель' });
  seedCompany(sb, companyId);
  sb.API_BASE = '';
  sb.persist = () => {};
  sb.pushServerState = async () => {};
  sb.pushServerStateQueued = async () => {};
  sb.applyClientTariff = () => {};
  const adminSrc = readFileSync(ADMIN, 'utf8');
  const sumStart = adminSrc.indexOf('function sumOrderMoney(list, shift)');
  const sumEnd = adminSrc.indexOf('function adminShiftGroupIsUnassigned(g)', sumStart);
  if (sumStart < 0 || sumEnd < 0) throw new Error('sumOrderMoney slice not found in admin.js');
  vm.runInNewContext(adminSrc.slice(sumStart, sumEnd), sb, { filename: 'admin-sum.js' });
  return sb;
}

/** Формулы водителя (как acceptArrive / acceptUnloadingOdometer / закрытие смены). */
export function kmFromOdometers({
  etoOdo,
  departOdo,
  loadOdo,
  unloadOdo,
  parkingOdo,
  previousOdometerAtLoad,
}) {
  const depart = departOdo ?? etoOdo;
  const prevAtLoad = previousOdometerAtLoad ?? depart;
  const emptyKmBefore = loadOdo - prevAtLoad;
  const loadedKm = unloadOdo - loadOdo;
  const emptyKmAfter = parkingOdo != null ? Math.max(0, parkingOdo - unloadOdo) : null;
  return { emptyKmBefore, loadedKm, emptyKmAfter };
}

export function manualMetrics(order, cons = 20, fuelPrice = 80) {
  const segmentTotal =
    order.emptyKmBefore != null || order.loadedKm != null || order.emptyKmAfter != null
      ? (order.emptyKmBefore || 0) + (order.loadedKm || 0) + (order.emptyKmAfter || 0)
      : null;
  const km =
    order.closedAt && segmentTotal != null
      ? segmentTotal
      : order.endOdometer != null && order.previousOdometer != null
        ? Math.max(0, order.endOdometer - order.previousOdometer)
        : (order.emptyKmBefore || 0) + (order.loadedKm || 0);
  const fuelLiters = Math.round((km * cons) / 100 * 100) / 100;
  const fuelCost = Math.round(fuelLiters * fuelPrice * 100) / 100;
  const rate = order.rateCash ?? order.rateWithVat ?? 0;
  const payBase = order.payrollRate != null ? order.payrollRate : rate;
  const cushion = Math.round(payBase * 0.1 * 100) / 100;
  const percent = order.driverPercent ?? 30;
  const bonus = order.salaryBonus || 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  const driverPay = r2(payBase * percent / 100 + bonus);
  const rent = order.vehicleRent || 0;
  const netProfit = r2(rate - driverPay - cushion - fuelCost - rent);
  const costPerKmNoVat =
    order.rateWithoutVat != null && order.loadedKm > 0
      ? Math.round((order.rateWithoutVat / order.loadedKm) * 100) / 100
      : null;
  return {
    km,
    fuelLiters,
    fuelCost,
    cushion,
    driverPay,
    netProfit,
    costPerKmNoVat,
  };
}
