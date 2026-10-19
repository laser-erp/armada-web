/**
 * Загрузка скриптов /a/ в порядке boot-loader.js (shellScripts, isA).
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
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

/** Список файлов для pathname /a/ — как в boot-loader shellScripts(). */
export function adminRouteScriptBundle() {
  const bootSrc = readFileSync(path.join(WP, 'boot-loader.js'), 'utf8');
  const isABlock = bootSrc.match(/} else if \(isA\) \{([\s\S]*?)\}\s*else if \(isZ\)/);
  if (!isABlock) throw new Error('isA block missing in boot-loader.js');
  const fromA = [...isABlock[1].matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
  const tail = ['vehicle-podbor.js', 'app.js'];
  const head = ['store.js', 'billing.js'];
  const build = bootSrc.includes("files.unshift('armada-build.js')");
  const files = [...head, ...fromA, ...tail];
  if (build && !files.includes('armada-build.js')) files.unshift('armada-build.js');
  return files;
}

export function createAdminBootSandbox(overrides = {}) {
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
      href: 'http://localhost/a/',
      pathname: '/a/',
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
export function loadAdminBootScripts(stopAfter, sandbox = createAdminBootSandbox()) {
  const bundle = adminRouteScriptBundle();
  const stopIdx = bundle.indexOf(stopAfter);
  if (stopIdx < 0) throw new Error(`stopAfter ${stopAfter} not in bundle`);
  const toLoad = bundle.slice(0, stopIdx + 1);
  for (const f of toLoad) {
    let src = readFileSync(path.join(WP, f), 'utf8');
    if (f === 'store.js') {
      src = src.replace('const state={', 'var state = globalThis.__armadaState = {');
    }
    if (f === 'app.js') {
      const bootMarker = '// Сессию на /a/ /v/ /z/ восстанавливает boot()';
      const bootAt = src.indexOf(bootMarker);
      if (bootAt > 0) src = src.slice(0, bootAt).trimEnd();
    }
    vm.runInNewContext(src, sandbox, { filename: f });
  }
  sandbox.state = sandbox.__armadaState || sandbox.state;
  return { sandbox, loaded: toLoad };
}
