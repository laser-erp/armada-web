/**
 * Этап 5: договоры/шаблоны — PATCH entity API, не целиком PATCH /state.
 */
import assert from 'node:assert/strict';
import { jsonResponse, loadOrderSaveSandbox } from './order-save-409-harness.mjs';

function fakeAdminJwt(spaceId = 'sp1') {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', isSuper: false, spaceId, adminId: 'adm1', exp: 9999999999 })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

const sb = loadOrderSaveSandbox(async (url, init) => {
  const u = String(url);
  const method = (init && init.method) || 'GET';
  if (u.includes('/state') && method === 'PATCH') {
    const body = JSON.parse(init.body || '{}');
    assert.equal(body.payload.contracts, undefined);
    assert.equal(body.payload.invoices, undefined);
    assert.equal(body.payload.docTemplates, undefined);
    assert.equal(body.payload.epdBySpace, undefined);
    return jsonResponse(200, { ok: true, dataEpoch: 99 });
  }
  if (u.includes('/contracts') && (method === 'PATCH' || method === 'POST')) {
    return jsonResponse(200, {
      dataEpoch: 98,
      rev: 2,
      contract: { id: 'ctr-1', spaceId: 'sp1', contractNumber: 'Д-1' },
      payload: { dataEpoch: 98 },
    });
  }
  if (u.includes('/documents') && method === 'PATCH') {
    return jsonResponse(200, { dataEpoch: 97, rev: 1, docTemplates: { spaces: { sp1: {} } } });
  }
  return jsonResponse(404, {});
});

sb.localStorage.setItem('armada_api_token_v1', fakeAdminJwt());
sb.currentAdmin = { id: 'adm1', name: 'Логист', isSuper: false, spaceId: 'sp1' };
sb.state.dataEpoch = 10;
sb.state.contracts = [
  { id: 'ctr-1', spaceId: 'sp1', contractNumber: 'Д-1', contractDate: '2026-01-01', status: 'draft' },
];
sb.state.docTemplates = { spaces: { sp1: { tn: { body: 'b' } } }, platform: {} };
sb.reconcileBeforePush = async () => false;

const r = await sb.pushServerState();
assert.equal(r.ok, true);
console.log('admin-documents-endpoint tests passed');
