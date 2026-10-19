/**
 * Harness: localStorage с квотой ~5 МБ и тяжёлый app_state как на staging.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { guardFetch, patchStoreSrcForNodeTests } from './armada-test-fetch.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WP = path.join(ROOT, 'web-preview');

export const LS_QUOTA_BYTES = 5 * 1024 * 1024;

export function createQuotaLocalStorage(maxBytes = LS_QUOTA_BYTES) {
  const bag = { _: {}, maxBytes };
  function usedBytes() {
    return Object.entries(bag._).reduce((n, [k, v]) => n + String(k).length + String(v).length, 0);
  }
  return {
    _data: bag._,
    maxBytes,
    usedBytes,
    getItem(k) {
      return bag._[k] ?? null;
    },
    setItem(k, v) {
      const key = String(k);
      const val = String(v);
      const prev = bag._[key];
      const prevLen = prev != null ? key.length + String(prev).length : 0;
      const nextLen = key.length + val.length;
      const total = usedBytes() - prevLen + nextLen;
      if (total > bag.maxBytes) {
        const err = new Error(`Failed to setItem('${key}') — quota ${bag.maxBytes}`);
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      bag._[key] = val;
    },
    removeItem(k) {
      delete bag._[k];
    },
  };
}

/** Наполнить state «как staging»: много смен/заказов с чатом. */
export function seedStagingHeavyState(state, driverName, companyId, spaceId) {
  const pad = 'hist-'.repeat(400);
  const mkOrder = (i, shiftId) => ({
    id: `ord-stg-${shiftId}-${i}`,
    driverName,
    ownCompanyId: companyId,
    spaceId,
    customer: `Заказчик ${i}`,
    loading: `Погрузка ${i} ${pad}`,
    unloading: `Выгрузка ${i} ${pad}`,
    messages: Array.from({ length: 12 }, (_, j) => ({ author: 'bot', text: `msg ${i}-${j} ${pad}` })),
    chat: Array.from({ length: 8 }, (_, j) => ({ t: j, body: pad })),
  });
  const shifts = [];
  for (let s = 0; s < 220; s += 1) {
    const id = `sh-stg-${s}`;
    const orders = Array.from({ length: 6 }, (_, i) => mkOrder(i, id));
    shifts.push({
      id,
      startedAt: new Date(Date.UTC(2024, 0, 1 + (s % 28))).toISOString(),
      endedAt: s % 3 === 0 ? new Date(Date.UTC(2024, 0, 2 + (s % 28))).toISOString() : null,
      driverName: s % 17 === 0 ? 'Другой Водитель' : driverName,
      ownCompanyId: companyId,
      vehiclePlate: 'А111АА77',
      orders,
      messages: Array.from({ length: 25 }, (_, j) => ({ author: 'driver', text: `shift ${s} line ${j} ${pad}` })),
    });
  }
  const topOrders = Array.from({ length: 1800 }, (_, i) => mkOrder(i, 'top'));
  state.spaces = [{ id: spaceId, name: 'Staging space', ownCompanyId: companyId }];
  state.companies = [{ id: companyId, name: 'Перевозчик staging', roles: ['own'], spaceId }];
  state.vehicles = [
    { id: 'v-stg', plate: 'А111АА77', companyId, spaceId, currentOdometer: 99000 },
    { id: 'v-eto', plate: 'Х777ХХ77', companyId, spaceId, currentOdometer: 50000 },
  ];
  state.drivers = [
    { id: 'drv-stg', name: driverName, phone: '+79001234567', companyId, spaceId },
  ];
  state.shifts = shifts;
  state.orders = topOrders;
  state.opsLog = Array.from({ length: 500 }, (_, i) => ({ i, note: pad }));
  state.customerPortalLeads = Array.from({ length: 200 }, (_, i) => ({ id: `lead-${i}`, text: pad }));
  state.dataEpoch = 42;
}

function domEl(id = '') {
  return {
    id,
    style: {},
    value: '',
    textContent: '',
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

export function loadS5QuotaSandbox({ localStorage, fetchImpl, apiBase = 'http://localhost/armada-api' }) {
  const numEl = domEl('num');
  const inputBar = domEl('input-bar');
  const etoBody = domEl('eto-body');
  etoBody.querySelectorAll = () => [];
  const els = new Map([
    ['num', numEl],
    ['input-bar', inputBar],
    ['eto-body', etoBody],
  ]);
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
    localStorage,
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      ...ev,
      querySelector: (sel) => {
        if (sel === '#driver.show') return { id: 'driver' };
        if (sel === '#eto-panel.show') return null;
        return null;
      },
      getElementById: (id) => els.get(id) || domEl(id),
      createElement: domEl,
      querySelectorAll: () => [],
      body: domEl(),
      documentElement: domEl(),
    },
    location: { href: 'http://localhost/v/', pathname: '/v/', hostname: 'localhost' },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: guardFetch(fetchImpl),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000099' },
    uuid: () => '00000000-0000-4000-8000-000000000088',
    persistTimer: null,
    armadaConfirm: async () => true,
    billingGuardCurrentAdminWithServer: async () => ({ ok: true }),
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
  vm.runInNewContext(readFileSync(path.join(WP, 'driver.js'), 'utf8'), sandbox, { filename: 'driver.js' });

  sandbox.armadaRuFieldValidity = () => {};
  sandbox.renderDriverBanner = () => {};
  sandbox.showDriverHome = () => {};
  sandbox.maybeAutoOpenEtoTab = () => {};
  sandbox.API_BASE = apiBase;
  sandbox.__numEl = numEl;
  sandbox.__inputBar = inputBar;
  return sandbox;
}

export function estimateSnapshotBytes(sb) {
  const snap = sb.snapshot();
  return Buffer.byteLength(JSON.stringify(snap), 'utf8');
}
