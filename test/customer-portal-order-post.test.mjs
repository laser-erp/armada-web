/**
 * Портал заказчика: при sync-JWT в storage заявка уходит POST /customer/orders, не PATCH /state.
 * Запуск: node --test web-preview/test/customer-portal-order-post.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNC_KEY = 'armada_api_sync_token_v1';
const ROLE_KEY = 'armada_api_role_token_v1';

function fakeJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function loadStoreOnly(fetchImpl) {
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
      querySelector: () => ({ id: 'customer-portal', classList: { contains: () => true } }),
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      querySelectorAll: () => [],
      body: { style: {} },
      documentElement: { style: {} },
    },
    location: { href: 'http://localhost/z/', pathname: '/z/', hostname: 'localhost', assign() {}, replace() {} },
    navigator: { userAgent: 'node', onLine: true },
    history: { pushState() {}, replaceState() {} },
    ...ev,
    setTimeout,
    clearTimeout,
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
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000011' },
    uuid: () => 'order-portal-post-qa-001',
    bumpDataEpoch: () => {},
    bumpDataEpochAuto: () => {},
    healAllOrders: () => {},
    healOrphanOrdersIntoShifts: () => {},
    purgeCancelledOrders: () => {},
    formatPhone: (p) => String(p || '').trim(),
    findCompanyById: (id) => (sandbox.state.companies || []).find((c) => c.id === id) || null,
    getPortalScope: () => null,
    API_BASE: 'http://localhost:8094/armada-api',
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  let storeSrc = readFileSync(path.join(WP, 'store.js'), 'utf8');
  storeSrc = storeSrc.replace('const state={', 'var state = globalThis.__armadaState = {');
  vm.runInNewContext(storeSrc, sandbox, { filename: 'store.js' });
  sandbox.state = sandbox.__armadaState || sandbox.globalThis.__armadaState;
  if (!sandbox.state.shifts) sandbox.state.shifts = [];
  if (!sandbox.state.orders) sandbox.state.orders = [];
  return sandbox;
}

function seedPortalOrderWorld(sb) {
  const sp = 'sp-portal-post';
  const custId = 'co-cust-post';
  sb.state.spaces = [{ id: sp, name: 'QA', ownCompanyId: 'co-own' }];
  sb.state.companies = [
    {
      id: custId,
      name: 'Заказчик POST',
      roles: ['customer'],
      spaceId: sp,
      portalEnabled: true,
      portalPhone: '+79001112233',
      portalPin: '2222',
    },
  ];
  sb.currentCustomer = { companyId: custId, phone: '+79001112233', spaceId: sp };
  vm.runInNewContext(
    `currentCustomer = ${JSON.stringify(sb.currentCustomer)}`,
    sb,
  );
  const order = {
    id: 'order-portal-post-qa-001',
    sequentialNumber: 9001,
    createdAt: new Date().toISOString(),
    source: 'customer_portal',
    customerId: custId,
    spaceId: sp,
    loadingAddress: 'A',
    unloadingAddress: 'B',
  };
  sb.state.orders = [order];
  sb.state.dataEpoch = 1;
  return { order, custId };
}

test('sync JWT + currentCustomer → POST /customer/orders, без PATCH /state', async () => {
  const calls = [];
  const sb = loadStoreOnly(async (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    calls.push({ u, method });
    if (u.includes('/auth/verify-customer')) {
      return jsonResponse(200, { token: fakeJwt('customer') });
    }
    if (u.includes('/customer/orders') && method === 'POST') {
      return jsonResponse(200, { dataEpoch: 2 });
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(500, { error: 'must_not_patch' });
    }
    return jsonResponse(404, {});
  });

  sb.localStorage.setItem(SYNC_KEY, fakeJwt('sync'));
  sb.localStorage.removeItem(ROLE_KEY);
  const { order } = seedPortalOrderWorld(sb);

  sb.enqueueCustomerPortalSync(order.id);
  const r = await sb.flushCustomerPortalSyncQueue();
  assert.equal(r.ok, true, 'flush ok');
  assert.ok(calls.some((c) => c.u.includes('/customer/orders') && c.method === 'POST'), 'POST /customer/orders');
  assert.equal(calls.filter((c) => c.u.includes('/state') && c.method === 'PATCH').length, 0, 'нет PATCH /state');
  assert.ok(calls.some((c) => c.u.includes('/auth/verify-customer')), 'получен customer JWT через verify-customer');
});

async function runCustomerDup409Test(sb, dupBody) {
  let postCount = 0;
  const calls = [];
  const remotePayload = { dataEpoch: 3, orders: [], shifts: [], companies: [] };
  const fetchImpl = async (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    calls.push({ u, method });
    if (u.includes('/auth/verify-customer')) {
      return jsonResponse(200, { token: fakeJwt('customer') });
    }
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec1', payload: remotePayload } });
    }
    if (u.includes('/customer/orders') && method === 'POST') {
      postCount++;
      if (postCount === 1) {
        remotePayload.dataEpoch = 3;
        remotePayload.orders = [JSON.parse(opts.body || '{}').order];
        return jsonResponse(200, { dataEpoch: 3, orderId: remotePayload.orders[0].id, rev: 1 });
      }
      return jsonResponse(409, dupBody(remotePayload.orders[0]?.id));
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(500, { error: 'must_not_patch' });
    }
    return jsonResponse(404, {});
  };
  Object.assign(sb, { fetch: fetchImpl });
  sb.localStorage.setItem(SYNC_KEY, fakeJwt('sync'));
  const { order } = seedPortalOrderWorld(sb);
  sb.enqueueCustomerPortalSync(order.id);

  const first = await sb.flushCustomerPortalSyncQueue();
  assert.equal(first.ok, true);
  assert.equal(postCount, 1);

  sb.enqueueCustomerPortalSync(order.id);
  const second = await sb.flushCustomerPortalSyncQueue();
  assert.equal(second.ok, true);
  assert.equal(postCount, 2, 'ровно один повторный POST');
  assert.equal(sb.loadCustomerPortalSyncQueue().length, 0, 'очередь пуста после идемпотентного 409');
  assert.equal(calls.filter((c) => c.u.includes('/state') && c.method === 'PATCH').length, 0);
}

test('повторная отправка → 409 duplicate_order идемпотентно (legacy)', async () => {
  const sb = loadStoreOnly(async () => jsonResponse(404, {}));
  await runCustomerDup409Test(sb, (orderId) => ({
    dataEpoch: 3,
    error: 'duplicate_order',
    orderId,
  }));
});

test('повторная отправка → 409 order_already_exists (ENTITY_MODE=on)', async () => {
  const sb = loadStoreOnly(async () => jsonResponse(404, {}));
  await runCustomerDup409Test(sb, (orderId) => ({
    error: 'order_already_exists',
    orderId,
    rev: 2,
  }));
});

test('409 customer_order_conflict с payload — merge без повторной очереди', async () => {
  let postCount = 0;
  const remotePayload = {
    dataEpoch: 5,
    orders: [{ id: 'order-portal-post-qa-001', customerId: 'co-cust-post', spaceId: 'sp-portal-post' }],
    shifts: [],
    companies: [],
  };
  const sb = loadStoreOnly(async (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    if (u.includes('/auth/verify-customer')) {
      return jsonResponse(200, { token: fakeJwt('customer') });
    }
    if (u.includes('/customer/orders') && method === 'POST') {
      postCount++;
      return jsonResponse(409, {
        error: 'customer_order_conflict',
        dataEpoch: 5,
        payload: remotePayload,
        recordId: 'rec-conflict',
      });
    }
    return jsonResponse(404, {});
  });
  sb.localStorage.setItem(SYNC_KEY, fakeJwt('sync'));
  const { order } = seedPortalOrderWorld(sb);
  sb.enqueueCustomerPortalSync(order.id);
  const r = await sb.flushCustomerPortalSyncQueue();
  assert.equal(r.ok, true);
  assert.equal(postCount, 1);
  assert.equal(sb.loadCustomerPortalSyncQueue().length, 0);
  assert.equal(sb.state.dataEpoch, 5);
});

test('persistCustomerPortalOrderImmediate не ok при not_customer_role (sync без verify)', async () => {
  const sb = loadStoreOnly(async () => jsonResponse(404, {}));
  sb.localStorage.setItem(SYNC_KEY, fakeJwt('sync'));
  const { order } = seedPortalOrderWorld(sb);
  sb.state.companies[0].portalPin = '';
  const r = await sb.persistCustomerPortalOrderImmediate(order.id);
  assert.equal(r.ok, false);
  assert.equal(r.offline, false);
});
