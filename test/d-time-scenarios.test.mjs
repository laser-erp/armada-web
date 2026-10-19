/**
 * QA раздел D — «Рабочее время и планирование» (docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md)
 * Локальные проверки формул из web-preview/app.js (без staging-записи).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(path.join(root, 'app.js'), 'utf8');

function sliceBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `end marker not found after ${startMarker}`);
  return src.slice(start, end);
}

const timeFns = sliceBetween(
  appSrc,
  'function dayTotal(o)',
  'function orderTimesLines(o)',
);
const closedFn = sliceBetween(appSrc, 'function looksClosedOrder(o)', 'function orderCancelled(o)');
const busyFn = sliceBetween(appSrc, 'function vehicleBusyAt', 'function availableFleetForCustomer');
const freeFn = sliceBetween(appSrc, 'function computeFreeAt', 'function applyOrderSchedule');
const linkFns = sliceBetween(
  appSrc,
  'function findOrderAwaitingEmptyAfterLink',
  'function lastFuelRemainingLiters',
);

const stubs = `
const DEFAULT_FINANCE = { minWorkHours: 4, podachaHours: 1 };
const DRIVER = 'Иванов';
function round2(v){ return Math.round(v*100)/100; }
function isUnassignedPortalOrder(){ return false; }
function orderKeepsLogist(){ return false; }
function orderNeverStartedTrip(o){ return !!(o && o.startOdometer==null && o.departOdometer==null); }
function samePersonName(a,b){ return String(a||'').trim()===String(b||'').trim(); }
function applyClientTariff(){}
function bumpDataEpoch(){}
function upsertOrder(){}
function orderById(id){ return (state.orders||[]).find(o=>o&&o.id===id)||null; }
`;

const sandbox = { state: { orders: [] } };
vm.runInNewContext(stubs + closedFn + timeFns + busyFn + freeFn + linkFns, sandbox);

const {
  recomputeOrderTimes,
  minutesBetween,
  hoursFromMinutes,
  vehicleBusyAt,
  computeFreeAt,
  linkEmptyAfterFromNextEmptyBefore,
  findOrderAwaitingEmptyAfterLink,
  dayTotal,
} = sandbox;

// ——— D1: recomputeOrderTimes после одометров / ISO-меток ———
const t0 = '2026-10-11T08:00:00.000Z';
const t1 = '2026-10-11T09:30:00.000Z'; // +90 мин до заказа
const t2 = '2026-10-11T11:30:00.000Z'; // +120 мин с грузом
const t3 = '2026-10-11T12:00:00.000Z'; // +30 мин до стоянки
const t4 = '2026-10-11T12:00:00.000Z';

assert.equal(minutesBetween(t0, t1), 90);
assert.equal(hoursFromMinutes(90), 1.5);

const d1 = {
  departAt: t0,
  arrivedAt: t1,
  endAt: t2,
  parkingAt: t3,
  closedAt: t4,
};
recomputeOrderTimes(d1);
assert.equal(d1.timeToOrderMin, 90);
assert.equal(d1.timeLoadedMin, 120);
assert.equal(d1.timeToParkingMin, 30);
assert.equal(d1.timeTotalMin, 240);
assert.equal(d1.timeToOrderHours, 1.5);
assert.equal(d1.timeLoadedHours, 2);
assert.equal(d1.timeToParkingHours, 0.5);
assert.equal(d1.timeTotalHours, 4);

// ——— D2: workHours из timeLoadedHours (логика finalizeClose) ———
const d2 = { arrivedAt: t1, endAt: t2, workHours: null };
recomputeOrderTimes(d2);
assert.equal(d2.timeLoadedHours, 2);
if (d2.timeLoadedHours != null && !(d2.workHours > 0)) {
  d2.workHours = d2.timeLoadedHours;
}
assert.equal(d2.workHours, 2);
const d2keep = { arrivedAt: t1, endAt: t2, workHours: 5 };
recomputeOrderTimes(d2keep);
if (d2keep.timeLoadedHours != null && !(d2keep.workHours > 0)) {
  d2keep.workHours = d2keep.timeLoadedHours;
}
assert.equal(d2keep.workHours, 5, 'ручные workHours не перетираются');

// ——— D3: vehicleBusyAt + computeFreeAt (календарь броней) ———
sandbox.state.orders = [
  {
    id: 'o-busy-book',
    bookedPlate: 'А111АА77',
    bookStatus: 'requested',
    vehicleAt: '2026-10-11T10:00:00.000Z',
    createdAt: '2026-10-11T09:00:00.000Z',
  },
  {
    id: 'o-closed',
    vehiclePlate: 'В222ВВ77',
    closedAt: '2026-10-10T18:00:00.000Z',
    endOdometer: 100,
    loadedKm: 10,
    startOdometer: 90,
    emptyKmAfter: 0,
    vehicleAt: '2026-10-11T10:00:00.000Z',
  },
  {
    id: 'o-trip',
    vehiclePlate: 'С333СС77',
    startOdometer: 1000,
    vehicleAt: '2026-10-11T10:00:00.000Z',
  },
  {
    id: 'o-free',
    vehiclePlate: 'Д444ДД77',
    vehicleAt: '2026-10-11T08:00:00.000Z',
    freeAt: '2026-10-11T09:00:00.000Z',
  },
];

assert.equal(
  vehicleBusyAt('А111АА77', '2026-10-11T10:30:00.000Z'),
  true,
  'бронь requested в окне ±3ч',
);
assert.equal(vehicleBusyAt('В222ВВ77', '2026-10-11T10:00:00.000Z'), false, 'закрытый не занимает');
assert.equal(vehicleBusyAt('С333СС77', '2026-10-11T20:00:00.000Z'), true, 'рейс начат — занят');
assert.equal(
  vehicleBusyAt('Д444ДД77', '2026-10-11T10:00:00.000Z'),
  true,
  'в пределах 3 ч от подачи — ещё занят (даже после freeAt)',
);
assert.equal(
  vehicleBusyAt('Д444ДД77', '2026-10-11T11:30:00.000Z'),
  false,
  'после окна 3 ч от подачи — свободен',
);

const freeAt = computeFreeAt('2026-10-11T08:00:00.000Z', { workHours: 6 }, { minWorkHours: 4 });
assert.equal(freeAt, '2026-10-11T14:00:00.000Z', 'освобождение = подача + max(4, workHours)');

const freeEst = computeFreeAt('2026-10-11T08:00:00.000Z', { estimateWorkHours: 3 }, { minWorkHours: 4 });
assert.equal(freeEst, '2026-10-11T12:00:00.000Z', 'мин. 4 ч если estimate меньше');

// D3: после GET /state поля брони не затираются при merge (гонка с POST /admin/orders)
const mergeFns = sliceBetween(appSrc, 'function shouldBlockPhantomCloseMerge', 'function mergeLocalOrders');
const mergeSandbox = {
  state: { orders: [] },
  structuredClone: (v) => JSON.parse(JSON.stringify(v)),
};
vm.runInNewContext(
  `
function looksClosedOrder(){ return false; }
function isUnassignedPortalOrder(){ return false; }
function orderKeepsLogist(){ return false; }
function orderNeverStartedTrip(){ return true; }
function orderHasDriverVehicleAssigned(){ return false; }
function mergeOrderAssignmentFields(){ return false; }
function mergeOrderEtrn(){ return false; }
function healPhantomPortalClose(){ return false; }
function orderAssignmentSnapshot(){ return {}; }
function restoreOrderAssignmentIfLost(){ return false; }
function healOrderDriverAssignment(){ return false; }
${mergeFns}
`,
  mergeSandbox,
);
const { mergeOrderFields, mergeTwoOrderCopies } = mergeSandbox;
const afterFetch = {
  id: 'qa-d3-merge',
  customerSubmitted: true,
  cargoDescription: 'D-TIME-W',
};
const localSeed = {
  ...afterFetch,
  bookedPlate: 'А000ТЕ99',
  bookStatus: 'requested',
  vehicleAt: '2026-10-12T11:00:00.000Z',
};
assert.ok(mergeOrderFields(afterFetch, localSeed), 'bookedPlate с локальной копии');
assert.equal(afterFetch.bookedPlate, 'А000ТЕ99');
assert.equal(afterFetch.bookStatus, 'requested');
const remoteWins = { id: 'qa-d3-merge', bookedPlate: null, bookStatus: null, vehicleAt: null };
const localBook = { ...remoteWins, bookedPlate: 'А000ТЕ99', bookStatus: 'requested', vehicleAt: '2026-10-12T11:00:00.000Z' };
assert.ok(mergeTwoOrderCopies(remoteWins, localBook));
assert.equal(remoteWins.bookedPlate, 'А000ТЕ99');

// D3: GET /state с null-бронью и «богаче» одометрами не сносит локальную бронь (Object.assign)
const curBook = {
  id: 'qa-d3-assign',
  customerSubmitted: true,
  bookedPlate: 'А000ТЕ99',
  bookStatus: 'requested',
  vehicleAt: '2026-10-12T11:00:00.000Z',
};
const staleRemote = {
  id: 'qa-d3-assign',
  customerSubmitted: true,
  bookedPlate: null,
  bookStatus: null,
  vehicleAt: '2026-10-12T11:00:00.000Z',
  departOdometer: 100010,
  startOdometer: 100025,
};
assert.ok(mergeTwoOrderCopies(curBook, staleRemote));
assert.equal(curBook.bookedPlate, 'А000ТЕ99', 'бронь после merge с stale remote');
assert.equal(curBook.bookStatus, 'requested');

const curLink = {
  id: 'qa-d4-merge',
  closedAt: '2026-10-11T14:00:00.000Z',
  endOdometer: 100050,
  linkEmptyAfterToNext: true,
  emptyKmAfter: 0,
};
const remoteClosed = {
  id: 'qa-d4-merge',
  closedAt: '2026-10-11T14:00:00.000Z',
  endOdometer: 100050,
  startOdometer: 100025,
  loadedKm: 25,
  linkEmptyAfterToNext: null,
  emptyKmAfter: null,
};
mergeTwoOrderCopies(curLink, remoteClosed);
assert.equal(curLink.linkEmptyAfterToNext, true, 'флаг линковки км после merge');
assert.equal(curLink.emptyKmAfter, 0);
assert.equal(curLink.startOdometer, 100025, 'одометры с более полной копии');

// ——— D4: второй рейс — link emptyKmAfter / emptyKmBefore ———
sandbox.state.orders = [
  {
    id: 'prev',
    sequentialNumber: 101,
    closedAt: '2026-10-11T14:00:00.000Z',
    endOdometer: 500,
    linkEmptyAfterToNext: true,
    vehiclePlate: 'Е555ЕЕ77',
    driverName: 'Иванов',
  },
];
const next = {
  id: 'next',
  sequentialNumber: 102,
  emptyKmBefore: 17,
  arrivedAt: '2026-10-11T15:00:00.000Z',
  vehiclePlate: 'Е555ЕЕ77',
  driverName: 'Иванов',
};
const linked = linkEmptyAfterFromNextEmptyBefore(next);
assert.ok(linked && linked.id === 'prev');
assert.equal(linked.emptyKmAfter, 17);
assert.equal(linked.emptyAfterLinkedFromNext, true);
assert.equal(linked.linkEmptyAfterToNext, false);
assert.equal(dayTotal({ emptyKmBefore: 5, loadedKm: 40, emptyKmAfter: 17 }), 62);

const pending = findOrderAwaitingEmptyAfterLink(next);
assert.equal(pending, null, 'после линковки ожидание снято');

sandbox.state.shift = { pendingEmptyAfterOrderId: 'prev' };
sandbox.state.orders[0].linkEmptyAfterToNext = false;
const viaPending = findOrderAwaitingEmptyAfterLink(next);
assert.ok(viaPending && viaPending.id === 'prev', 'pendingEmptyAfterOrderId находит предыдущий заказ');

// ——— D5: автопланировщик 2-го рейса — нет в коде ———
assert.equal(/\bautoPlanSecondTrip\b|\bautoplan\w*Second\b/i.test(appSrc), false);
assert.equal(/\bподбор заказа по времени\b/i.test(appSrc), false);

// ——— D6: полная смена 8–12 ч — нет alarm, только поля времени на заказе ———
assert.equal(/\bshiftHoursAlarm\b|\balarmShiftHours\b|лимит\s+смен/i.test(appSrc), false);
const shiftOrders = [d1, { timeTotalHours: 3.5 }, { timeTotalHours: 5 }];
const accounted = shiftOrders.reduce((s, o) => s + (o.timeTotalHours || 0), 0);
assert.equal(accounted, 12.5, 'учёт часов суммой timeTotalHours по заказам');

for (const code of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
  console.log(`ШАГ ${code}: готово`);
}
console.log('d-time-scenarios.test.mjs: ok (D1–D6)');
