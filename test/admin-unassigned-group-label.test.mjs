import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const admin = readFileSync(path.join(root, 'admin.js'), 'utf8');
const start = admin.indexOf('function adminShiftGroupIsUnassigned(g)');
const end = admin.indexOf('function buildAdminShiftDayGroups(orders)', start);
assert.ok(start >= 0 && end > start, 'slice admin.js: adminShiftGroupIsUnassigned');
const code = admin.slice(start, end);
const stubs = `
function waitingLogistDriver(name){
  const n=String(name||'').trim();
  return !n || n==='—' || n==='-' || n==='Биржа' || n==='Диспетчер';
}
function orderHasEffectiveAssignment(){ return false; }
function orderHasDriverVehicleAssigned(){ return false; }
`;
const sandbox = {};
vm.runInNewContext(stubs + code, sandbox);
const { adminShiftGroupIsUnassigned } = sandbox;

const unassignedGroup = {
  shift: null,
  driverName: 'Диспетчер',
  orders: [{ id: '1', driverName: 'Диспетчер', vehiclePlate: '—' }],
};
assert.equal(adminShiftGroupIsUnassigned(unassignedGroup), true);

const realShift = {
  shift: { id: 's1', startedAt: '2026-10-11' },
  driverName: 'Диспетчер',
  orders: [{ id: '1', driverName: 'Диспетчер' }],
};
assert.equal(adminShiftGroupIsUnassigned(realShift), false);

const withDriver = {
  shift: null,
  driverName: 'Иванов И.И.',
  orders: [{ id: '1', driverName: 'Иванов И.И.', vehiclePlate: 'А123АА' }],
};
assert.equal(adminShiftGroupIsUnassigned(withDriver), false);

console.log('admin-unassigned-group-label.test.mjs: ok');
