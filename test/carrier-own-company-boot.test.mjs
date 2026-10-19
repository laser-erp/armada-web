/**
 * / (хаб): customer.js грузится до app.js; ранний wireCustomerPortal не должен бросать ReferenceError.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  customerRouteScriptBundle,
  loadCustomerBootScripts,
} from './customer-boot-harness.mjs';

test('boot /: customer.js идёт до app.js', () => {
  const b = customerRouteScriptBundle();
  const custIdx = b.indexOf('customer.js');
  const appIdx = b.indexOf('app.js');
  assert.ok(custIdx >= 0 && appIdx > custIdx, 'customer.js before app.js on / hub bundle');
});

test('customer.js без app.js: carrierOwnCompanyForSpace — null, не ReferenceError', () => {
  const { sandbox } = loadCustomerBootScripts('customer.js');
  assert.equal(typeof sandbox.customerCarrierForForm, 'function');
  assert.equal(typeof sandbox.carrierOwnCompanyForSpace, 'undefined');
  sandbox.currentCustomer = { companyId: 'co1', spaceId: 'sp1' };
  vm.runInContext(
    `state.companies = [{ id: 'co1', spaceId: 'sp1', name: 'Заказчик' }];`,
    sandbox,
  );
  let err = null;
  let carrier = 'unset';
  try {
    carrier = sandbox.customerCarrierForForm();
  } catch (e) {
    err = e;
  }
  assert.equal(err, null, err ? String(err.message) : '');
  assert.equal(carrier, null);
});

test('wireCustomerPricingModeUi после customer.js без app.js — без ReferenceError', () => {
  const { sandbox } = loadCustomerBootScripts('customer.js');
  assert.equal(typeof sandbox.wireCustomerPricingModeUi, 'function');
  let err = null;
  try {
    sandbox.wireCustomerPricingModeUi();
  } catch (e) {
    err = e;
  }
  assert.equal(err, null, err ? String(err.message) : '');
  assert.ok(!String(err?.message || '').includes('carrierOwnCompanyForSpace'));
});
