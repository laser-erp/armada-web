/**
 * Логист сохраняет заказ через POST /admin/orders, не PATCH /state.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { jsonResponse, loadOrderSaveSandbox } from './order-save-409-harness.mjs';

let failed = 0;

async function okAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`❌ ${name}`, e.message);
  }
}

await okAsync('upsertOrder admin → POST /admin/orders, no PATCH /state', async () => {
  let patchCount = 0;
  let postAdminCount = 0;
  const remotePayload = {
    dataEpoch: 50,
    orders: [],
    shifts: [],
    admins: [{ id: 'a1', name: 'L', spaceId: 'sp1' }],
  };

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec-1', payload: remotePayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      patchCount++;
      return jsonResponse(409, { error: 'remote_ahead', remoteEpoch: 99, localEpoch: 50 });
    }
    if (u.includes('/admin/orders') && method === 'POST') {
      postAdminCount++;
      const body = JSON.parse(init.body || '{}');
      remotePayload.dataEpoch = 51;
      remotePayload.orders = [body.order];
      return jsonResponse(200, { dataEpoch: 51, orderId: body.order.id, payload: remotePayload });
    }
    return jsonResponse(404, { error: 'not_found' });
  });

  sb.state.dataEpoch = 10;
  vm.runInContext("currentAdmin = { id: 'a1', spaceId: 'sp1' };", sb);
  const order = {
    id: 'local-adm-new',
    spaceId: 'sp1',
    customer: 'Тест',
    createdAt: '2026-10-11T12:00:00.000Z',
    source: 'dispatcher',
  };

  const r = await sb.upsertOrder(order);
  assert.equal(r.ok, true);
  assert.equal(postAdminCount, 1, 'POST /admin/orders once');
  assert.equal(patchCount, 0, 'no PATCH /state');
  assert.ok((sb.state.orders || []).some((o) => o.id === 'local-adm-new'), 'order kept locally');
});

await okAsync('8 parallel admin POST — all 200, no PATCH', async () => {
  let patchCount = 0;
  const remotePayload = { dataEpoch: 1, orders: [], shifts: [], admins: [] };
  const inflight = new Set();

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'r', payload: remotePayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      patchCount++;
      return jsonResponse(409, { error: 'state_guard_shrink' });
    }
    if (u.includes('/admin/orders') && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const id = body.order.id;
      inflight.add(id);
      await new Promise((r) => setTimeout(r, 5));
      remotePayload.orders = remotePayload.orders || [];
      if (!remotePayload.orders.some((o) => o.id === id)) {
        remotePayload.orders.push(body.order);
      }
      remotePayload.dataEpoch = (Number(remotePayload.dataEpoch) || 0) + 1;
      inflight.delete(id);
      return jsonResponse(200, { dataEpoch: remotePayload.dataEpoch, orderId: id, payload: remotePayload });
    }
    return jsonResponse(404, {});
  });

  vm.runInContext("currentAdmin = { id: 'a1', spaceId: 'sp1' };", sb);
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => {
      sb.state.orders = sb.state.orders || [];
      const order = {
        id: `par-${i}`,
        spaceId: 'sp1',
        customer: `C${i}`,
        createdAt: new Date().toISOString(),
      };
      sb.state.orders.unshift(order);
      return sb.persistAdminOrderImmediate(order, { isNew: true });
    }),
  );
  assert.ok(results.every((r) => r && r.ok), 'all pushes ok');
  assert.equal(patchCount, 0, 'no PATCH /state');
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nИТОГ: admin-orders-endpoint tests OK');
