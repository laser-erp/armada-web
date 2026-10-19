/**
 * /v/: вход наёмного водителя при пустом локальном state (после изоляции #178).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadF0Sandbox } from './f0-eto-harness.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function fakeJwt(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `h.${payload}.s`;
}

test('tryDriverPhoneLogin: пустой state + API → шаг PIN без sync', async () => {
  const sb = loadF0Sandbox({
    fetch: async () => jsonResponse(404, {}),
  });
  sb.state.drivers = [];
  sb.API_BASE = 'http://localhost/armada-api';
  sb.formatPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^8/, '7');
  sb.findDriversByPhone = (phone) =>
    (sb.state.drivers || []).filter((d) => sb.formatPhone(d.phone) === sb.formatPhone(phone));
  sb.syncDriversCatalogForLogin = async () => {
    sb.__syncCalled = true;
    return false;
  };
  sb.$('drv-login-phone').value = '+79001234567';
  const pinEl = sb.$('drv-login-pin');
  pinEl.focus = () => {};
  const errEl = sb.$('drv-login-error');
  const showErr = (m) => {
    errEl.textContent = m || '';
  };
  await sb.tryDriverPhoneLogin('79001234567', showErr);
  assert.equal(sb.__syncCalled, undefined, 'sync не вызывается при API_BASE');
  assert.equal(vm.runInNewContext('driverLoginStep', sb), 'pin');
  assert.equal(vm.runInNewContext('driverLoginSelected', sb), null);
});

test('doLoginDriverPin: verify-driver 200 → enterAsDriver при пустом state', async () => {
  const driverTok = fakeJwt('driver');
  const hired = {
    id: 'drv-hired',
    name: 'Наёмный Водитель',
    phone: '79001234567',
    companyId: 'co-x',
    spaceId: 'sp-x',
  };
  let entered = null;
  const sb = loadF0Sandbox({
    fetch: async (url) => {
      const u = String(url);
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(200, { token: driverTok, driver: hired });
      }
      if (u.includes('/state')) {
        return jsonResponse(200, {
          id: 'rec1',
          payload: { dataEpoch: 1, drivers: [hired], spaces: [], companies: [] },
        });
      }
      return jsonResponse(404, {});
    },
  });
  sb.state.drivers = [];
  sb.API_BASE = 'http://localhost/armada-api';
  sb.formatPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^8/, '7');
  sb.findDriversByPhone = () => [];
  sb.enterAsDriver = (rec) => {
    entered = rec;
    sb.DRIVER = rec.name;
  };
  sb.fetchServerState = async () => null;
  sb.driverLoginPhoneEl = () => ({ value: '+79001234567' });
  sb.$('drv-login-pin').value = '4567';
  sb.driverLoginStep = 'pin';
  sb.driverLoginSelected = null;
  await sb.doLoginDriverPin((msg) => {
    if (msg) throw new Error(msg);
  });
  assert.ok(entered);
  assert.equal(entered.id, 'drv-hired');
  assert.equal(sb.armadaApiRoleToken(), driverTok);
});

test('doLoginDriverPin: собственник на /v/ → редирект /o/ по verify-owner-driver', async () => {
  const ownerTok = fakeJwt('owner_driver');
  const ownerDrv = {
    id: 'drv-owner',
    name: 'Собственник QA',
    phone: '79009998877',
    accountKind: 'owner_driver',
  };
  const sb = loadF0Sandbox({
    fetch: async (url) => {
      const u = String(url);
      if (u.includes('/auth/verify-driver')) {
        return jsonResponse(401, { error: 'wrong_pin' });
      }
      if (u.includes('/auth/verify-owner-driver')) {
        return jsonResponse(200, { token: ownerTok, driver: ownerDrv, role: 'owner_driver' });
      }
      return jsonResponse(404, {});
    },
  });
  sb.state.drivers = [];
  sb.API_BASE = 'http://localhost/armada-api';
  sb.formatPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^8/, '7');
  sb.findDriversByPhone = () => [];
  sb.esc = (s) => String(s ?? '');
  sb.driverLoginPhoneEl = () => ({ value: '+79009998877' });
  sb.$('drv-login-pin').value = '1234';
  sb.driverLoginStep = 'pin';
  let redirectMsg = '';
  const errEl = sb.$('drv-login-error');
  await sb.doLoginDriverPin((msg) => {
    redirectMsg = msg || '';
  });
  assert.match(redirectMsg, /\/o\//);
  assert.match(String(errEl.innerHTML || errEl.textContent), /\/o\//);
  assert.equal(sb.enterAsDriver && sb.DRIVER, undefined);
});
