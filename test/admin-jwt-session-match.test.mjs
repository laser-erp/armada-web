/**
 * Сессия супера + JWT логиста: не ходить в /state с чужим токеном и не подставлять sync.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadOrderSaveSandbox } from './order-save-409-harness.mjs';

function setCurrentAdmin(sb, row) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(row)}`, sb);
}

function fakeAdminJwt({ adminId, isSuper, spaceId }) {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      adminId,
      sub: adminId,
      isSuper: !!isSuper,
      spaceId: spaceId || null,
      exp: 9999999999,
    })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

function fakeSyncJwt() {
  const payload = Buffer.from(JSON.stringify({ role: 'sync', exp: 9999999999 })).toString('base64');
  return `hdr.${payload}.sig`;
}

const sb = loadOrderSaveSandbox(async () => ({ ok: false, status: 404 }));

sb.localStorage.setItem('armada_api_role_token_v1', fakeAdminJwt({ adminId: 'logist-1', isSuper: false, spaceId: 'sp1' }));
sb.localStorage.setItem('armada_api_sync_token_v1', fakeSyncJwt());
setCurrentAdmin(sb, { id: 'admin-super', name: 'Супер', isSuper: true, spaceId: 'sp-armada' });

assert.equal(sb.armadaAdminJwtMatchesSession(), false, 'super session vs logist JWT');
assert.equal(sb.armadaApiToken(), '', 'no bearer with mismatched admin JWT (no sync fallback)');

sb.setArmadaApiRoleToken(fakeAdminJwt({ adminId: 'admin-super', isSuper: true, spaceId: 'sp-armada' }));
setCurrentAdmin(sb, { id: 'admin-super', name: 'Супер', isSuper: true, spaceId: 'sp-armada' });
assert.equal(sb.armadaAdminJwtMatchesSession(), true);
assert.ok(sb.armadaApiToken().includes('admin-super') || sb.armadaApiToken().length > 10);

sb.pbRecordId = 'rec1';
sb.state.dataEpoch = 2;
sb.state.spaces = [{ id: 'sp-armada', name: 'Армада' }];
assert.equal(sb.armadaMaySendStateIfNoneMatch(), false, 'super: no If-None-Match');

console.log('admin-jwt-session-match tests passed');
