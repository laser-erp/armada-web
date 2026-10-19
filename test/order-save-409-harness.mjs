/**
 * Песочница для push/reconcile при 409 (remote_ahead, state_guard_shrink).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeAdminJwt() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function domEl() {
  return {
    style: {},
    value: '',
    textContent: '',
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

export function loadOrderSaveSandbox(fetchImpl) {
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
    sessionStorage: { _: {}, getItem() { return null; }, setItem() {} },
    document: {
      ...ev,
      querySelector: () => null,
      getElementById: () => domEl(),
      createElement: domEl,
      querySelectorAll: () => [],
      body: domEl(),
      documentElement: domEl(),
    },
    location: { href: 'http://localhost/a/', pathname: '/a/', hostname: 'localhost', assign() {}, replace() {} },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: fetchImpl,
    AbortController: class {
      constructor() {
        this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
      }
      abort() {
        this.signal.aborted = true;
      }
    },
    atob: (s) => Buffer.from(s, 'base64').toString(),
    btoa: (s) => Buffer.from(s).toString('base64'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000099' },
    uuid: () => '00000000-0000-4000-8000-000000000098',
    HTMLElement() {},
    bumpDataEpoch: (reason) => {
      sandbox.state.dataEpoch = (Number(sandbox.state.dataEpoch) || 0) + 1;
      if (reason) sandbox._epochReasons = (sandbox._epochReasons || []).concat(reason);
    },
    bumpDataEpochAuto: (reason) => sandbox.bumpDataEpoch(reason),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage.setItem('armada_api_token_v1', fakeAdminJwt());

  let storeSrc = readFileSync(path.join(WP, 'store.js'), 'utf8');
  storeSrc = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  vm.runInNewContext(readFileSync(path.join(WP, 'auth.js'), 'utf8'), sandbox, { filename: 'auth.js' });
  sandbox.state = sandbox.__armadaState || sandbox.globalThis.__armadaState;
  if (!sandbox.state.orders) sandbox.state.orders = [];
  if (!sandbox.state.shifts) sandbox.state.shifts = [];
  if (sandbox.state.dataEpoch == null) sandbox.state.dataEpoch = 0;

  const appSrc = readFileSync(path.join(WP, 'app.js'), 'utf8');
  const bootMarker = '// Сессию на /a/ /v/ /z/ восстанавливает boot()';
  const bootAt = appSrc.indexOf(bootMarker);
  const appNoBoot = bootAt > 0 ? appSrc.slice(0, bootAt).trimEnd() : appSrc;
  vm.runInNewContext(appNoBoot, sandbox, { filename: 'app.js' });

  return sandbox;
}

export function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
