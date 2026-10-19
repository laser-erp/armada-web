/**
 * Страница ГО /z/?etrn-t1=…&t=… без входа: кнопка ГО и persist, не signEtrnTitulSandboxAuto вне sandbox.
 */
import assert from 'node:assert/strict';
import { loadGEtrnSandbox, makeEtrnOrder, seedGWorld } from './g-etrn-harness.mjs';

function stagingLikeEtrnOrder(extra = {}) {
  const order = makeEtrnOrder({
    id: 'ord-staging-api-etrn',
    driverName: 'Водитель staging',
    vehiclePlate: 'В123ВВ77',
    ...extra,
  });
  order.etrn = {
    operatorId: 'stub',
    externalId: 'ext-staging-g-1012c',
    status: 'draft',
    sandbox: false,
    shipperSignToken: 'shipper-token-staging-01',
    tituls: { t1: 'pending', t2: 'pending', t3: 'pending', t4: 'pending' },
  };
  return order;
}

function wireShipperUrl(sb, order) {
  const tok = order.etrn.shipperSignToken;
  sb.location.search = `?etrn-t1=${encodeURIComponent(order.id)}&t=${encodeURIComponent(tok)}`;
  sb.location.pathname = '/z/';
  sb.location.href = `http://localhost/z/${sb.location.search}`;
}

/** Как ensureOrderLoadedForShipperEtrnT1: заказ с сервера, не из кабинета логиста. */
function loadOrderFromPublicPb(sb, order) {
  sb.state.orders = [];
  sb.fetchServerStateFromPb = async () => ({
    payload: { orders: [structuredClone(order)], dataEpoch: 1 },
  });
  return sb.ensureOrderLoadedForShipperEtrnT1(order.id);
}

const sb = loadGEtrnSandbox();
seedGWorld(sb);
const order = stagingLikeEtrnOrder();
wireShipperUrl(sb, order);

let shipperPosts = 0;
sb.persistShipperEtrnT1Immediate = async (oid, token) => {
  shipperPosts++;
  assert.equal(oid, order.id);
  assert.equal(token, order.etrn.shipperSignToken);
  return { ok: true };
};
sb.API_BASE = 'http://api.test';

const loaded = await loadOrderFromPublicPb(sb, order);
assert.equal(loaded, true, 'заказ должен подтянуться для ссылки ГО');
assert.equal(sb.currentCustomer, undefined, 'без входа заказчика');

assert.equal(
  sb.signEtrnTitulSandboxAuto(order.id, 't1', 'shipper'),
  false,
  'signEtrnTitulSandboxAuto не подменяет кнопку ГО при etrn.sandbox=false',
);

shipperPosts = 0;
order.etrn.tituls.t1 = 'pending';
sb.state.orders = [order];
wireShipperUrl(sb, order);

const viaDirect = sb.customerSignEtrnT1Direct(order.id);
assert.equal(viaDirect, true, 'customerSignEtrnT1Direct по валидной ссылке ГО');
assert.equal(order.etrn.tituls.t1, 'signed', 'signEtrnTitul внутри customerSignEtrnT1Direct');
await new Promise((r) => setTimeout(r, 30));
assert.equal(shipperPosts, 1, 'etrnTitulPersistAfterSign → persistShipperEtrnT1Immediate');

shipperPosts = 0;
order.etrn.tituls.t1 = 'pending';
sb.state.orders = [];
await loadOrderFromPublicPb(sb, order);
wireShipperUrl(sb, order);
// store.js $ → getElementById: элементы оверлея должны быть в els до renderShipperEtrnT1Overlay
sb.$('cust-shipper-etrn-overlay');
sb.$('cust-shipper-etrn-body');
sb.$('cust-shipper-etrn-sign');

const overlayOk = await sb.tryInitShipperEtrnT1FromUrl();
assert.equal(overlayOk, true, 'tryInitShipperEtrnT1FromUrl открывает оверлей ГО');
const signBtn = sb.document.getElementById('cust-shipper-etrn-sign');
assert.equal(typeof signBtn.onclick, 'function', 'кнопка #cust-shipper-etrn-sign');
signBtn.onclick();
const fromPb = sb.state.orders.find((x) => x.id === order.id);
assert.equal(fromPb.etrn.tituls.t1, 'signed', 'клик ГО → customerSignEtrnT1Direct → signEtrnTitul');
await new Promise((r) => setTimeout(r, 30));
assert.equal(shipperPosts, 1, 'повторный T1 с оверлея тоже persistShipperEtrnT1Immediate');

console.log('g-etrn-shipper-t1-go-page.test.mjs: ok');
