/**
 * Лента дня логиста — полосы, «свободна с», пересечение (биржа неизменна), «успевает».
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadFleetRates(sandbox) {
  vm.runInNewContext(readFileSync(path.join(root, 'fleet-rates.js'), 'utf8'), sandbox, {
    filename: 'fleet-rates.js',
  });
}

function loadTimeline(sandbox) {
  vm.runInNewContext(readFileSync(path.join(root, 'admin-day-timeline.js'), 'utf8'), sandbox, {
    filename: 'admin-day-timeline.js',
  });
}

const stubs = `
function looksClosedOrder(o){ return !!(o && o.closedAt && !o.cancelledAt); }
function computeFreeAt(vehicleAt, order, fin){
  if(!vehicleAt) return null;
  const minW=Math.max(4, +(fin&&fin.minWorkHours)||4);
  return new Date(Date.parse(vehicleAt)+minW*3600000).toISOString();
}
function financeForOrder(){ return { minWorkHours: 4 }; }
function esc(s){ return String(s==null?'':s); }
function $(id){ return null; }
function routeText(){ return 'Москва — Тула'; }
function formatRuDateTimeAt(iso){
  const d=new Date(iso);
  return d.toISOString();
}
function openDetail(){}
function canAdminSeeOrder(){ return true; }
function matchesOwnerFilter(){ return true; }
function currentOwnCompany(){ return { id: 'co-arm' }; }
function fleetVehiclesForCompany(){ return []; }
function myCatalogVehicles(){ return []; }
function primaryDriverForVehicle(v){ return v && v._drv; }
function bodyTypeLabel(x){ return x; }
function mapVtypeToBodyType(){ return 'board'; }
function orderStatusClass(){ return 'assigned'; }
function isLogistInboxOrder(o){ return o && o._inbox; }
function orderHasDriverVehicleAssigned(o){ return o && o._assigned; }
function vehicleBusyAt(){ return false; }
function fleetVehiclesMatchingOrder(v){ return v; }
function adminFleetCompanyId(){ return 'co-arm'; }
`;

const sandbox = { state: { orders: [] }, console };
vm.runInNewContext(stubs, sandbox);
loadFleetRates(sandbox);
loadTimeline(sandbox);

const fr = sandbox.armadaFleetRates;
const ymd = '2026-10-16';
const t08 = `${ymd}T08:00:00.000Z`;
const t09 = `${ymd}T09:00:00.000Z`;
const t10 = `${ymd}T10:00:00.000Z`;
const t11 = `${ymd}T11:00:00.000Z`;
const t12 = `${ymd}T12:00:00.000Z`;
const t14 = `${ymd}T14:00:00.000Z`;

// ——— orderScheduleEndMs как в develop: freeAt → computeFreeAt → +4 ч ———
const withFreeAt = { id: 'w1', vehicleAt: t08, freeAt: t11 };
assert.equal(fr.orderScheduleEndMs(withFreeAt), Date.parse(t11));

const fallbackSchedule = { id: 'w2', vehicleAt: t08 };
assert.equal(fr.orderScheduleEndMs(fallbackSchedule), Date.parse(t08) + 4 * 3600000);

// ——— findVehicleScheduleConflicts: эталонные интервалы (+4 ч) ———
const vehicle = { id: 'v1', plate: 'А111АА77' };
sandbox.state.orders = [
  { id: 'o-a', vehiclePlate: 'А111АА77', vehicleAt: t08 },
  { id: 'o-b', vehiclePlate: 'А111АА77', vehicleAt: t09 },
];
const conflicts = fr.findVehicleScheduleConflicts(vehicle, sandbox.state.orders[1]);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].id, 'o-a');

const noConflict = fr.findVehicleScheduleConflicts(vehicle, {
  id: 'o-c',
  vehiclePlate: 'А111АА77',
  vehicleAt: `${ymd}T13:00:00.000Z`,
});
assert.equal(noConflict.length, 0);

// ——— adminDayTimelineBarEndMs: закрыт, иначе +3 ч без freeAt/compute ———
const closed = { id: 'c1', vehicleAt: t08, closedAt: t11, routeKm: 40 };
assert.equal(sandbox.adminDayTimelineBarEndMs(closed), Date.parse(t11));

const barViaCompute = { id: 'b1', vehicleAt: t08 };
assert.equal(sandbox.adminDayTimelineBarEndMs(barViaCompute), Date.parse(t08) + 4 * 3600000);

const barOnly3 = { id: 'b2', vehicleAt: t08 };
const computeOrig = sandbox.computeFreeAt;
sandbox.computeFreeAt = () => null;
assert.equal(
  sandbox.adminDayTimelineBarEndMs(barOnly3),
  Date.parse(t08) + sandbox.ADMIN_DAY_TIMELINE_FALLBACK_HOURS * 3600000,
);
sandbox.computeFreeAt = computeOrig;

// ——— пересечение на ленте через findVehicleScheduleConflicts ———
const veh = { id: 'v1', plate: 'А111АА77', _drv: { name: 'Петров' } };
const vehOrders = [
  { id: 'o-a', vehiclePlate: 'А111АА77', vehicleAt: t08 },
  { id: 'o-b', vehiclePlate: 'А111АА77', vehicleAt: t09 },
];
sandbox.state.orders = vehOrders;
const segs = sandbox.adminDayTimelineOverlapSegments(veh, vehOrders);
assert.ok(segs.length >= 1);
assert.ok(segs[0].mins > 0);

// ——— «свободна с» ———
const freeLbl = sandbox.adminDayTimelineFreeLabel(veh, [{ id: 'x1', vehiclePlate: 'А111АА77', vehicleAt: t08 }], ymd);
assert.match(freeLbl, /свободна с/);
assert.equal(sandbox.adminDayTimelineFreeLabel(veh, [], ymd), 'свободна весь день');

// ——— «успевает» ———
sandbox.fleetVehiclesForCompany = function () {
  return [veh];
};
const inbox = {
  id: 'in1',
  _inbox: true,
  vehicleAt: t14,
  ownCompanyId: 'co-arm',
  reqBodyType: 'board',
};
assert.match(sandbox.adminDayTimelineFitsHint(inbox), /успевает:/);

// ——— «ближайшая» при занятости (как №906 / Петров / №903) ———
const petrovVeh = {
  id: 'v-pet',
  plate: 'В222ВВ77',
  bodyType: 'board',
  _drv: { name: 'Петров П.П.' },
};
const ivanVeh = {
  id: 'v-ivan',
  plate: 'А111АА77',
  bodyType: 'tent',
  _drv: { name: 'Иванов И.И.' },
};
sandbox.fleetVehiclesForCompany = function () {
  return [ivanVeh, petrovVeh];
};
sandbox.fleetVehiclesMatchingOrder = function (vehicles, order) {
  if (order && order.reqBodyType === 'board') {
    return vehicles.filter((v) => v.bodyType === 'board');
  }
  return vehicles;
};
sandbox.state.orders = [
  { id: 'o903', vehiclePlate: 'В222ВВ77', vehicleAt: t11, ownCompanyId: 'co-arm' },
];
const inbox906 = {
  id: 'in906',
  _inbox: true,
  vehicleAt: t10,
  ownCompanyId: 'co-arm',
  reqBodyType: 'board',
};
const hint906 = sandbox.adminDayTimelineFitsHint(inbox906);
assert.match(hint906, /свободных машин к 10:00 нет/);
assert.match(hint906, /ближайшая:\s*Петров П\.П\./);
assert.match(hint906, /с 15:00/);

// ——— строка «Партнёры с биржи» ———
sandbox.state.orders = [
  { id: 'p1', partnerSpaceId: 'partner-x', vehicleAt: t12, ownCompanyId: 'co-arm' },
];
sandbox.fleetVehiclesForCompany = function () {
  return [ivanVeh];
};
sandbox.state.adminDayTimelineYmd = ymd;
const boardHtml = sandbox.renderAdminDayTimelineBoard();
assert.match(boardHtml, /day-tl-row--partner/);
assert.match(boardHtml, /Партнёры с биржи/);
assert.match(boardHtml, /day-tl-bar/);

console.log('admin-day-timeline.test.mjs: ok');
