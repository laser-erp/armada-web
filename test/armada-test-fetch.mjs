/**
 * Локальные web-preview тесты: не ходить на прод/staging, только localhost-моки.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function fetchUrlString(url) {
  if (typeof url === 'string') return url;
  if (url && typeof url === 'object' && url.url) return String(url.url);
  return String(url);
}

export function isLocalhostFetchUrl(url) {
  try {
    const parsed = new URL(fetchUrlString(url));
    return LOCAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** Запрет сети вне localhost (process + песочницы). */
export function guardFetch(fetchImpl) {
  const impl = fetchImpl || defaultLocalMockFetch;
  return async function guardedFetch(url, init) {
    const s = fetchUrlString(url);
    if (!isLocalhostFetchUrl(s)) {
      throw new Error(`ARMADA_TEST: fetch к не-localhost запрещён: ${s}`);
    }
    return impl(url, init);
  };
}

export function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function parseShiftFromBody(init) {
  try {
    const raw = init && init.body ? init.body : '{}';
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed.shift || parsed;
  } catch {
    return { id: 'sh-mock' };
  }
}

/** POST/PATCH /shifts — как в driver-token-sync.test.mjs */
export function handleDriverShiftFetch(url, init) {
  const u = fetchUrlString(url);
  const method = String((init && init.method) || 'GET').toUpperCase();
  if (!u.includes('/shifts')) return undefined;
  const shift = parseShiftFromBody(init);
  if (method === 'POST') {
    return jsonResponse(200, { rev: 1, dataEpoch: 2, shift });
  }
  if (method === 'PATCH') {
    return jsonResponse(200, { rev: 2, dataEpoch: 3, shift });
  }
  return jsonResponse(404, { error: 'unmocked_shifts_method' });
}

export function chainFetchHandlers(...handlers) {
  const list = handlers.filter(Boolean);
  return guardFetch(async (url, init) => {
    for (const fn of list) {
      const r = await fn(url, init);
      if (r !== undefined) return r;
    }
    return jsonResponse(404, { error: 'unmocked', url: fetchUrlString(url) });
  });
}

export async function defaultLocalMockFetch(url, init) {
  const shift = handleDriverShiftFetch(url, init);
  if (shift) return shift;
  return jsonResponse(404, { error: 'unmocked', url: fetchUrlString(url) });
}

export function installGlobalFetchGuard() {
  if (globalThis.__armadaFetchGuardInstalled) return;
  globalThis.__armadaFetchGuardInstalled = true;
  const native = globalThis.fetch.bind(globalThis);
  globalThis.fetch = guardFetch(native);
}

if (process.env.BATCH6_STRICT === '1') {
  installGlobalFetchGuard();
}

/** PB_BASE в store.js на localhost, не app.armada.sx */
export function patchStoreSrcForNodeTests(storeSrc) {
  let src = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  src = src.replace(
    /const PB_BASE=\(function\(\)\{[\s\S]*?\}\)\(\);/,
    "const PB_BASE='http://127.0.0.1:9';",
  );
  return src;
}

export function readPatchedStoreSrc() {
  const wp = path.join(__dir, '..');
  return patchStoreSrcForNodeTests(readFileSync(path.join(wp, 'store.js'), 'utf8'));
}
