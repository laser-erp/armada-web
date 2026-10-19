/**
 * Политика If-None-Match на клиенте (дублирует store.js armadaMaySendStateIfNoneMatch).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

function localStateHasData(state) {
  if (!state || typeof state !== 'object') return false;
  if (Number(state.dataEpoch) > 0) return true;
  return ['spaces', 'admins', 'orders', 'companies', 'drivers', 'vehicles', 'shifts'].some(
    (k) => Array.isArray(state[k]) && state[k].length > 0,
  );
}

function maySendIfNoneMatch(pbRecordId, state) {
  return !!(pbRecordId && localStateHasData(state));
}

test('пустой кэш — без If-None-Match', () => {
  assert.equal(maySendIfNoneMatch(null, { admins: [{ id: '1' }] }), false);
  assert.equal(maySendIfNoneMatch('rec1', {}), false);
  assert.equal(maySendIfNoneMatch('', { dataEpoch: 2 }), false);
});

test('данные загружены — можно If-None-Match', () => {
  assert.equal(maySendIfNoneMatch('rec1', { dataEpoch: 1 }), true);
  assert.equal(maySendIfNoneMatch('rec1', { orders: [{ id: 'o1' }] }), true);
});

test('unchanged не затирает payload при merge', () => {
  const rec = { id: 'rec1', unchanged: true };
  const local = { orders: [{ id: 'o1' }] };
  let applied = false;
  if (rec && !rec.unchanged && rec.payload) {
    applied = true;
    Object.assign(local, rec.payload);
  }
  assert.equal(applied, false);
  assert.equal(local.orders[0].id, 'o1');
});

console.log('state-etag-policy.test.mjs: OK');
