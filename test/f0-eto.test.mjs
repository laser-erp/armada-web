/**
 * QA F0: подключение водителя и ЕТО (локальные проверки по docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md §F0).
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  completeEto,
  loadF0Sandbox,
  runEtoThrough,
  seedF0World,
  setDriverSession,
} from './f0-eto-harness.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const results = [];

function record(id, status, fact) {
  results.push({ id, status, fact });
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function todayIso() {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

// —— F0.1 приглашение ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  const res = await sb.createDriverInvite(0);
  assert.equal(res.ok, true);
  assert.ok(res.invite?.token?.length > 10);
  assert.match(res.url, /invite\.html\?token=/);
  assert.equal(sb.state.driverInvites.length, 1);
  record('F0.1', '✅', `createDriverInvite: token len=${res.invite.token.length}, invites=1`);
}

// —— F0.2 ссылка / вход ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  assert.equal(sb.findValidDriverInvite(''), null);
  assert.equal(sb.findValidDriverInvite('bad-token'), null);
  const inv = await sb.createDriverInvite(0);
  const ok = sb.findValidDriverInvite(inv.invite.token);
  assert.ok(ok);
  const use = sb.consumeDriverInvite(inv.invite.token, '9876');
  assert.equal(use.ok, true);
  assert.equal(sb.state.drivers[0].pin, '9876');
  const inviteJs = readFileSync(path.join(__dir, '..', 'invite.js'), 'utf8');
  assert.ok(inviteJs.includes('Запросите новую ссылку у диспетчера'));
  setDriverSession(sb, 'Иванов Иван');
  sb.state.vehicles.push({
    id: 'v-other',
    plate: 'Чужой000',
    companyId: 'co-other',
    spaceId: 'sp-other',
  });
  const fleet = sb.fleetVehiclesForCompany('co-f0-own').map((v) => v.plate);
  assert.deepEqual(fleet, ['А111АА77', 'В222ВВ77']);
  assert.ok(!fleet.includes('Чужой000'));
  record('F0.2', '✅', 'invite pin=9876; fleet co-f0-own: 2 машины, без Чужой000');
}

// —— F0.3 открытие смены ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  vm.runInNewContext('DRIVER = ""; DRIVER_COMPANY_ID = null', sb);
  sb.openShift();
  assert.match(sb.state.error, /войдите по телефону/i);
  setDriverSession(sb, 'Иванов Иван');
  sb.openShift();
  assert.equal(sb.state.step, 'chooseVehicle');
  assert.ok(sb.state.shift?.id);
  const shiftId = sb.state.shift.id;
  sb.openShift();
  assert.equal(sb.state.shift.id, shiftId);
  record('F0.3a', '✅', 'без входа — ошибка; открытие step=chooseVehicle; повтор — тот же shift.id');

  const sb2 = loadF0Sandbox();
  seedF0World(sb2);
  setDriverSession(sb2, 'Иванов Иван');
  const prevId = 'shift-yesterday';
  sb2.state.shifts = [
    {
      id: prevId,
      driverName: 'Иванов Иван',
      vehiclePlate: 'А111АА77',
      startedAt: yesterdayIso(),
      endedAt: null,
      orders: [],
      ownCompanyId: 'co-f0-own',
    },
  ];
  sb2.openShift();
  assert.equal(sb2.state.orderStep, 'closePrevShiftParking');
  assert.equal(sb2.state.draft?.closePrevShiftId, prevId);
  record('F0.3b', '✅', 'вчера открыта → orderStep=closePrevShiftParking, prevShiftId совпал');
}

// —— F0.4 выбор машины ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shifts.push({
    id: 'sh-closed',
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    startedAt: yesterdayIso(),
    endedAt: yesterdayIso(),
    parkingOdometer: 100500,
    ownCompanyId: 'co-f0-own',
  });
  sb.state.shift = {
    id: 'sh-open',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: null,
    orders: [],
    endedAt: null,
  };
  sb.state.step = 'chooseVehicle';
  sb.selectVehicle('А111АА77');
  assert.equal(sb.state.shift.lastOdometerPoint, 100500);
  assert.equal(sb.state.shift.etoOdometerSuggest, 100500);
  assert.equal(sb.state.step, 'odometer');
  record('F0.4', '✅', 'lastOdometerPoint=etoSuggest=100500 (стоянка вчера)');
}

// —— F0.5 одометр ЕТО ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shift = {
    id: 'sh1',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    lastOdometerPoint: 100500,
    etoOdometerSuggest: 100500,
    ownCompanyId: 'co-f0-own',
  };
  sb.state.step = 'odometer';
  sb.__numEl.value = 'abc';
  sb.submitNumber();
  assert.match(sb.state.error, /целое число/i);
  sb.__numEl.value = '100499';
  sb.submitNumber();
  assert.match(sb.state.error, /меньше последнего/i);
  sb.__numEl.value = '100600';
  sb.submitNumber();
  assert.equal(sb.state.shift.odometer, 100600);
  assert.equal(sb.state.step, 'fuel');
  record('F0.5', '✅', 'мин=100500; 100499 ошибка; 100600 → odometer=100600, step=fuel');
}

// —— F0.6 топливо (заправлялся / не заправлялся) ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shift = { id: 'sh1', startedAt: todayIso(), vehiclePlate: 'А111АА77', odometer: 1000 };
  sb.state.step = 'fuel';
  sb.state.etoFuelSub = 'choose';
  sb.__numEl.value = '';
  sb.submitNumber();
  assert.match(sb.state.error, /Заправлялся|Не заправлялся/i);
  sb.answerEtoRefuel(true);
  sb.__numEl.value = '0';
  sb.submitNumber();
  assert.match(sb.state.error, /стоимость литра/i);
  sb.__numEl.value = '55';
  sb.submitNumber();
  sb.__numEl.value = '-1';
  sb.submitNumber();
  assert.match(sb.state.error, /литр/i);
  sb.__numEl.value = '40';
  sb.submitNumber();
  assert.equal(sb.state.shift.fuelLiters, 40);
  assert.equal(sb.state.shift.fuelPricePerLiter, 55);
  assert.equal(sb.state.step, 'gur');

  const sbNo = loadF0Sandbox();
  seedF0World(sbNo);
  sbNo.state.orders = [
    {
      id: 'o-prev',
      vehiclePlate: 'А111АА77',
      fuelPricePerLiter: 62,
      closedAt: yesterdayIso(),
    },
  ];
  sbNo.state.shift = { id: 'sh2', startedAt: todayIso(), vehiclePlate: 'А111АА77', odometer: 1000 };
  sbNo.state.step = 'fuel';
  sbNo.state.etoFuelSub = 'choose';
  sbNo.answerEtoRefuel(false);
  assert.equal(sbNo.state.shift.fuelLiters, 0);
  assert.equal(sbNo.state.shift.fuelPricePerLiter, 62);
  assert.equal(sbNo.state.step, 'gur');
  record('F0.6', '✅', 'кнопки заправки; «Заправлялся» 55₽/л×40л; «Не» → 0л, цена 62 с прошлого заказа');
}

// —— F0.7 жидкости + сброс ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  runEtoThrough(sb, { odo: 101000, fuel: 50 });
  assert.equal(sb.state.shift.gur, undefined);
  sb.selectFluid('Максимум');
  assert.equal(sb.state.shift.gur, 'Максимум');
  sb.selectFluid('Середина');
  assert.equal(sb.state.shift.coolant, 'Середина');
  assert.equal(sb.isEtoDone(sb.state.shift), false);
  await sb.restartEtoInspection();
  assert.equal(sb.state.shift.odometer, null);
  assert.equal(sb.state.step, 'odometer');
  record('F0.7', '✅', 'ГУР/ОЖ сохранены; до масла isEtoDone=false; restart → odometer');
}

// —— F0.8 освещение ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  runEtoThrough(sb);
  sb.selectFluid('Максимум');
  sb.selectFluid('Середина');
  sb.state.step = 'lights';
  sb.state.light = { lowBeam: 'ok' };
  sb.submitLights();
  assert.match(sb.state.error, /Отметьте все/i);
  sb.state.light = { lowBeam: 'ok', brake: 'ok', turn: 'ok' };
  sb.submitLights();
  assert.equal(sb.state.step, 'oil');
  assert.equal(sb.state.shift.light.turn, 'ok');
  record('F0.8', '✅', 'без всех пунктов — ошибка; после 3/3 step=oil');
}

// —— F0.9 незавершённый ЕТО после «перезагрузки» ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  const partial = {
    id: 'sh-partial',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    odometer: 102000,
    fuelLiters: 40,
    orders: [],
    endedAt: null,
    ownCompanyId: 'co-f0-own',
  };
  sb.state.shifts = [partial];
  sb.state.shift = { ...partial };
  sb.state.step = 'done';
  sb.state.messages = [];
  sb.resumeOpenShift(partial);
  assert.equal(sb.state.step, 'gur');
  assert.equal(sb.isEtoDone(sb.state.shift), false);
  record('F0.9', '✅', 'resumeOpenShift → step=gur, isEtoDone=false');
}

// —— F0.10 ЕТО завершён ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shift = {
    id: 'sh-new',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: null,
    orders: [],
    endedAt: null,
  };
  sb.state.step = 'chooseVehicle';
  completeEto(sb, { odo: 100500, fuel: 77 });
  assert.equal(sb.isEtoDone(sb.state.shift), true);
  assert.equal(sb.state.shift.odometer, 100500);
  assert.equal(sb.driverIsEtoDoneToday(sb.state.shift), true);
  record('F0.10', '✅', 'isEtoDone=true, odometer=100500 (пол от 99000)');
}

// —— F0.11 выезд без ЕТО ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shift = {
    id: 'sh-no-eto',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    orders: [],
    endedAt: null,
  };
  sb.state.shifts = [sb.state.shift];
  const msg = sb.canStartAssignedMessage();
  assert.equal(msg, 'Сначала завершите ЕТО');
  record('F0.11', '✅', 'canStartAssignedMessage="Сначала завершите ЕТО"');
}

// —— F0.12 после ЕТО — выезд тем же одометром ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  completeEto(sb, { odo: 100000, fuel: 60 });
  const same = sb.departOdometerSameAsEto(sb.state.shift);
  assert.equal(same, 100000);
  record('F0.12', '✅', 'departOdometerSameAsEto=100000 (= odometer ЕТО)');
}

// —— F0.13 биржа ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.orders = [
    { id: 'ex1', onExchange: true, closedAt: null, startOdometer: null },
    { id: 'ex2', onExchange: true, closedAt: null, startOdometer: 1 },
    { id: 'n1', onExchange: false, closedAt: null, startOdometer: null },
  ];
  assert.equal(sb.driverExchangeEnabled('Иванов Иван'), false);
  assert.equal(sb.driverExchangeEnabled('Петров ИП'), true);
  assert.equal(sb.exchangeOrders().length, 1);
  record('F0.13', '✅', 'штатный exchange=false; ИП true; exchangeOrders=1 (без startOdometer)');
}

// —— F0.14 закрытие на стоянке ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  completeEto(sb, { odo: 100000, fuel: 50 });
  const shiftId = sb.state.shift.id;
  sb.acceptCloseShiftParking(99900);
  assert.match(sb.state.error, /меньше предыдущего/i);
  sb.acceptCloseShiftParking(100150);
  const closed = (sb.state.shifts || []).find((s) => s.id === shiftId);
  assert.equal(closed?.parkingOdometer, 100150);
  assert.ok(closed?.endedAt);
  record('F0.14', '✅', '99900<100000 ошибка; 100150 → parkingOdometer=100150');
}

// —— F0.15 следующий день: подсказка и больше вчера ——
{
  const sb = loadF0Sandbox();
  seedF0World(sb);
  sb.state.shifts = [
    {
      id: 'sh-y',
      driverName: 'Иванов Иван',
      vehiclePlate: 'А111АА77',
      startedAt: yesterdayIso(),
      endedAt: yesterdayIso(),
      parkingOdometer: 200000,
      ownCompanyId: 'co-f0-own',
    },
  ];
  const hint = sb.previousShiftOdometerForPlate('А111АА77', 'co-f0-own', 'Иванов Иван');
  assert.equal(hint, 200000);
  sb.state.shift = {
    id: 'sh-today',
    startedAt: todayIso(),
    driverName: 'Иванов Иван',
    vehiclePlate: 'А111АА77',
    lastOdometerPoint: 200000,
    etoOdometerSuggest: 200000,
    ownCompanyId: 'co-f0-own',
  };
  sb.state.step = 'odometer';
  const min = sb.driverEtoOdometerMin(sb.state.shift);
  assert.equal(min, 200000);
  sb.__numEl.value = '199999';
  sb.submitNumber();
  assert.match(sb.state.error, /меньше/i);
  sb.state.error = '';
  sb.__numEl.value = '200050';
  sb.submitNumber();
  assert.equal(sb.state.shift.odometer, 200050);
  assert.equal(sb.state.error, '');
  record('F0.15', '✅', 'hint=200000; 199999 ошибка; 200050 принят без предупреждения');
}

console.log('f0-eto.test.mjs: all assertions passed');
console.log(JSON.stringify(results, null, 2));
