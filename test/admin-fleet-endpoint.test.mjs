/**
 * Логист сохраняет парк через POST/PATCH fleet API, не PATCH /state.
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

function fakeAdminJwt() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

await okAsync('pushServerState admin → PATCH company, no fleet in PATCH /state', async () => {
  let patchStateCount = 0;
  let stateBodies = [];
  let companyPatchCount = 0;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'PATCH') {
      patchStateCount++;
      stateBodies.push(JSON.parse(init.body || '{}'));
      return jsonResponse(200, { ok: true, dataEpoch: 15 });
    }
    if (u.includes('/companies/co1') && method === 'PATCH') {
      companyPatchCount++;
      const body = JSON.parse(init.body || '{}');
      return jsonResponse(200, {
        rev: 2,
        dataEpoch: 14,
        company: body.company,
        payload: { dataEpoch: 14, companies: [body.company] },
      });
    }
    if (u.includes('/spaces/sp1/companies') && method === 'POST') {
      companyPatchCount++;
      const body = JSON.parse(init.body || '{}');
      return jsonResponse(200, {
        rev: 1,
        dataEpoch: 13,
        company: body.company,
        payload: { dataEpoch: 13, companies: [body.company] },
      });
    }
    if (u.includes('/auth/')) return jsonResponse(200, { token: fakeAdminJwt() });
    return jsonResponse(404, { error: 'not_found' });
  });

  sb.localStorage.setItem('armada_api_token_v1', fakeAdminJwt());
  sb.currentAdmin = { id: 'adm1', name: 'Логист', isSuper: false, spaceId: 'sp1' };
  sb.state.dataEpoch = 10;
  sb.state.companies = [
    {
      id: 'co1',
      name: 'Наша',
      roles: ['own'],
      spaceId: 'sp1',
      ratesByType: [],
      _entityRev: 1,
    },
  ];
  sb.state.finance = { markupPercent: 5 };
  sb.state.companies[0].ratesByType = [{ type: 'tent', city: { perHour: 900 } }];
  sb.reconcileBeforePush = async () => false;

  const r = await sb.pushServerState();
  assert.equal(r.ok, true);
  assert.equal(companyPatchCount, 1);
  assert.equal(patchStateCount, 1);
  const pl = stateBodies[0].payload || {};
  assert.equal(pl.companies, undefined);
  assert.equal(pl.vehicles, undefined);
  assert.equal(pl.drivers, undefined);
  assert.ok(pl.finance);
});

await okAsync('legacy fleet flag → PATCH /state with companies', async () => {
  let patchStateCount = 0;
  let companyPatchCount = 0;

  const sb = loadOrderSaveSandbox(async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || 'GET';
    if (u.includes('/state') && method === 'PATCH') {
      patchStateCount++;
      const body = JSON.parse(init.body || '{}');
      assert.ok(Array.isArray(body.payload.companies));
      return jsonResponse(200, { ok: true });
    }
    if (u.includes('/companies/') && method === 'PATCH') {
      companyPatchCount++;
      return jsonResponse(200, {});
    }
    return jsonResponse(404, {});
  });

  sb.localStorage.setItem('armada_api_token_v1', fakeAdminJwt());
  sb.localStorage.setItem('armada_admin_legacy_fleet_state', '1');
  sb.currentAdmin = { id: 'adm1', name: 'Логист', spaceId: 'sp1' };
  sb.state.companies = [{ id: 'co1', name: 'X', spaceId: 'sp1', roles: ['own'] }];
  sb.reconcileBeforePush = async () => false;

  await sb.pushServerState();
  assert.equal(companyPatchCount, 0);
  assert.equal(patchStateCount, 1);
});

if (failed) {
  process.exit(1);
}
console.log('admin-fleet-endpoint tests passed');
