/**
 * QA G (run3): несогласованность «бумажная ТН» + объект etrn в заказе.
 * Ожидание по etrn.js ~178–179: issue «Режим бумажной ТН, но в заказе есть ЭТрН».
 * Запуск: node web-preview/test/g-etrn-paper-etrn-issues.test.mjs
 */
import assert from 'node:assert/strict';
import { loadGEtrnSandbox, seedGWorld, G_SPACE, G_CARRIER } from './g-etrn-harness.mjs';

const sb = loadGEtrnSandbox();
seedGWorld(sb);

const order = {
  id: 'ord-paper-etrn',
  spaceId: G_SPACE,
  ownCompanyId: G_CARRIER,
  carrierCompanyId: G_CARRIER,
  sequentialNumber: 99001,
  shipperSameAsCustomer: true,
  driverName: 'Водитель',
  vehiclePlate: 'А111АА77',
  closedAt: new Date().toISOString(),
  etrn: {
    sandbox: true,
    tituls: { t1: 'pending', t2: 'pending', t3: 'pending', t4: 'pending' },
  },
};

sb.state.orders = [order];
sb.state.billing.spaces[G_SPACE].etrnEnabled = true;

const issues = sb.orderLifecycleStatusIssues(order);
const paperMsg = issues.find((m) => m.includes('бумажной ТН') && m.includes('ЭТрН'));
assert.equal(sb.orderTransportDocUsesEtrn(order), false);
assert.ok(order.etrn);

assert.ok(
  paperMsg,
  `ожидали предупреждение о бумажной ТН при наличии etrn; факт issues=${JSON.stringify(issues)}`,
);

console.log('g-etrn-paper-etrn-issues.test.mjs: ok', paperMsg);
