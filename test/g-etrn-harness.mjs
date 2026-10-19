/**
 * Песочница QA G (ЭТрН T1–T4): store + app + billing + etrn (+ driver для startLeaveLoading).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  defaultLocalMockFetch,
  guardFetch,
  patchStoreSrcForNodeTests,
} from './armada-test-fetch.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WP = path.join(ROOT, 'web-preview');

function domEl(id = '') {
  return {
    id,
    style: {},
    value: '',
    textContent: '',
    hidden: true,
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    onclick: null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

export const G_SPACE = 'sp-g-etrn';
export const G_CARRIER = 'co-g-carrier';
export const G_CUSTOMER = 'co-g-customer';
export const G_SHIPPER = 'co-g-shipper';

export function loadGEtrnSandbox(overrides = {}) {
  const { fetch: fetchOverride, ...restOverrides } = overrides;
  const els = new Map();
  const ev = { addEventListener() {}, removeEventListener() {} };
  const sandbox = {
    console,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Date,
    Set,
    Map,
    Promise,
    RegExp,
    Error,
    URLSearchParams: globalThis.URLSearchParams,
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    structuredClone: (o) => JSON.parse(JSON.stringify(o)),
    localStorage: { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } },
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {} },
    document: {
      ...ev,
      querySelector: () => null,
      getElementById: (id) => els.get(id) || domEl(id),
      createElement: domEl,
      querySelectorAll: () => [],
      body: domEl(),
      documentElement: domEl(),
    },
    location: {
      href: 'http://localhost/z/',
      pathname: '/z/',
      origin: 'http://localhost',
      hostname: 'localhost',
      search: '',
      assign() {},
      replace() {},
    },
    navigator: { userAgent: 'node' },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: guardFetch(fetchOverride || defaultLocalMockFetch),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    alert: () => {},
    uuid: () => 'g-etrn-token-uuid-0001',
    crypto: { randomUUID: () => 'g-etrn-token-uuid-0001' },
    routeText: (o) => `${o?.loadingAddress || 'A'} → ${o?.unloadingAddress || 'B'}`,
    formatPhone: (p) => String(p || ''),
    findCompanyById: (id) => (sandbox.state.companies || []).find((c) => c.id === id) || null,
    findSpaceById: (id) => (sandbox.state.spaces || []).find((s) => s.id === id) || null,
    upsertOrder: (o) => {
      const i = (sandbox.state.orders || []).findIndex((x) => x.id === o.id);
      if (i >= 0) sandbox.state.orders[i] = o;
      else sandbox.state.orders.push(o);
    },
    persist: () => {},
    bumpDataEpoch: () => {},
    logOpsEvent: () => {},
    looksClosedOrder: undefined,
    ...restOverrides,
  };
  sandbox.$ = (id) => {
    if (!els.has(id)) els.set(id, domEl(id));
    return els.get(id);
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const appSrc = readFileSync(path.join(WP, 'app.js'), 'utf8');
  const bootMarker = '// Сессию на /a/ /v/ /z/ восстанавливает boot()';
  const bootAt = appSrc.indexOf(bootMarker);
  const appNoBoot = bootAt > 0 ? appSrc.slice(0, bootAt).trimEnd() : appSrc;

  const storeSrc = patchStoreSrcForNodeTests(readFileSync(path.join(WP, 'store.js'), 'utf8'));
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState || sandbox.globalThis.__armadaState;
  vm.runInNewContext(readFileSync(path.join(WP, 'auth.js'), 'utf8'), sandbox, { filename: 'auth.js' });
  vm.runInNewContext(appNoBoot, sandbox, { filename: 'app.js' });
  vm.runInNewContext(readFileSync(path.join(WP, 'billing.js'), 'utf8'), sandbox, { filename: 'billing.js' });
  vm.runInNewContext(readFileSync(path.join(WP, 'etrn.js'), 'utf8'), sandbox, { filename: 'etrn.js' });
  vm.runInNewContext(readFileSync(path.join(WP, 'driver.js'), 'utf8'), sandbox, { filename: 'driver.js' });

  sandbox.persist = () => {};
  sandbox.persistAdminPinImmediate = async () => {};
  sandbox.renderInput = () => {};
  sandbox.renderChat = () => {};
  sandbox.renderDriverBanner = () => {};
  sandbox.showDriverHome = () => {};
  sandbox.pushServerStateQueued = async () => {};
  sandbox.API_BASE = '';

  return sandbox;
}

export function seedGWorld(sb) {
  sb.state.spaces = [{ id: G_SPACE, name: 'QA G ETRN', ownCompanyId: G_CARRIER }];
  sb.state.companies = [
    { id: G_CARRIER, name: 'Перевозчик G', roles: ['own'], spaceId: G_SPACE, inn: '7701000001' },
    { id: G_CUSTOMER, name: 'Заказчик G', spaceId: G_SPACE, inn: '7702000002' },
    { id: G_SHIPPER, name: 'ГО G', spaceId: G_SPACE, inn: '7703000003' },
  ];
  sb.state.billing = {
    spaces: {
      [G_SPACE]: {
        plan: 'business',
        status: 'active',
        etrnEnabled: true,
      },
    },
  };
  sb.state.orders = [];
  sb.state.shifts = [];
  sb.state.vehicles = [{ id: 'v-g', plate: 'А999АА77', companyId: G_CARRIER, spaceId: G_SPACE }];
  sb.state.drivers = [{ id: 'drv-g', name: 'Водитель G', companyId: G_CARRIER, spaceId: G_SPACE }];
  sb.currentAdmin = { id: 'adm-g', name: 'Логист G', spaceId: G_SPACE };
}

export function makeEtrnOrder(extra = {}) {
  return {
    id: 'ord-g-1',
    spaceId: G_SPACE,
    ownCompanyId: G_CARRIER,
    carrierCompanyId: G_CARRIER,
    sequentialNumber: 9001,
    transportDocMode: 'etrn',
    shipperSameAsCustomer: false,
    customerId: G_CUSTOMER,
    customerInn: '7702000002',
    shipperName: 'ГО G',
    shipperInn: '7703000003',
    consigneeName: 'ГП G',
    consigneeInn: '7704000004',
    loadingAddress: 'Склад G',
    unloadingAddress: 'Объект G',
    driverName: 'Водитель G',
    vehiclePlate: 'А999АА77',
    transportApp: { signedAt: new Date().toISOString() },
    docs: { transportApp: { status: 'signed' } },
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

/** Полный рейс sandbox: T1→T2→QR→T3→T4, закрытие. */
export function runSandboxEtrnChain(sb, order) {
  sb.state.orders = [order];
  sb.ensureEtrnForOrder(order, { silent: true });
  order.departOdometer = 1000;
  order.departAt = new Date().toISOString();
  order.startOdometer = 1010;
  order.arrivedAt = new Date().toISOString();
  setPortalCustomer(sb, G_SHIPPER, 'ГО G');
  sb.signEtrnTitul(order.id, 't1', 'ГО G');
  sb.signEtrnTitul(order.id, 't2', 'перевозчик');
  const qrOk = sb.orderEtrnQrAllowed(order);
  if (!qrOk) throw new Error('QR должен быть доступен после T2');
  order.loadedDepartAt = new Date().toISOString();
  order.endOdometer = 1050;
  sb.signEtrnTitul(order.id, 't3', 'грузополучатель');
  sb.signEtrnTitul(order.id, 't4', 'перевозчик');
  order.loadedKm = 40;
  order.emptyKmAfter = 5;
  order.closedAt = new Date().toISOString();
  sb.upsertOrder(order);
  return { qrOk };
}

export function setPortalCustomer(sb, companyId, name = 'Портал') {
  vm.runInNewContext(
    `currentCustomer = ${JSON.stringify({ companyId, name, phone: '+79000000000' })}`,
    sb,
  );
}

export function setDriverSession(sb) {
  vm.runInNewContext(`DRIVER = "Водитель G"; DRIVER_COMPANY_ID = "${G_CARRIER}"`, sb);
  sb.state.shift = {
    id: 'sh-g',
    startedAt: new Date().toISOString(),
    driverName: 'Водитель G',
    vehiclePlate: 'А999АА77',
    orders: [],
    endedAt: null,
    ownCompanyId: G_CARRIER,
    odometer: 1000,
  };
  sb.state.step = 'idle';
}
