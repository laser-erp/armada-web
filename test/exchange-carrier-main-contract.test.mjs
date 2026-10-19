/**
 * Биржа: основной договор с перевозчиком при claim.
 * node --test web-preview/test/exchange-carrier-main-contract.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let uuidSeq = 0;
function nextUuid() {
  uuidSeq += 1;
  return `uuid-${uuidSeq}`;
}

function loadContractsSandbox() {
  const companies = [
    { id: 'co-our', name: 'ООО Армада', spaceId: 'sp-executor' },
    { id: 'co-customer', name: 'Заказчик ООО', spaceId: 'sp-customer' },
    { id: 'co-carrier', name: 'Перевозчик ИП', spaceId: 'sp-carrier' },
  ];
  const state = {
    contracts: [],
    contractsCounter: { year: 2026, mainSeq: 0, tripSeq: {} },
    companies,
    orders: [],
  };
  const sb = {
    console,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Date,
    state,
    uuid: nextUuid,
    bumpDataEpoch: () => {},
    alert: () => {},
    findCompanyById: (id) => companies.find((c) => c.id === id) || null,
    findCompanyByName: (n) => companies.find((c) => c.name === n) || null,
    ownCompanyForSpaceId: (sid) => (sid === 'sp-executor' ? companies[0] : null),
    currentOwnCompany: () => companies[0],
    companyHasRole: () => false,
  };
  sb.globalThis = sb;
  vm.runInNewContext(readFileSync(path.join(ROOT, 'contracts.js'), 'utf8'), sb, {
    filename: 'contracts.js',
  });
  return sb;
}

function makeClaimOrder(id, extra = {}) {
  return {
    id,
    sequentialNumber: id.replace('ord-', ''),
    customerId: 'co-customer',
    contractId: 'ctr-customer-main',
    spaceId: 'sp-customer',
    partnerSpaceId: 'sp-executor',
    ownCompanyId: 'co-our',
    carrierCompanyId: 'co-carrier',
    transportApp: { carrierCompanyId: 'co-carrier', signedAt: '2026-10-16T12:00:00.000Z' },
    ...extra,
  };
}

describe('биржа — основной договор с перевозчиком', () => {
  it('первый claim: draft main с перевозчиком, trip.parent, contractId заказчика не тронут', () => {
    const sb = loadContractsSandbox();
    sb.state.contracts.push({
      id: 'ctr-customer-main',
      contractNumber: '100/2026',
      contractDate: '2026-01-01',
      ourCompanyId: 'co-our',
      counterpartyId: 'co-customer',
      type: 'carriage',
      subject: 'С заказчиком',
      paymentTerms: { days: 30, description: 'x' },
      status: 'active',
      signatureType: 'paper',
    });
    const order = makeClaimOrder('ord-1');
    const customerContractId = order.contractId;

    sb.ensureTripContractFromTransportApp(order);

    const trip = sb.findContractById(order.tripContractId);
    assert.ok(trip, 'trip contract');
    assert.equal(order.contractId, customerContractId, 'договор заказчика не меняется');
    assert.ok(order.carrierContractId, 'carrierContractId задан');

    const main = sb.findContractById(order.carrierContractId);
    assert.ok(main, 'main carrier contract');
    assert.equal(main.counterpartyId, 'co-carrier');
    assert.equal(main.status, 'draft');
    assert.equal(main.ourCompanyId, 'co-our');
    assert.equal(trip.parentContractId, main.id);
    assert.equal(trip.counterpartyId, 'co-carrier');
  });

  it('второй order тот же перевозчик: один main, два trip', () => {
    const sb = loadContractsSandbox();
    const order1 = makeClaimOrder('ord-a', { sequentialNumber: '101' });
    const order2 = makeClaimOrder('ord-b', { sequentialNumber: '102' });

    sb.ensureTripContractFromTransportApp(order1);
    sb.ensureTripContractFromTransportApp(order2);

    const mains = sb.state.contracts.filter(
      (c) => c.counterpartyId === 'co-carrier' && !c.orderId && !c.parentContractId,
    );
    assert.equal(mains.length, 1, 'один основной договор с перевозчиком');

    const trip1 = sb.findContractById(order1.tripContractId);
    const trip2 = sb.findContractById(order2.tripContractId);
    assert.notEqual(trip1.id, trip2.id);
    assert.equal(trip1.parentContractId, mains[0].id);
    assert.equal(trip2.parentContractId, mains[0].id);
    assert.equal(order1.carrierContractId, order2.carrierContractId);
  });
});
