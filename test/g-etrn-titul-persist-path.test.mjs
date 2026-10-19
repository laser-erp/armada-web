/**
 * Путь сохранения T1: ссылка ГО → POST /etrn/shipper-t1, не /customer/orders.
 */
import assert from 'node:assert/strict';
import { loadGEtrnSandbox, makeEtrnOrder, seedGWorld } from './g-etrn-harness.mjs';

const sb = loadGEtrnSandbox();
seedGWorld(sb);
const order = makeEtrnOrder({ id: 'ord-g-persist-t1' });
order.docs = { transportApp: { status: 'signed' } };
sb.state.orders = [order];
sb.ensureEtrnForOrder(order, { silent: true });
const tok = order.etrn.shipperSignToken;

let shipperCalls = 0;
let customerCalls = 0;
sb.persistShipperEtrnT1Immediate = async (oid, token) => {
  shipperCalls++;
  assert.equal(oid, order.id);
  assert.equal(token, tok);
  return { ok: true };
};
sb.persistCustomerPortalOrderImmediate = async () => {
  customerCalls++;
  return { ok: true };
};

sb.location.search = `?etrn-t1=${order.id}&t=${encodeURIComponent(tok)}`;
assert.equal(sb.signEtrnTitul(order.id, 't1', 'ГО G'), true);
assert.equal(order.etrn.tituls.t1, 'signed');
await new Promise((r) => setTimeout(r, 30));
assert.equal(shipperCalls, 1, 'T1 по ссылке ГО должен вызывать persistShipperEtrnT1Immediate');
assert.equal(customerCalls, 0, 'T1 по ссылке ГО не должен идти через customer/orders');

console.log('g-etrn-titul-persist-path.test.mjs: ok');
