/**
 * Песочница QA E (изоляция, биржа, merge): store + app + fleet-rates + billing + portal match.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ETRN = path.join(ROOT, 'etrn.js');

export function loadEIsoSandbox(overrides = {}) {
  const sb = loadTariffSandbox(overrides);
  sb.API_BASE = '';
  sb.persist = () => {};
  sb.pushServerState = async () => {};
  sb.pushServerStateQueued = async () => {};
  vm.runInNewContext(readFileSync(path.join(ROOT, 'billing.js'), 'utf8'), sb, { filename: 'billing.js' });

  const etrnSrc = readFileSync(ETRN, 'utf8');
  const sliceStart = etrnSrc.indexOf('function orderShipperSameAsCustomer');
  const sliceEnd = etrnSrc.indexOf('function orderShipperInfo', sliceStart);
  if (sliceStart < 0 || sliceEnd < 0) throw new Error('etrn portal slice not found');
  vm.runInNewContext(etrnSrc.slice(sliceStart, sliceEnd), sb, { filename: 'etrn-portal.js' });

  sb.currentCustomer = null;
  sb.deletedOrderIdSet = () => new Set();
  sb.customerOrders = function customerOrders() {
    if (!sb.currentCustomer || !String(sb.currentCustomer.companyId || '').trim()) return [];
    const dead = sb.deletedOrderIdSet();
    const co =
      (typeof sb.findCompanyById === 'function' ? sb.findCompanyById(sb.currentCustomer.companyId) : null) ||
      { id: sb.currentCustomer.companyId, name: sb.currentCustomer.name || '', inn: sb.currentCustomer.inn || '' };
    return (sb.state.orders || [])
      .filter((o) => {
        if (!o || dead.has(o.id)) return false;
        return sb.orderBelongsToPortalCompany(o, co);
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  };

  return sb;
}

export function seedTwoSpaces(sb) {
  const spA = 'sp-e-iso-a';
  const spB = 'sp-e-iso-b';
  const coA = 'co-own-a';
  const coB = 'co-own-b';
  sb.state.spaces = [
    { id: spA, name: 'Space A', ownCompanyId: coA },
    { id: spB, name: 'Space B', ownCompanyId: coB },
  ];
  sb.state.companies = [
    { id: coA, name: 'Перевозчик A', roles: ['own'], spaceId: spA },
    { id: coB, name: 'Перевозчик B', roles: ['own'], spaceId: spB },
    { id: 'co-cust-a1', name: 'Заказчик A1', roles: ['customer'], spaceId: spA, inn: '7701000001' },
    { id: 'co-cust-b1', name: 'Заказчик B1', roles: ['customer'], spaceId: spB, inn: '7701000001' },
  ];
  sb.state.admins = [
    { id: 'adm-a', name: 'Логист A', spaceId: spA, companyId: coA },
    { id: 'adm-b', name: 'Логист B', spaceId: spB, companyId: coB },
  ];
  sb.state.drivers = [];
  sb.state.vehicles = [];
  sb.state.orders = [
    {
      id: 'ord-a',
      spaceId: spA,
      ownCompanyId: coA,
      ownerAdminId: 'adm-a',
      customerId: 'co-cust-a1',
      customer: 'Заказчик A1',
    },
    {
      id: 'ord-b',
      spaceId: spB,
      ownCompanyId: coB,
      ownerAdminId: 'adm-b',
      customerId: 'co-cust-b1',
      customer: 'Заказчик B1',
    },
  ];
  sb.state.billing = {
    spaces: {
      [spA]: { planId: 'business', status: 'trial', trialEndsAt: new Date(Date.now() + 86400000 * 30).toISOString() },
      [spB]: { planId: 'business', status: 'trial', trialEndsAt: new Date(Date.now() + 86400000 * 30).toISOString() },
    },
  };
  return { spA, spB, coA, coB };
}

export function setAdmin(sb, adminId) {
  const adm = sb.state.admins.find((a) => a.id === adminId);
  const session = adm
    ? { id: adm.id, name: adm.name, isSuper: !!adm.isSuper, spaceId: adm.spaceId || null }
    : null;
  vm.runInNewContext(`currentAdmin = ${JSON.stringify(session)}`, sb);
  sb.currentAdmin = session;
}
