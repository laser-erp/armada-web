/**
 * QA сценарий E — изоляция, биржа, одновременность (локальные unit-тесты).
 */
import assert from 'node:assert/strict';
import { loadEIsoSandbox, seedTwoSpaces, setAdmin } from './e-iso-harness.mjs';

function ok(cond, msg) {
  assert.ok(cond, msg);
}

const sb = loadEIsoSandbox();
const { spA, spB, coA, coB } = seedTwoSpaces(sb);

// E1 — изоляция space: логист A не видит заказы B
{
  setAdmin(sb, 'adm-a');
  ok(sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'ord-a')), 'E1: A sees own order');
  ok(!sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'ord-b')), 'E1: A does not see B order');
  setAdmin(sb, 'adm-b');
  ok(!sb.canAdminSeeOrder(sb.state.orders.find((o) => o.id === 'ord-a')), 'E1: B does not see A order');
  const ex = {
    id: 'ord-ex',
    spaceId: spB,
    ownCompanyId: coB,
    onExchange: true,
    closedAt: null,
    startOdometer: null,
  };
  setAdmin(sb, 'adm-a');
  ok(sb.canAdminSeeOrder(ex), 'E1: exchange order visible to other space admin');
}

// E2 — заказчик /z только свои заявки
{
  sb.currentCustomer = { companyId: 'co-cust-a1', name: 'Заказчик A1', inn: '7701000001' };
  const idsA = sb.customerOrders().map((o) => o.id);
  ok(idsA.length === 1 && idsA[0] === 'ord-a', 'E2: customer A1 only ord-a');
  sb.currentCustomer = { companyId: 'co-cust-b1', name: 'Заказчик B1', inn: '7701000001' };
  const idsB = sb.customerOrders().map((o) => o.id);
  ok(idsB.length === 1 && idsB[0] === 'ord-b', 'E2: same INN different company id — only B order');
  sb.state.orders.push({
    id: 'ord-leak',
    customerId: 'co-cust-b1',
    customerInn: '7701000001',
    customer: 'Заказчик B1',
  });
  sb.currentCustomer = { companyId: 'co-cust-a1', inn: '7701000001' };
  const innLeak = sb.customerOrders().some((o) => o.id === 'ord-leak');
  ok(innLeak, 'E2-BUG-INN: orderBelongsToPortalCompany matches customerInn without space/customerId guard');
}

// E3 — publish_exchange guard (billing)
{
  const startSp = 'sp-start';
  sb.state.spaces.push({ id: startSp, name: 'Start only', ownCompanyId: coA });
  sb.state.billing.spaces[startSp] = {
    planId: 'start',
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
  };
  const block = sb.billingGuard(startSp, 'publish_exchange');
  ok(!block.ok && /биржа/i.test(block.message || ''), 'E3: start plan blocks publish_exchange');
  const allow = sb.billingGuard(spA, 'publish_exchange');
  ok(allow.ok, 'E3: business trial allows publish_exchange');
}

// E4 — claim: partnerSpaceId / isPartnerOnOrder
{
  const claimed = {
    id: 'ord-claim',
    spaceId: spA,
    ownCompanyId: coA,
    onExchange: false,
    partnerSpaceId: spB,
    executorAdminId: 'adm-b',
    transportApp: {
      signedAt: new Date().toISOString(),
      carrierCompanyId: coB,
      customerCompanyId: coA,
    },
  };
  setAdmin(sb, 'adm-b');
  ok(sb.isPartnerOnOrder(claimed), 'E4: partner admin B sees partner order');
  ok(sb.canAdminSeeOrder(claimed), 'E4: canAdminSeeOrder via partner');
  setAdmin(sb, 'adm-a');
  ok(sb.isPartnerOnOrder(claimed), 'E4: customer space admin via transportApp.customerCompanyId');
}

