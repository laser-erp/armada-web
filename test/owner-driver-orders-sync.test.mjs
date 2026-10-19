/**
 * Частный перевозчик: заказы через POST /admin/orders; 409 order_already_exists = успех.
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

await okAsync('owner_driver: POST /admin/orders при persist', async () => {
  let postCount = 0;
  let patchState = 0;
  const remotePayload = { dataEpoch: 3, orders: [], shifts: [], drivers: [] };

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'r1', payload: remotePayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      patchState++;
      return jsonResponse(200, { dataEpoch: 4, payload: remotePayload });
    }
    if (u.includes('/admin/orders') && method === 'POST') {
      postCount++;
      const body = JSON.parse(init.body || '{}');
      remotePayload.orders = [body.order];
      remotePayload.dataEpoch = 5;
      return jsonResponse(200, { dataEpoch: 5, orderId: body.order.id, rev: 1, payload: remotePayload });
    }
    return jsonResponse(404, { error: 'not_found' });
  });

  vm.runInContext(
    "armadaApiTokenRole = () => 'owner_driver'; armadaApiToken = () => 'tok';",
    sb,
  );
  const order = {
    id: 'od-order-1',
    spaceId: 'sp-owner',
    customer: 'Клиент',
    createdAt: '2026-10-18T10:00:00.000Z',
    source: 'driver',
  };
  sb.state.orders = [order];
  const r = await sb.syncAdminOrdersAndShiftsFromState();
  assert.equal(r.ok, true);
  assert.equal(postCount, 1);
});

await okAsync('owner_driver: order_already_exists при повторном POST — ok', async () => {
  const remotePayload = { dataEpoch: 10, orders: [{ id: 'dup-1', spaceId: 'sp-owner' }], shifts: [] };
  let postCount = 0;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'r1', payload: remotePayload } });
    }
    if (u.includes('/admin/orders') && method === 'POST') {
      postCount++;
      return jsonResponse(409, { error: 'order_already_exists', orderId: 'dup-1' });
    }
    return jsonResponse(404, {});
  });

  vm.runInContext(
    "armadaApiTokenRole = () => 'owner_driver'; armadaApiToken = () => 'tok';",
    sb,
  );
  sb.state.orders = [
    {
      id: 'dup-1',
      spaceId: 'sp-owner',
      customer: 'X',
      createdAt: '2026-10-18T11:00:00.000Z',
    },
  ];
  const r = await sb.upsertAdminOrderOnServer(sb.state.orders[0]);
  assert.equal(r.ok, true);
  assert.equal(r.alreadyExists, true);
  assert.equal(postCount, 1);
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nИТОГ: owner-driver-orders-sync tests OK');
