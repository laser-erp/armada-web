/**
 * Портал заказчика: await billing guard перед upsertOrder; заказ в state при QuotaExceeded localStorage.
 * Запуск: node --test web-preview/test/portal-order-billing-guard.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fillMinimalCustomerForm,
  loadPortalOrderSandbox,
  seedPortalCustomerWorld,
} from './portal-order-harness.mjs';

const MARKER = 'PORTAL-UNIT-MARKER-1012';

function orderWithMarker(sb, marker) {
  return (sb.state.orders || []).find((o) => String(o.cargoDescription || '').includes(marker));
}

describe('портал заказчика — billing guard и state.orders', () => {
  it('после await submitCustomerOrderAsync заказ в state, когда guard отвечает с задержкой', async () => {
    let guardCalls = 0;
    const { sb, getEl } = loadPortalOrderSandbox({
      billingGuardWithServer: () =>
        new Promise((resolve) => {
          guardCalls++;
          setTimeout(() => resolve({ ok: true }), 40);
        }),
    });
    seedPortalCustomerWorld(sb);
    fillMinimalCustomerForm(getEl, MARKER);

    const before = sb.state.orders.length;
    await sb.submitCustomerOrderAsync();
    const hit = orderWithMarker(sb, MARKER);
    assert.ok(hit, 'заказ с маркером должен быть в state.orders сразу после await submitCustomerOrderAsync');
    assert.equal(guardCalls, 1, 'billing guard вызван один раз');
    assert.ok(sb.state.orders.length > before, 'число заказов выросло');
  });

  it('при QuotaExceeded localStorage заказ остаётся в state.orders', async () => {
    const { sb, getEl } = loadPortalOrderSandbox({
      billingGuardWithServer: async () => ({ ok: true }),
    });
    seedPortalCustomerWorld(sb);
    fillMinimalCustomerForm(getEl, `${MARKER}-QUOTA`);

    const ls = sb.localStorage;
    const origSet = ls.setItem.bind(ls);
    ls.setItem = function quotaSet(k, v) {
      const s = String(v);
      if (k && s.length > 200) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return origSet(k, v);
    };

    await sb.submitCustomerOrderAsync();
    const hit = orderWithMarker(sb, `${MARKER}-QUOTA`);
    assert.ok(hit, 'заказ в памяти даже если persistLocalOnly не записал localStorage');
    assert.equal(hit.source, 'customer_portal');
  });

  it('readonly billing — сообщение в cust-form-error, заказ не создаётся', async () => {
    const { sb, getEl } = loadPortalOrderSandbox();
    const { sp } = seedPortalCustomerWorld(sb);
    sb.state.billing.spaces[sp] = {
      planId: 'start',
      status: 'suspended',
      trialEndsAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    };
    fillMinimalCustomerForm(getEl, `${MARKER}-BLOCK`);
    await sb.submitCustomerOrderAsync();
    assert.ok(!orderWithMarker(sb, `${MARKER}-BLOCK`), 'заказ не создан при readonly');
    const err = (getEl('cust-form-error').textContent || '').trim();
    assert.ok(err.length > 0, 'показана ошибка биллинга, не пустой cust-form-error');
  });

  it('отказ guard перевозчика — заказчику нейтральный текст без SaaS-подписки', async () => {
    const saasMsg =
      'Период оплаты истёк — режим только просмотра. Оплатите подписку или продлите пилот.';
    const { sb, getEl } = loadPortalOrderSandbox({
      billingGuardWithServer: async () => ({ ok: false, message: saasMsg }),
    });
    seedPortalCustomerWorld(sb);
    fillMinimalCustomerForm(getEl, `${MARKER}-NEUTRAL`);
    await sb.submitCustomerOrderAsync();
    assert.ok(!orderWithMarker(sb, `${MARKER}-NEUTRAL`), 'заказ не создан');
    const err = (getEl('cust-form-error').textContent || '').trim();
    assert.equal(err, 'Перевозчик временно не принимает заявки');
    assert.doesNotMatch(err, /подписк/i);
    assert.doesNotMatch(err, /оплат/i);
  });
});
