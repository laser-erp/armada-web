/**
 * Клиент: цепочка титулов и T1 по ссылке ГО.
 */
import assert from 'node:assert/strict';
import { loadGEtrnSandbox, makeEtrnOrder, seedGWorld, setPortalCustomer, G_SHIPPER } from './g-etrn-harness.mjs';

const sb = loadGEtrnSandbox();
seedGWorld(sb);
const order = makeEtrnOrder();
order.docs = { transportApp: { status: 'signed' } };
sb.state.orders = [order];
sb.ensureEtrnForOrder(order, { silent: true });

assert.equal(sb.signEtrnTitul(order.id, 't2', 'перевозчик'), false);

setPortalCustomer(sb, G_SHIPPER, 'ГО G');
sb.signEtrnTitul(order.id, 't1', 'ГО');
assert.equal(order.etrn.tituls.t1, 'signed');
assert.equal(sb.signEtrnTitul(order.id, 't2', 'перевозчик'), true);

const order2 = makeEtrnOrder({ id: 'ord-g-tok' });
order2.docs = { transportApp: { status: 'signed' } };
order2.shipperSameAsCustomer = false;
sb.state.orders = [order2];
sb.ensureEtrnForOrder(order2, { silent: true });
const tok = order2.etrn.shipperSignToken;

globalThis.location = { search: `?etrn-t1=${order2.id}&t=${encodeURIComponent(tok)}`, origin: 'https://test.local' };
assert.equal(sb.customerCanSignEtrnT1(order2), true);
assert.equal(sb.validateShipperEtrnT1Token(order2, tok), true);

console.log('g-etrn-titul-guard.test.mjs: ok');
