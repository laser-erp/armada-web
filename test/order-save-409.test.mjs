/**
 * PATCH /state: 409 remote_ahead (reconcile) и state_guard_shrink (повтор после GET).
 * Запуск: node web-preview/test/order-save-409.test.mjs
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jsonResponse, loadOrderSaveSandbox } from './order-save-409-harness.mjs';

let failed = 0;

function ok(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`❌ ${name}`, e.message);
  }
}

async function okAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`❌ ${name}`, e.message);
  }
}

// remote_ahead: reconcileBeforePush подтягивает сервер до PATCH
await okAsync('reconcile: localEpoch < remote → merge then PATCH 200', async () => {
  const remoteOrders = [
    { id: 'srv-1', customer: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'srv-2', customer: 'B', createdAt: '2026-01-02T00:00:00.000Z' },
  ];
  const remotePayload = { dataEpoch: 500, orders: remoteOrders, shifts: [], admins: [] };
  let patchBodies = [];
  let getCount = 0;
  let patchCount = 0;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      getCount++;
      return jsonResponse(200, { record: { id: 'rec-1', payload: remotePayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      patchCount++;
      const body = JSON.parse(init.body || '{}');
      patchBodies.push(body);
      const localEpoch = Number(body.payload?.dataEpoch) || 0;
      if (localEpoch < 500) {
        return jsonResponse(409, {
          error: 'remote_ahead',
          remoteEpoch: 500,
          localEpoch,
          recordId: 'rec-1',
          payload: remotePayload,
        });
      }
      return jsonResponse(200, { recordId: 'rec-1' });
    }
    return jsonResponse(404, { error: 'not_found' });
  });

  sb.state.dataEpoch = 10;
  sb.state.orders = [
    { id: 'local-new', customer: 'Local', createdAt: '2026-10-11T12:00:00.000Z', source: 'dispatcher' },
  ];

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.ok(getCount >= 1, 'GET /state before push');
  assert.ok(patchCount >= 1, 'PATCH /state');
  const ids = (sb.state.orders || []).map((o) => o.id);
  assert.ok(ids.includes('srv-1') && ids.includes('srv-2'), 'remote orders merged');
  assert.ok(ids.includes('local-new'), 'local new order kept');
  const lastPatch = patchBodies[patchBodies.length - 1];
  assert.ok(
    (lastPatch.payload.orders || []).some((o) => o.id === 'local-new'),
    'PATCH includes local order',
  );
});

// state_guard_shrink: GET полного state и повтор PATCH
await okAsync('shrink: 409 state_guard_shrink → GET merge → PATCH 200', async () => {
  const fullOrders = [
    { id: 'srv-a', customer: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'srv-b', customer: 'B', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'srv-c', customer: 'C', createdAt: '2026-01-03T00:00:00.000Z' },
  ];
  const fullPayload = { dataEpoch: 800, orders: fullOrders, shifts: [], admins: [] };
  let patchCount = 0;
  let shrinkSeen = false;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec-2', payload: fullPayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      patchCount++;
      const body = JSON.parse(init.body || '{}');
      const n = (body.payload?.orders || []).length;
      if (!shrinkSeen && n < fullOrders.length) {
        shrinkSeen = true;
        return jsonResponse(409, { error: 'state_guard_shrink', shrunk: ['orders'] });
      }
      return jsonResponse(200, { recordId: 'rec-2' });
    }
    return jsonResponse(404, {});
  });

  sb.state.dataEpoch = 800;
  sb.state.orders = [
    { id: 'local-shrink', customer: 'New', createdAt: '2026-10-11T12:00:00.000Z', source: 'dispatcher' },
  ];

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.ok(shrinkSeen, 'first PATCH got shrink');
  assert.ok(patchCount >= 2, 'retry PATCH after merge');
  const ids = (sb.state.orders || []).map((o) => o.id);
  assert.ok(ids.includes('local-shrink'), 'local order after shrink recovery');
  assert.ok(ids.includes('srv-a'), 'server orders present');
});

await okAsync('parseApiStateConflict: state_guard_shrink', async () => {
  const sb = loadOrderSaveSandbox(async () => jsonResponse(404, {}));
  const c = vm.runInNewContext(
    `parseApiStateConflict({ error: 'state_guard_shrink', shrunk: ['orders'] })`,
    sb,
  );
  assert.equal(c.stateGuardShrink, true);
  assert.ok(c.shrunk.includes('orders'));
});

if (failed > 0) {
  console.error(`\nИТОГ: ${failed} failed`);
  process.exit(1);
}
console.log('\nИТОГ: order-save-409 tests OK');
