/**
 * F0: QuotaExceeded localStorage + запись fuel на сервер после шага ЕТО.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadF0Sandbox, seedF0World, setDriverSession } from './f0-eto-harness.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const WP = path.join(__dir, '..');

function loadStoreSandbox() {
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
        const s = String(v);
        if (s.length > 1200 && this.quotaBytes > 0 && s.length > this.quotaBytes) {
          const e = new Error('QuotaExceededError');
          e.name = 'QuotaExceededError';
          throw e;
        }
        this._[k] = s;
      },
      removeItem(k) {
        delete this._[k];
      },
      quotaBytes: 0,
    },
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {} },
    document: { addEventListener() {}, querySelector: () => null, getElementById: () => ({}) },
    location: { href: 'http://localhost/', pathname: '/' },
    navigator: { onLine: true, userAgent: 'node' },
    history: { pushState() {} },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false }),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    uuid: () => '00000000-0000-4000-8000-000000000002',
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    persistTimer: null,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  let storeSrc = readFileSync(path.join(WP, 'store.js'), 'utf8');
  storeSrc = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState;
  return sandbox;
}

// —— compact + quota retry ——
{
  const sb = loadStoreSandbox();
  const huge = 'x'.repeat(5000);
  const payload = {
    shifts: [
      { id: 'sh-open', startedAt: new Date().toISOString(), messages: [{ t: 'open' }] },
      { id: 'sh-old', startedAt: '2020-01-01T00:00:00.000Z', messages: [{ t: huge }], orders: [{ id: 'o1', messages: [{ t: huge }] }] },
    ],
    opsLog: Array.from({ length: 40 }, (_, i) => ({ i })),
  };
  const compact = sb.compactPayloadForLocalStorage(payload, { openShiftId: 'sh-open', level: 2 });
  assert.equal(compact.shifts[1].messages, undefined);
  assert.ok(compact.opsLog.length <= 20);
  sb.localStorage.quotaBytes = 900;
  sb.state.shift = { id: 'sh-open' };
  sb.snapshot = () => payload;
  const r = sb.armadaLocalStorageSetJson('armada_app_v5', () => payload);
  assert.equal(r.ok, true);
  assert.ok(r.compactLevel >= 1);
  assert.ok(sb.localStorage.getItem('armada_app_v5'));
}

// —— fuel → push payload ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  setDriverSession(sb, 'Иванов Иван');
  let pushed = null;
  sb.pushServerState = async () => {
    pushed = sb.snapshot();
    return { ok: true };
  };
  sb.pushServerStateQueued = async () => sb.pushServerState();
  sb.state.shift = { id: 'sh-fuel', startedAt: new Date().toISOString(), vehiclePlate: 'А111АА77', odometer: 1000 };
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '55';
  sb.submitNumber();
  sb.__numEl.value = '33';
  sb.submitNumber();
  assert.equal(sb.state.shift.fuelLiters, 33);
  assert.equal(sb.state.shift.fuelPricePerLiter, 55);
  assert.ok(pushed);
  const sh = (pushed.shifts || []).find((s) => s.id === 'sh-fuel');
  assert.equal(sh.fuelLiters, 33);
  assert.equal(sh.fuelPricePerLiter, 55);
}

// —— mergeLocalShifts сохраняет fuelPricePerLiter ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shifts = [
    {
      id: 'sh1',
      startedAt: new Date().toISOString(),
      driverName: 'Иванов Иван',
      vehiclePlate: 'А111АА77',
      odometer: 1000,
      fuelLiters: null,
      fuelPricePerLiter: null,
      orders: [],
    },
  ];
  const local = [
    {
      id: 'sh1',
      startedAt: sb.state.shifts[0].startedAt,
      driverName: 'Иванов Иван',
      vehiclePlate: 'А111АА77',
      odometer: 1000,
      fuelLiters: 33,
      fuelPricePerLiter: 55,
      etoRefueled: true,
      orders: [],
    },
  ];
  sb.mergeLocalShifts(local);
  const cur = sb.state.shifts.find((s) => s.id === 'sh1');
  assert.equal(cur.fuelLiters, 33);
  assert.equal(cur.fuelPricePerLiter, 55);
}

console.log('f0-quota-fuel.test.mjs: all assertions passed');
