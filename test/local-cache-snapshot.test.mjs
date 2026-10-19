/**
 * Этап 6: localStorage — узкий кэш без PIN и без чужого space.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadOrderSaveSandbox } from './order-save-409-harness.mjs';

function setCurrentAdmin(sb, row) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(row)}`, sb);
}

function fakeAdminJwt(spaceId = 'sp1') {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', spaceId, exp: 9999999999 })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

const sb = loadOrderSaveSandbox(async () => ({ ok: false, status: 404 }));
sb.localStorage.setItem('armada_api_token_v1', fakeAdminJwt('sp1'));

sb.state.spaces = [
  { id: 'sp1', name: 'А' },
  { id: 'sp2', name: 'Б' },
];
sb.state.admins = [
  { id: 'a1', name: 'Логист', pin: '1234', spaceId: 'sp1' },
  { id: 'a2', name: 'Чужой', pin: '5678', spaceId: 'sp2' },
];
sb.state.orders = [
  { id: 'o1', spaceId: 'sp1', status: 'new' },
  { id: 'o2', spaceId: 'sp2', status: 'new' },
];
setCurrentAdmin(sb, { id: 'a1', name: 'Логист', isSuper: false, spaceId: 'sp1' });

sb.persistLocalOnly();
const raw = sb.localStorage.getItem('armada_local_cache_v1');
assert.ok(raw);
assert.equal(sb.localStorage.getItem('armada_app_v5'), null);
const parsed = JSON.parse(raw);
assert.equal(parsed.cacheVersion, 1);
assert.ok(!parsed.admins.some((a) => a.pin));
assert.ok(!parsed.orders.some((o) => o.id === 'o2'));
assert.ok(!parsed.admins.some((a) => a.id === 'a2'));

setCurrentAdmin(sb, { id: 'admin-super', name: 'Супер', isSuper: true, spaceId: 'sp1' });
sb.persistLocalOnly();
const superRaw = JSON.parse(sb.localStorage.getItem('armada_local_cache_v1'));
assert.equal(superRaw.spaces.length, 2, 'super cache keeps all spaces');

console.log('local-cache-snapshot tests passed');
