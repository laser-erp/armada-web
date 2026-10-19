/**
 * Супер-админ: настройки через PATCH /tenant/settings, не целиком PATCH /state.
 */
import assert from 'node:assert/strict';
import { jsonResponse, loadOrderSaveSandbox } from './order-save-409-harness.mjs';

function fakeSuperJwt() {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', isSuper: true, exp: 9999999999 })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

const sb = loadOrderSaveSandbox(async (url, init) => {
  const u = String(url);
  const method = (init && init.method) || 'GET';
  if (u.includes('/state') && method === 'PATCH') {
    const body = JSON.parse(init.body || '{}');
    assert.equal(body.payload.settings, undefined);
    assert.equal(body.payload.finance, undefined);
    return jsonResponse(200, { ok: true, dataEpoch: 99 });
  }
  if (u.includes('/tenant/settings') && method === 'PATCH') {
    return jsonResponse(200, {
      dataEpoch: 98,
      settings: { dadataToken: 'x' },
      finance: { markupPercent: 7 },
      payload: { dataEpoch: 98 },
    });
  }
  return jsonResponse(404, {});
});

sb.localStorage.setItem('armada_api_token_v1', fakeSuperJwt());
sb.currentAdmin = { id: 'adm-s', name: 'Супер', isSuper: true, spaceId: null };
sb.state.dataEpoch = 10;
sb.state.settings = { dadataToken: 'x' };
sb.state.finance = { markupPercent: 7 };
sb.reconcileBeforePush = async () => false;

const r = await sb.pushServerState();
assert.equal(r.ok, true);
console.log('admin-tenant-endpoint tests passed');
