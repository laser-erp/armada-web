/**
 * Загрузка скриптов / (хаб ролей) в порядке boot-loader.js shellScripts(), else branch.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WP = path.join(ROOT, 'web-preview');

function domEl(id = '') {
  return {
    id,
    style: { display: '' },
    value: '',
    textContent: '',
    hidden: false,
    innerHTML: '',
    dataset: {},
    classList: {
      add() {},
      remove() {},
      contains: () => false,
      toggle() {},
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    onclick: null,
    onchange: null,
    oninput: null,
    onblur: null,
    onkeydown: null,
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
  };
}

/** Список файлов для pathname / — как в boot-loader shellScripts() (не /a/, /v/, /z/). */
export function customerRouteScriptBundle() {
  const bootSrc = readFileSync(path.join(WP, 'boot-loader.js'), 'utf8');
  const hubBlock = bootSrc.match(/\n\s*else if \(isZ\)[^\n]+\n\s*else \{([\s\S]*?)\}\n\s*files\.push\('vehicle-podbor\.js'/);
  if (!hubBlock) throw new Error('hub (else) block missing in boot-loader.js');
  const fromHub = [...hubBlock[1].matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
  const tail = ['vehicle-podbor.js', 'app.js'];
  const head = ['store.js', 'billing.js'];
  const build = bootSrc.includes("files.unshift('armada-build.js')");
  const files = [...head, ...fromHub, ...tail];
  if (build && !files.includes('armada-build.js')) files.unshift('armada-build.js');
  return files;
}

export function createCustomerBootSandbox(overrides = {}) {
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
      href: 'http://localhost/',
      pathname: '/',
      origin: 'http://localhost',
      hostname: 'localhost',
      search: '',
      assign() {},
      replace() {},
    },
    navigator: { userAgent: 'node' },
    history: { pushState() {}, replaceState() {} },
    matchMedia: () => ({ matches: false }),
    alert: () => {},
    ...ev,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
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
    inferTripMode: () => 'city',
    tripModeLabel: (m) => String(m || ''),
    bodyTypeLabel: () => '',
    ...overrides,
  };
  sandbox.$ = (id) => {
    if (!els.has(id)) els.set(id, domEl(id));
    return els.get(id);
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

/**
 * @param {string} stopAfter — имя файла, после которого остановиться (включительно)
 */
export function loadCustomerBootScripts(stopAfter, sandbox = createCustomerBootSandbox()) {
  const bundle = customerRouteScriptBundle();
  const stopIdx = bundle.indexOf(stopAfter);
  if (stopIdx < 0) throw new Error(`stopAfter ${stopAfter} not in bundle`);
  const toLoad = bundle.slice(0, stopIdx + 1);
  for (const f of toLoad) {
    let src = readFileSync(path.join(WP, f), 'utf8');
    if (f === 'store.js') {
      src = src.replace('const state={', 'var state = globalThis.__armadaState = {');
    }
    if (f === 'customer.js') {
      src = src.replace(/\nwireCustomerPortal\(\);\s*\n/, '\n');
    }
    vm.runInNewContext(src, sandbox, { filename: f });
  }
  sandbox.state = sandbox.__armadaState || sandbox.state;
  return { sandbox, loaded: toLoad };
}