// E5 — checkExchangeConflict (fleet-rates): двойная бронь одной машины
{
  const fr = sb.window?.armadaFleetRates || sb.armadaFleetRates;
  ok(fr && fr.checkExchangeConflict, 'E5: armadaFleetRates loaded');
  const plate = 'А999АА77';
  const veh = { plate, id: 'veh-e5', companyId: coB };
  const slotStart = new Date();
  slotStart.setDate(slotStart.getDate() + 2);
  slotStart.setHours(10, 0, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + 4 * 3600 * 1000);
  sb.state.orders.push({
    id: 'signed-1',
    sequentialNumber: 501,
    carrierCompanyId: coB,
    vehiclePlate: plate,
    vehicleAt: slotStart.toISOString(),
    freeAt: slotEnd.toISOString(),
    transportApp: { signedAt: slotStart.toISOString(), vehiclePlate: plate, carrierCompanyId: coB },
  });
  const sameSlot = {
    id: 'claim-new',
    pricingUrgency: 'standard',
    fulfillment: 'direct',
    vehicleAt: slotStart.toISOString(),
    freeAt: slotEnd.toISOString(),
  };
  const cStd = fr.checkExchangeConflict(veh, sameSlot);
  ok(cStd.conflict && cStd.message, 'E5: standard+standard same time → conflict');
  const laterStart = new Date(slotStart.getTime() + 8 * 3600 * 1000);
  const laterEnd = new Date(laterStart.getTime() + 4 * 3600 * 1000);
  const otherSlot = {
    id: 'claim-later',
    pricingUrgency: 'standard',
    vehicleAt: laterStart.toISOString(),
    freeAt: laterEnd.toISOString(),
  };
  ok(!fr.checkExchangeConflict(veh, otherSlot).conflict, 'E5: different time → no conflict');
  sb.state.orders = sb.state.orders.filter((o) => o.id !== 'signed-1');
  sb.state.orders.push({
    id: 'signed-cancelled-only',
    cancelledAt: new Date().toISOString(),
    vehiclePlate: plate,
    vehicleAt: slotStart.toISOString(),
    freeAt: slotEnd.toISOString(),
    transportApp: { signedAt: slotStart.toISOString(), vehiclePlate: plate },
  });
  ok(!fr.checkExchangeConflict(veh, sameSlot).conflict, 'E5: cancelled order → no conflict');
  const urgentOrder = {
    id: 'claim-urgent',
    pricingUrgency: 'urgent',
    fulfillment: 'direct',
    vehicleAt: slotStart.toISOString(),
    freeAt: slotEnd.toISOString(),
  };
  sb.state.orders = sb.state.orders.filter((o) => o.id !== 'signed-cancelled-only');
  sb.state.orders.push({
    id: 'signed-2',
    sequentialNumber: 502,
    vehiclePlate: plate,
    vehicleAt: slotStart.toISOString(),
    freeAt: slotEnd.toISOString(),
    transportApp: { signedAt: slotStart.toISOString(), vehiclePlate: plate },
  });
  const cUrgent = fr.checkExchangeConflict(veh, urgentOrder);
  ok(cUrgent.conflict && cUrgent.signed.length >= 1, 'E5: urgent + overlap → conflict');
}

// E6 — два логиста: merge без блокировок
{
  const base = {
    id: 'ord-merge-assign',
    spaceId: spA,
    ownCompanyId: coA,
    driverName: 'Иванов',
    vehiclePlate: 'А111АА77',
  };
  const local = { ...structuredClone(base), driverName: 'Петров', vehiclePlate: 'В222ВВ77' };
  const remote = { ...structuredClone(base), driverName: 'Сидоров', vehiclePlate: 'С333СС77' };
  const cur = structuredClone(base);
  ok(!sb.mergeOrderAssignmentFields(cur, local), 'E6: local already assigned — no overwrite from lo');
  const cur2 = { id: 'o2', driverName: '—', vehiclePlate: '—' };
  ok(sb.mergeOrderAssignmentFields(cur2, remote), 'E6: empty local gets remote assignment');
  ok(cur2.driverName === 'Сидоров', 'E6: remote assignment applied');
  const lo = { startOdometer: 100500, departOdometer: 100000 };
  const cur3 = { id: 'o3', driverName: 'Иванов', vehiclePlate: 'А111АА77' };
  sb.mergeTwoOrderCopies(cur3, lo);
  ok(cur3.startOdometer === 100500, 'E6: mergeTwoOrderCopies merges odometer into assigned order');
}

// E7 — водитель + логист: mergeTwoOrderCopies одометр
{
  const stateCopy = { id: 'o-sync', driverName: 'Водитель', vehiclePlate: 'К444КК77' };
  const shiftCopy = {
    id: 'o-sync',
    driverName: 'Водитель',
    vehiclePlate: 'К444КК77',
    startOdometer: 201000,
    endOdometer: 201050,
    loadedKm: 50,
  };
  sb.mergeTwoOrderCopies(stateCopy, shiftCopy);
  ok(stateCopy.endOdometer === 201050 && stateCopy.loadedKm === 50, 'E7: shift odometer merged to state order');
}

// E8 — один ИНН, разные space / ownCompanyId (данные вручную)
{
  const c1 = sb.state.companies.find((c) => c.id === 'co-cust-a1');
  const c2 = sb.state.companies.find((c) => c.id === 'co-cust-b1');
  ok(c1.inn === c2.inn && c1.spaceId !== c2.spaceId, 'E8: same INN different spaces in seed');
  ok(c1.id !== c2.id, 'E8: separate company records');
  sb.currentCustomer = { companyId: c1.id, inn: c1.inn };
  const seesBViaInn = sb.customerOrders().some((o) => o.id === 'ord-leak');
  ok(seesBViaInn, 'E8-BUG-INN: same INN in two spaces — portal may show чужую заявку (см. E2)');
}

console.log('e-iso-isolation-exchange.test.mjs: ok');
