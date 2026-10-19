/**
 * Отказ push (409 shrink без восстановления) не должен считаться успехом sync.
 * Запуск: node web-preview/test/push-false-success.test.mjs
 */
import assert from 'node:assert/strict';
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

await okAsync('pushServerState: вечный shrink без восстановления → не ok', async () => {
  const fullPayload = {
    dataEpoch: 100,
    orders: [
      { id: 'srv-1', customer: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'srv-2', customer: 'B', createdAt: '2026-01-02T00:00:00.000Z' },
    ],
    shifts: [],
    admins: [],
  };
  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec-shrink', payload: fullPayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(409, { error: 'state_guard_shrink', shrunk: ['orders'] });
    }
    return jsonResponse(404, {});
  });
  sb.state.dataEpoch = 100;
  sb.state.orders = [{ id: 'o1', customer: 'X', createdAt: '2026-10-11T12:00:00.000Z' }];
  const r = await sb.pushServerState();
  assert.equal(r.aborted, true);
  assert.equal(r.reason, 'state_guard_shrink');
  assert.notEqual(sb.isPushServerStateSuccess(r), true);
});

await okAsync('persistAdminPinImmediate: shrink → ok:false, sync не ok', async () => {
  const fullPayload = {
    dataEpoch: 50,
    orders: [{ id: 'srv-x', customer: 'A', createdAt: '2026-01-01T00:00:00.000Z' }],
    shifts: [],
    admins: [],
  };
  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec-shrink2', payload: fullPayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(409, { error: 'state_guard_shrink', shrunk: ['orders'] });
    }
    return jsonResponse(404, {});
  });
  sb.state.dataEpoch = 50;
  sb.state.orders = [{ id: 'o2', customer: 'Y', createdAt: '2026-10-11T12:00:00.000Z' }];
  const res = await sb.persistAdminPinImmediate();
  assert.equal(res.ok, false);
  assert.ok(res.message && res.message.includes('Не сохранилось на сервере'));
  assert.ok(res.message.includes('state_guard_shrink'));
  sb.armadaClearSyncPushRetry();
});

await okAsync('persistAdminPinImmediate: PATCH 200 → ok:true, syncStatus ok', async () => {
  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, {
        record: { id: 'rec-ok', payload: { dataEpoch: 10, orders: [], shifts: [], admins: [] } },
      });
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(200, { recordId: 'rec-ok' });
    }
    return jsonResponse(404, {});
  });
  sb.state.dataEpoch = 10;
  sb.state.orders = [];
  const res = await sb.persistAdminPinImmediate();
  assert.equal(res.ok, true);
  assert.equal(sb.armadaGetSyncStatus(), 'ok');
});

await okAsync('pushServerStateQueued: отказ → throw, без applySyncPushSuccess', async () => {
  const fullPayload = { dataEpoch: 1, orders: [], shifts: [], admins: [] };
  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'GET') {
      return jsonResponse(200, { record: { id: 'rec-q', payload: fullPayload } });
    }
    if (u.includes('/state') && method === 'PATCH') {
      return jsonResponse(409, { error: 'state_guard_shrink', shrunk: ['orders'] });
    }
    return jsonResponse(404, {});
  });
  sb.state.dataEpoch = 1;
  sb.state.orders = [];
  let threw = false;
  try {
    await sb.pushServerStateQueued();
  } catch (e) {
    threw = true;
    assert.ok(String(e.message).includes('Не сохранилось на сервере'));
  }
  assert.equal(threw, true);
  assert.notEqual(sb.armadaGetSyncStatus(), 'ok');
  sb.armadaClearSyncPushRetry();
});

if (failed > 0) {
  console.error(`\nИТОГ: ${failed} failed`);
  process.exit(1);
}
console.log('\nИТОГ: push-false-success tests OK');
