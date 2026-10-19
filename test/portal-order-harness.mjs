/**
 * Песочница: портал заказчика — submitCustomerOrderAsync + billing guard.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function domEl(id = '') {
  const parent = {
    insertBefore() {},
    appendChild() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const el = {
    id,
    style: {},
    value: '',
    textContent: '',
    checked: false,
    hidden: false,
    dataset: {},
    parentNode: parent,
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    dispatchEvent() {},
    onclick: null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

export function loadPortalOrderSandbox(overrides = {}) {
  const els = new Map();
  const getEl = (id) => {
    if (!els.has(id)) els.set(id, domEl(id));
    return els.get(id);
  };

  const sb = loadTariffSandbox({
    location: { href: 'http://localhost/z/', pathname: '/z/', assign() {}, replace() {} },
    navigator: { onLine: true, userAgent: 'node' },
    armadaConfirm: async () => true,
    API_BASE: 'http://localhost:8094/armada-api',
    persistCustomerPortalOrderImmediate: async () => ({ ok: true }),
    customerOrderMode: () => 'form',
    resetCustomerOrderFormFields: () => {},
    customerChatAfterOrderSubmit: () => {},
    createCustomerInvoiceForOrder: () => null,
    ensureCustomerFrameworkContract: () => {},
    ensureOrderDocs: () => {},
    renderCustomerPortal: () => {},
    updateCustomerPricePreview: () => {},
    paintCustomerFleetOptions: () => {},
    ...overrides,
  });

  const vtypeTent = domEl('vtype-tent');
  vtypeTent.dataset.vtype = 'tent';
  const loadM = domEl('load-m');
  const unloadM = domEl('unload-m');
  const vehicleTypesRoot = domEl('cust-vehicle-types');
  vehicleTypesRoot.querySelectorAll = (sel) => {
    if (sel === '[data-vtype]') return [vtypeTent];
    if (sel === '[data-vtype]:checked') return vtypeTent.checked ? [vtypeTent] : [];
    return [];
  };
  els.set('cust-vehicle-types', vehicleTypesRoot);
  els.set('vtype-tent', vtypeTent);
  els.set('load-m', loadM);
  els.set('unload-m', unloadM);

  sb.$ = (id) => getEl(id);
  sb.document.getElementById = (id) => getEl(id);
  sb.document.querySelector = (sel) => {
    if (sel === '#cust-vehicle-types [data-vtype]') return vtypeTent;
    if (sel === '#cust-load-methods input') return loadM;
    if (sel === '#cust-unload-methods input') return unloadM;
    return null;
  };
  sb.document.querySelectorAll = (sel) => {
    if (sel === '#cust-vehicle-types [data-vtype]') return [vtypeTent];
    if (sel === '#cust-vehicle-types [data-vtype]:checked') return vtypeTent.checked ? [vtypeTent] : [];
    if (sel === '#cust-load-methods input[type="checkbox"]') return [loadM];
    if (sel === '#cust-unload-methods input[type="checkbox"]') return [unloadM];
    return [];
  };

  vm.runInNewContext(readFileSync(path.join(ROOT, 'billing.js'), 'utf8'), sb, { filename: 'billing.js' });
  if (typeof overrides.billingGuardWithServer === 'function') {
    sb.billingGuardWithServer = overrides.billingGuardWithServer;
  }
  vm.runInNewContext('wireAddressAutocomplete = function(){};', sb);
  vm.runInNewContext(readFileSync(path.join(ROOT, 'customer.js'), 'utf8'), sb, { filename: 'customer.js' });

  sb.persist = () => {};
  sb.pushServerStateQueued = async () => {};

  return { sb, getEl };
}

export function seedPortalCustomerWorld(sb) {
  const sp = 'sp-portal-qa';
  const ownId = 'co-carrier-own';
  const custId = 'co-cust-portal';
  sb.state.spaces = [{ id: sp, name: 'QA Space', ownCompanyId: ownId }];
  sb.state.companies = [
    {
      id: ownId,
      name: 'Перевозчик QA',
      roles: ['own'],
      spaceId: sp,
      finance: { minWorkHours: 4, podachaHours: 1, podachaEmptyKmLimit: 20 },
    },
    {
      id: custId,
      name: 'Заказчик QA',
      roles: ['customer'],
      spaceId: sp,
      inn: '7701000099',
      portalPhone: '+79001234567',
    },
  ];
  sb.state.admins = [{ id: 'adm-qa', name: 'Диспетчер', spaceId: sp, companyId: ownId }];
  sb.state.orders = [];
  sb.state.drivers = [];
  sb.state.vehicles = [];
  sb.state.billing = {
    spaces: {
      [sp]: {
        planId: 'business',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    },
  };
  vm.runInNewContext(
    `currentCustomer = ${JSON.stringify({ companyId: custId, name: 'Заказчик QA', phone: '+79001234567', spaceId: sp })}`,
    sb,
  );
  sb.currentCustomer = { companyId: custId, name: 'Заказчик QA', phone: '+79001234567', spaceId: sp };
  return { sp, ownId, custId };
}

export function fillMinimalCustomerForm(getEl, marker = 'PORTAL-MARKER-QA') {
  const tomorrow = new Date(Date.now() + 86400000);
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const yyyy = tomorrow.getFullYear();
  const set = (id, val) => {
    getEl(id).value = val;
  };
  set('cust-load', 'СПб, Невский 1');
  set('cust-unload', 'СПб, Московский 10');
  set('cust-vehicle-date', `${dd}.${mm}.${yyyy}`);
  set('cust-vehicle-time', '11:00');
  set('cust-weight-value', '1');
  set('cust-cargo-text', marker);
  getEl('cust-shipper-same').checked = true;
  getEl('vtype-tent').checked = true;
  getEl('load-m').checked = true;
  getEl('unload-m').checked = true;
  set('cust-loading-contact-name', 'Контакт');
  set('cust-loading-contact-phone', '+79001234567');
}
