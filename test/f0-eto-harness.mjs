/**
 * Локальная загрузка store + auth + app (без boot) + driver.js для QA F0 (ЕТО).
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
  const el = {
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
  return el;
}

export function loadF0Sandbox(overrides = {}) {
  const { fetch: fetchOverride, ...restOverrides } = overrides;
  const numEl = domEl('num');
  const els = new Map([['num', numEl]]);
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
      removeItem(k) {
        delete this._[k];
      },
    },
    sessionStorage: {
      _: {},
      getItem(k) {
        return this._[k] ?? null;
      },
      setItem(k, v) {
        this._[k] = String(v);
      },
      removeItem(k) {
        delete this._[k];
      },
    },
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
      href: 'http://localhost/v/',
      pathname: '/v/',
      hostname: 'localhost',
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
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000099' },
    uuid: () => '00000000-0000-4000-8000-000000000088',
    HTMLElement() {},
    persistTimer: null,
    pushServerStateQueued: async () => {},
    armadaConfirm: async () => true,
    billingGuardCurrentAdminWithServer: async () => ({ ok: true }),
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
  vm.runInNewContext(readFileSync(path.join(WP, 'driver.js'), 'utf8'), sandbox, { filename: 'driver.js' });

  sandbox.persist = () => {};
  sandbox.renderInput = () => {};
  sandbox.renderChat = () => {};
  sandbox.renderDriverBanner = () => {};
  sandbox.showDriverHome = () => {};
  sandbox.maybeAutoOpenEtoTab = () => {};
  sandbox.openDriverLogin = () => {};
  sandbox.armadaConfirm = async () => true;
  sandbox.pushServerStateQueued = async () => {};

  sandbox.__numEl = numEl;
  return sandbox;
}

/** let DRIVER / DRIVER_COMPANY_ID из store.js — только через присвоение в контексте VM. */
export function setDriverSession(sb, name, companyId = 'co-f0-own') {
  vm.runInNewContext(
    `DRIVER = ${JSON.stringify(name)}; DRIVER_COMPANY_ID = ${JSON.stringify(companyId)}`,
    sb,
  );
  sb.globalThis.DRIVER = name;
  sb.globalThis.DRIVER_COMPANY_ID = companyId;
}

export function seedF0World(sb) {
  const spaceId = 'sp-f0-qa';
  const companyId = 'co-f0-own';
  sb.state.spaces = [{ id: spaceId, name: 'QA F0', ownCompanyId: companyId }];
  sb.state.companies = [{ id: companyId, name: 'Перевозчик F0', roles: ['own'], spaceId }];
  sb.state.vehicles = [
    { id: 'v1', plate: 'А111АА77', companyId, spaceId, currentOdometer: 99000 },
    { id: 'v2', plate: 'В222ВВ77', companyId, spaceId, currentOdometer: 50000 },
  ];
  sb.state.drivers = [
    {
      id: 'drv-staff',
      name: 'Иванов Иван',
      phone: '+79001234567',
      companyId,
      spaceId,
      exchangeEnabled: false,
    },
    {
      id: 'drv-ip',
      name: 'Петров ИП',
      phone: '+79007654321',
      companyId,
      spaceId,
      exchangeEnabled: true,
    },
  ];
  sb.state.driverInvites = [];
  sb.state.shifts = [];
  sb.state.orders = [];
  sb.currentAdmin = { id: 'adm1', name: 'Логист', spaceId };
  setDriverSession(sb, 'Иванов Иван', companyId);
}

/** Пройти ЕТО до шага (не включая complete oil). */
export function runEtoThrough(sb, { plate = 'А111АА77', odo = 100000, fuel = 120 } = {}) {
  if (!sb.state.shift) {
    sb.state.shift = {
      id: 'sh-eto-run',
      startedAt: new Date().toISOString(),
      driverName: 'Иванов Иван',
      vehiclePlate: null,
      orders: [],
      endedAt: null,
      ownCompanyId: 'co-f0-own',
    };
    sb.state.step = 'chooseVehicle';
  }
  sb.selectVehicle(plate);
  sb.__numEl.value = String(odo);
  sb.submitNumber();
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '56';
  sb.submitNumber();
  sb.__numEl.value = String(fuel);
  sb.submitNumber();
}

export function completeEto(sb, opts = {}) {
  runEtoThrough(sb, opts);
  sb.selectFluid('Максимум');
  sb.selectFluid('Середина');
  sb.state.light = { lowBeam: 'ok', brake: 'ok', turn: 'ok' };
  sb.submitLights();
  sb.selectFluid('Минимум');
}
