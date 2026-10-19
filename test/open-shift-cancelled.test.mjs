import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(path.join(root, 'app.js'), 'utf8');
const start = app.indexOf('function looksClosedOrder(o)');
const end = app.indexOf('function orderAwaitingFinalize(o)', start);
assert.ok(start >= 0 && end > start, 'slice app.js: looksClosedOrder block');
const code = app.slice(start, end);
const stubs = `
function orderNeverStartedTrip(o){ return !!(o && o.startOdometer==null && o.departOdometer==null); }
function isUnassignedPortalOrder(){ return false; }
function orderKeepsLogist(){ return false; }
`;
const sandbox = {};
vm.runInNewContext(stubs + code, sandbox);

const { looksClosedOrder, orderCancelled, orderBlocksOpenShiftGroup } = sandbox;

assert.equal(orderCancelled({ cancelledAt: '2026-09-24' }), true);
assert.equal(orderCancelled({ cancelled: true }), true);
assert.equal(orderCancelled({}), false);

assert.equal(looksClosedOrder({ cancelledAt: '2026-09-24' }), false);
assert.equal(orderBlocksOpenShiftGroup({ cancelledAt: '2026-09-24' }), false);
assert.equal(orderBlocksOpenShiftGroup({ cancelled: true, startOdometer: 1 }), false);

assert.equal(orderBlocksOpenShiftGroup({ closedAt: '2026-09-24' }), false);
assert.equal(orderBlocksOpenShiftGroup({ startOdometer: 100 }), true);

const list = [
  { id: 'a', cancelledAt: '2026-09-24' },
  { id: 'b', closedAt: '2026-09-24' },
];
assert.equal(list.some((o) => orderBlocksOpenShiftGroup(o)), false);
assert.equal(
  [{ id: 'c', startOdometer: 1 }].some((o) => orderBlocksOpenShiftGroup(o)),
  true,
);

// Реальная смена: открытость только по endedAt (не по наличию «блокирующих» заказов).
const shiftOpenNoOrders = { startedAt: '2026-10-11T08:00:00', endedAt: null, orders: [] };
assert.equal(!shiftOpenNoOrders.endedAt, true, 'открытая смена без заказов = открыта');
const onlyCancelled = [{ id: 'x', cancelledAt: '2026-09-24' }];
assert.equal(
  !shiftOpenNoOrders.endedAt && onlyCancelled.some((o) => orderBlocksOpenShiftGroup(o)),
  false,
  'старая формула ошибочно закрывала смену с одними отменёнными',
);
assert.equal(!shiftOpenNoOrders.endedAt, true);

console.log('open-shift-cancelled.test.mjs: ok');
