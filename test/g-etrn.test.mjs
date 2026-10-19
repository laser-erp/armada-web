/**
 * QA G: ЭТрН T1–T4 (docs/СПИСОК_СЦЕНАРИЕВ_ТЕСТОВОГО_МИРА.md §G).
 * Запуск: node web-preview/test/g-etrn.test.mjs
 */
import './g-etrn-epd-env-isolate.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G_CUSTOMER,
  G_SHIPPER,
  loadGEtrnSandbox,
  makeEtrnOrder,
  runSandboxEtrnChain,
  seedGWorld,
  setDriverSession,
  setPortalCustomer,
} from './g-etrn-harness.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const epdSignSrc = readFileSync(path.join(__dir, '..', 'epd-sign.js'), 'utf8');

const results = [];

function record(id, status, fact) {
  results.push({ id, status, fact });
}

// —— G1 цепочка T1→T2→QR→T3→T4 ——
{
  const sb = loadGEtrnSandbox();
  seedGWorld(sb);
  const order = makeEtrnOrder();
  const { qrOk } = runSandboxEtrnChain(sb, order);
  assert.equal(qrOk, true);
  const issues = sb.orderLifecycleStatusIssues(order);
  assert.equal(issues.length, 0, issues.join('; ') || 'ok');
  assert.equal(sb.orderLifecycleStepKey(order), 'closed');
  ['t1', 't2', 't3', 't4'].forEach((k) => assert.equal(order.etrn.tituls[k], 'signed'));
  record('G1', '✅', `sandbox цепочка; QR после T2=${qrOk}; orderLifecycleStatusIssues=[]`);
}

// —— G2 T1 не блокирует выезд со стоянки ——
{
  const sb = loadGEtrnSandbox();
  seedGWorld(sb);
  const order = makeEtrnOrder();
  sb.ensureEtrnForOrder(order, { silent: true });
  assert.equal(order.etrn.tituls.t1, 'pending');
  const depart = sb.orderEtrnReadyForDepart(order);
  assert.equal(depart.ok, true);
  record('G2', '✅', 'orderEtrnReadyForDepart.ok при T1=pending');
}

// —— G3 T1+T2 блокируют выезд с погрузки ——
{
  const sb = loadGEtrnSandbox();
  seedGWorld(sb);
  setDriverSession(sb);
  const order = makeEtrnOrder({ startOdometer: 1010, arrivedAt: new Date().toISOString() });
  sb.state.orders = [order];
  sb.ensureEtrnForOrder(order, { silent: true });
  const gate = sb.orderEtrnReadyForLeaveLoading(order);
  assert.equal(gate.ok, false);
  assert.match(gate.message, /T1/i);
  sb.startLeaveLoading(order.id);
  assert.match(sb.state.error, /T1|ЭТрН/i);
  setPortalCustomer(sb, G_SHIPPER, 'ГО G');
  sb.signEtrnTitul(order.id, 't1', 'ГО');
  sb.state.error = '';
  const gate2 = sb.orderEtrnReadyForLeaveLoading(order);
  assert.equal(gate2.ok, false);
  assert.match(gate2.message, /T2/i);
  sb.startLeaveLoading(order.id);
  assert.match(sb.state.error, /T2/i);
  sb.signEtrnTitul(order.id, 't2', 'перевозчик');
  sb.state.error = '';
  sb.startLeaveLoading(order.id);
  assert.equal(sb.state.error, '');
  assert.ok(order.loadedDepartAt);
  record('G3', '✅', 'без T1/T2 startLeaveLoading блокирует; после T1+T2 выезд ok');
}

// —— G4 ГО≠заказчик, T1 по ссылке ——
{
  const sb = loadGEtrnSandbox();
  seedGWorld(sb);
  const order = makeEtrnOrder();
  sb.state.orders = [order];
  sb.ensureEtrnForOrder(order, { silent: true });
  setPortalCustomer(sb, G_CUSTOMER, 'Заказчик G');
  assert.equal(sb.customerCanSignEtrnT1(order), false);
  const htmlCust = sb.customerEtrnT1SignHtml(order);
  assert.ok(htmlCust.includes('Скопировать ссылку'));
  assert.ok(!htmlCust.includes('class="primary cust-etrn-t1-sign"'));
  setPortalCustomer(sb, G_SHIPPER, 'ГО G');
  assert.equal(sb.customerCanSignEtrnT1(order), true);
  const url = sb.shipperEtrnT1SignUrl(order);
  assert.match(url, /etrn-t1=ord-g-1/);
  assert.ok(sb.validateShipperEtrnT1Token(order, order.etrn.shipperSignToken));
  assert.equal(sb.validateShipperEtrnT1Token(order, 'wrong'), false);
  record('G4', '✅', 'заказчик не подписывает T1; ГО может; ссылка /z/?etrn-t1=…');
}

// —— G5 Контур / КЭП — логика песочницы в коде; EPD_* в окружении CI не должен ломать unit ——
{
  const savedEpdEnv = {
    apiKey: process.env.EPD_API_KEY,
    sandbox: process.env.EPD_SANDBOX,
  };
  delete process.env.EPD_API_KEY;
  delete process.env.EPD_SANDBOX;
  try {
    const sb = loadGEtrnSandbox();
    seedGWorld(sb);
    const order = makeEtrnOrder();
    sb.ensureEtrnForOrder(order, { silent: true });
    assert.equal(order.etrn.sandbox, true);
    assert.ok(epdSignSrc.includes('sandbox://'));
    assert.ok(epdSignSrc.includes('openEpdTitulSignSandboxPanel'));
    const EPD_SANDBOX = process.env.EPD_SANDBOX === 'true' || !process.env.EPD_API_KEY;
    assert.equal(EPD_SANDBOX, true);
    record(
      'G5',
      '✅',
      'sandbox-черновик; epd-sign.js stub; unit не зависит от EPD_API_KEY в окружении',
    );
  } finally {
    if (savedEpdEnv.apiKey === undefined) delete process.env.EPD_API_KEY;
    else process.env.EPD_API_KEY = savedEpdEnv.apiKey;
    if (savedEpdEnv.sandbox === undefined) delete process.env.EPD_SANDBOX;
    else process.env.EPD_SANDBOX = savedEpdEnv.sandbox;
  }
}

// —— G6 webhook (клиент applyEpdWebhook) ——
{
  const sb = loadGEtrnSandbox();
  seedGWorld(sb);
  const order = makeEtrnOrder();
  sb.state.orders = [order];
  sb.sandboxCreateEtrnLocal(order);
  const extId = order.etrn.externalId;
  const r = sb.applyEpdWebhook({ externalId: extId, titul: 't1', titulStatus: 'signed' });
  assert.equal(r.ok, true);
  assert.equal(order.etrn.tituls.t1, 'signed');
  assert.ok(order.etrn.lastWebhookAt);
  record('G6', '✅', 'applyEpdWebhook externalId→t1 signed (etrn.js)');
}

console.log('g-etrn.test.mjs: all assertions passed');
console.log(JSON.stringify(results, null, 2));
