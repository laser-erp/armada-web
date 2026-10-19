/**
 * Водитель сохраняет смену через POST/PATCH /shifts, не PATCH /state.
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

function fakeDriverJwt() {
  const payload = Buffer.from(JSON.stringify({ role: 'driver', exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

await okAsync('pushServerState driver → PATCH /shifts, no PATCH /state', async () => {
  let patchStateCount = 0;
  let shiftPatchCount = 0;
  const remotePayload = {
    dataEpoch: 10,
    orders: [],
    shifts: [],
    spaces: [{ id: 'sp1', name: 'Тест' }],
    companies: [{ id: 'co1', name: 'Наша', roles: ['own'], spaceId: 'sp1' }],
  };

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'PATCH') {
      patchStateCount++;
      return jsonResponse(403, { error: 'forbidden' });
    }
    if (u.includes('/shifts') && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      remotePayload.dataEpoch = 11;
      remotePayload.shifts = [body.shift];
      return jsonResponse(200, {
        dataEpoch: 11,
        rev: 1,
        shift: body.shift,
        payload: remotePayload,
      });
    }
    if (u.includes('/shifts/') && method === 'PATCH') {
      shiftPatchCount++;
      const body = JSON.parse(init.body || '{}');
      remotePayload.dataEpoch = 12;
      remotePayload.shifts = [body.shift];
      return jsonResponse(200, {
        dataEpoch: 12,
        rev: 2,
        shift: body.shift,
        payload: remotePayload,
      });
    }
    return jsonResponse(404, { error: 'not_found' });
  });

  sb.localStorage.setItem('armada_api_token_v1', fakeDriverJwt());
  sb.DRIVER = 'Иванов Иван';
  sb.state.dataEpoch = 5;
  sb.state.shift = {
    id: 'sh-drv-1',
    spaceId: 'sp1',
    driverName: 'Иванов Иван',
    ownCompanyId: 'co1',
    startedAt: '2026-10-12T08:00:00.000Z',
    odometer: 1000,
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];
  sb.reconcileBeforePush = async () => false;

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.equal(r.driverShiftSync, true);
  assert.equal(patchStateCount, 0);
  assert.equal(shiftPatchCount, 0);
  assert.equal(sb.state.shift._entityRev, 1);
});

await okAsync('persistDriverShiftImmediate → PATCH /shifts с rev', async () => {
  let patchStateCount = 0;
  let shiftPatchCount = 0;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'PATCH') {
      patchStateCount++;
      return jsonResponse(403, {});
    }
    if (u.includes('/shifts/sh-rev') && method === 'PATCH') {
      shiftPatchCount++;
      const body = JSON.parse(init.body || '{}');
      assert.equal(body.expectedRev, 3);
      return jsonResponse(200, { rev: 4, shift: body.shift, dataEpoch: 20 });
    }
    return jsonResponse(404, {});
  });

  sb.localStorage.setItem('armada_api_token_v1', fakeDriverJwt());
  sb.DRIVER = 'Иванов';
  sb.state.shift = {
    id: 'sh-rev',
    spaceId: 'sp1',
    driverName: 'Иванов',
    _entityRev: 3,
    startedAt: '2026-10-12T08:00:00.000Z',
  };
  sb.state.shifts = [structuredClone(sb.state.shift)];

  const r = await sb.persistDriverShiftImmediate();
  assert.equal(r.ok, true);
  assert.equal(patchStateCount, 0);
  assert.equal(shiftPatchCount, 1);
  assert.equal(sb.state.shift._entityRev, 4);
});

if (failed) {
  process.exit(1);
}
console.log('driver-shifts-endpoint tests passed');
