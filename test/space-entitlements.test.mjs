import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(path.join(root, 'space-modules.js'), 'utf8');

function runWithState(state) {
  const sandbox = {
    state,
    DRIVER: null,
    DRIVER_COMPANY_ID: null,
    findCompanyById: (id) => (state.companies || []).find((c) => c.id === id),
    findDriverRecord: () => null,
    samePersonName: (a, b) => String(a || '').trim() === String(b || '').trim(),
    companyHasRole: (c, role) => (c.roles || []).includes(role),
  };
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

const baseState = { platform: null, companies: [] };

// default: all modules on
{
  const s = runWithState({ ...baseState });
  const m = s.resolveSpaceModules({ id: 'sp1' });
  assert.equal(m.orders_earnings, true);
  assert.equal(m.fuel, true);
}

// owner_basic
{
  const s = runWithState({ ...baseState });
  const sp = { id: 'sp1', productTariffId: 'owner_basic' };
  const m = s.resolveSpaceModules(sp);
  assert.equal(m.orders_earnings, true);
  assert.equal(m.fuel, false);
  assert.equal(m.docs, false);
  const ent = s.resolveEntitlements('owner_driver', sp);
  assert.equal(ent.maxVehicles, 1);
}

// owner_medium
{
  const s = runWithState({ ...baseState });
  const sp = { id: 'sp2', productTariffId: 'owner_medium' };
  const m = s.resolveSpaceModules(sp);
  assert.equal(m.fuel, true);
  assert.equal(m.counterparties, false);
  assert.equal(s.resolveMaxVehiclesForSpace(sp), 3);
}

// owner_max
{
  const s = runWithState({ ...baseState });
  const sp = { id: 'sp3', productTariffId: 'owner_max' };
  const m = s.resolveSpaceModules(sp);
  assert.equal(m.maintenance, true);
  assert.equal(s.resolveEntitlements('owner_driver', sp).maxVehicles, 10);
}

// legacy id medium → owner_medium
{
  const s = runWithState({ ...baseState });
  const m = s.resolveSpaceModules({ productTariffId: 'medium' });
  assert.equal(m.docs, true);
  assert.equal(m.counterparties, false);
}

// moduleOverrides on space
{
  const s = runWithState({ ...baseState });
  const sp = {
    productTariffId: 'owner_max',
    moduleOverrides: { fuel: false },
  };
  const m = s.resolveSpaceModules(sp);
  assert.equal(m.fuel, false);
  assert.equal(m.docs, true);
}

console.log('space-entitlements.test.mjs: ok');
