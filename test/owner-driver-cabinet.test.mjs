import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadOwnerDriverActiveCheck() {
  const sm = readFileSync(path.join(root, 'space-modules.js'), 'utf8');
  const od = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
  const activeFn = od.match(/function isOwnerDriverCabinetActive\(\)\{[\s\S]*?\n\}/);
  assert.ok(activeFn, 'isOwnerDriverCabinetActive');
  assert.doesNotMatch(activeFn[0], /isOwnerDriverPreviewEnabled/, 'active must not depend on preview flag');
  return { sm, od };
}

loadOwnerDriverActiveCheck();

function runSpaceModules(state, driver, companyId, jwtExtra = {}) {
  const sandbox = {
    state,
    DRIVER: driver,
    DRIVER_COMPANY_ID: companyId,
    findCompanyById: (id) => (state.companies || []).find((c) => c.id === id),
    findDriverRecord: (name, cid) =>
      (state.drivers || []).find(
        (d) =>
          String(d.name || '').trim() === String(name || '').trim() &&
          (!cid || d.companyId === cid)
      ),
    samePersonName: (a, b) => String(a || '').trim() === String(b || '').trim(),
    companyHasRole: (c, role) => (c.roles || []).includes(role),
    armadaApiTokenRole: () => jwtExtra.role || '',
    armadaApiRoleToken: () => jwtExtra.token || '',
    decodeArmadaJwtPayload: (t) => (t === jwtExtra.token ? jwtExtra.payload || null : null),
    ...jwtExtra.sandbox,
  };
  vm.runInNewContext(readFileSync(path.join(root, 'space-modules.js'), 'utf8'), sandbox);
  return sandbox;
}

{
  const state = {
    admins: [{ id: 'a1', name: 'Иван', spaceId: 'sp1' }],
    companies: [{ id: 'co1', name: 'ИП Иван', spaceId: 'sp1', roles: ['own'] }],
    drivers: [
      {
        id: 'd1',
        name: 'Иван',
        companyId: 'co1',
        ownerAdminId: 'a1',
        spaceId: 'sp1',
      },
      { id: 'd2', name: 'Пётр', companyId: 'co1', spaceId: 'sp1' },
    ],
  };
  const mirrorOnly = runSpaceModules(state, 'Иван', 'co1');
  assert.equal(mirrorOnly.isOwnerDriverCabinetMode(), false, 'зеркало без JWT /o/ не открывает кабинет');
  const owner = runSpaceModules(state, 'Иван', 'co1', {
    role: 'owner_driver',
    token: 'jwt-mirror',
    payload: {
      role: 'owner_driver',
      driverName: 'Иван',
      companyId: 'co1',
      spaceId: 'sp1',
      driverId: 'd1',
    },
  });
  assert.equal(owner.isOwnerDriverCabinetMode(), true);
  const hired = runSpaceModules(state, 'Пётр', 'co1');
  assert.equal(hired.isOwnerDriverCabinetMode(), false);
}

{
  const state = { drivers: [], companies: [], admins: [] };
  const jwt = {
    role: 'owner_driver',
    token: 'jwt-test',
    payload: {
      role: 'owner_driver',
      accountKind: 'owner_driver',
      driverId: 'od-new',
      driverName: 'ТЕСТ QA Собственник',
      spaceId: 'sp-new',
      companyId: 'co-new',
    },
  };
  const od = runSpaceModules(state, 'ТЕСТ QA Собственник', 'co-new', jwt);
  assert.equal(od.isOwnerDriverCabinetMode(), true);
  assert.equal(od.ownerDriverTrustedSpaceId(), 'sp-new');
}

console.log('owner-driver-cabinet.test.mjs: ok');
