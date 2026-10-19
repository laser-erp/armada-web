/**
 * Sandbox store + app (без boot) для тестов путей отмены заказа.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadOrderCancelSandbox(overrides = {}) {
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
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    structuredClone: (o) => JSON.parse(JSON.stringify(o)),
    localStorage: {
      _: {},
      getItem(k) {
        return this._[k] ?? null;
      },
      setItem(k, v) {
        this._[k] = String(v);
      },
    },
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {} },
    document: {
      ...ev,
      querySelector: () => null,
      getElementById: (id) => els.get(id) || { id, style: {}, value: '', onclick: null },
      createElement: () => ({ style: {} }),
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {} } },
    },
    location: { href: 'http://localhost/a/', pathname: '/a/', assign() {}, replace() {} },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    confirm: () => true,
    alert: () => {},
    bumpDataEpoch: () => {},
    persist: () => {},
    persistCustomerPortalOrderImmediate: async () => ({ ok: true }),
    canAdminSeeOrder: () => true,
    ...overrides,
  };
  sandbox.$ = (id) => {
    if (!els.has(id)) els.set(id, { id, style: {}, value: '', onclick: null });
    return els.get(id);
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const appSrc = readFileSync(path.join(WP, 'app.js'), 'utf8');
  const bootMarker = '// Сессию на /a/ /v/ /z/ восстанавливает boot()';
  const bootAt = appSrc.indexOf(bootMarker);
  const appNoBoot = bootAt > 0 ? appSrc.slice(0, bootAt).trimEnd() : appSrc;

  let storeSrc = readFileSync(path.join(WP, 'store.js'), 'utf8');
  storeSrc = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState || sandbox.globalThis.__armadaState;
  vm.runInNewContext(readFileSync(path.join(WP, 'auth.js'), 'utf8'), sandbox, { filename: 'auth.js' });
  vm.runInNewContext(appNoBoot, sandbox, { filename: 'app.js' });
  vm.runInContext(
    'persist = function(){}; persistLocalOnly = function(){}; pushServerStateQueued = async function(){ return {ok:true}; }; persistAdminOrderImmediate = async function(){ return { ok: true }; };',
    sandbox,
  );

  return sandbox;
}

export function setSandboxAdmin(sb, admin) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(admin)};`, sb);
}

export function setSandboxCustomer(sb, customer) {
  vm.runInContext(`currentCustomer = ${JSON.stringify(customer)};`, sb);
}

export function setSandboxDriver(sb, name, companyId = null) {
  const drv = JSON.stringify(name || '');
  const co = companyId == null ? 'null' : JSON.stringify(companyId);
  vm.runInContext(`DRIVER = ${drv}; DRIVER_COMPANY_ID = ${co};`, sb);
}

export function baseOrder(id, extra = {}) {
  return {
    id,
    sequentialNumber: 1,
    spaceId: 'sp-test',
    customerId: 'co-cust',
    customer: 'Клиент',
    driverName: 'Иванов И.И.',
    vehiclePlate: 'А111АА77',
    createdAt: '2026-10-11T08:00:00.000Z',
    ...extra,
  };
}
