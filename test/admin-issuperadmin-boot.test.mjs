/**
 * /a/: auth.js и admin.js грузятся до app.js; loginAdmin → updateAdminChrome требует isSuperAdmin.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  adminRouteScriptBundle,
  loadAdminBootScripts,
} from './admin-boot-harness.mjs';

function setCurrentAdmin(sandbox, row) {
  vm.runInContext(`currentAdmin = ${JSON.stringify(row)}`, sandbox);
}

test('boot /a/: auth.js и admin.js идут до app.js', () => {
  const b = adminRouteScriptBundle();
  const authIdx = b.indexOf('auth.js');
  const adminIdx = b.indexOf('admin.js');
  const appIdx = b.indexOf('app.js');
  assert.ok(authIdx >= 0 && adminIdx > authIdx, 'auth before admin');
  assert.ok(appIdx > adminIdx, 'admin.js before app.js — isSuperAdmin только в app.js');
});

test('isSuperAdmin в auth.js (до admin.js в бандле /a/)', () => {
  const { sandbox } = loadAdminBootScripts('auth.js');
  assert.equal(typeof sandbox.isSuperAdmin, 'function', 'перенести isSuperAdmin в auth.js');
});

test('updateAdminChrome после admin.js без app.js — как ранний loginAdmin в браузере', () => {
  const { sandbox } = loadAdminBootScripts('admin.js');
  assert.equal(typeof sandbox.loginAdmin, 'function');
  assert.equal(typeof sandbox.updateAdminChrome, 'function');
  setCurrentAdmin(sandbox, { id: 'adm1', name: 'Логист', isSuper: false, spaceId: 'sp1' });
  if (typeof sandbox.isSuperAdmin !== 'function') {
    let err = null;
    try {
      sandbox.updateAdminChrome();
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'ожидали ReferenceError до app.js');
    assert.match(String(err.message), /isSuperAdmin is not defined/);
    return;
  }
  sandbox.updateAdminChrome();
  assert.equal(sandbox.isSuperAdmin(), false);
  setCurrentAdmin(sandbox, { id: 'adm1', name: 'Логист', isSuper: true, spaceId: 'sp1' });
  assert.equal(sandbox.isSuperAdmin(), true);
});
