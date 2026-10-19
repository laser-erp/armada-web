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
  assert.equal(m.exchange, true);
  assert.equal(m.branding, false);
  assert.equal(m.counterparties, false);
  assert.equal(s.resolveMaxVehiclesForSpace(sp), 3);
}

{
  const s = runWithState({ ...baseState });
  const sp = { id: 'sp3', productTariffId: 'owner_max' };
  const m = s.resolveSpaceModules(sp);
  assert.equal(m.branding, true);
}

// owner_basic — без биржи
{
  const s = runWithState({ ...baseState });
  const m = s.resolveSpaceModules({ productTariffId: 'owner_basic' });
  assert.equal(m.exchange, false);
}

// старый каталог в state (без exchange в features) → Средний с биржей
{
  const legacy = {
    version: 1,
    features: [
      { key: 'orders_earnings', roles: ['owner_driver'] },
      { key: 'fuel', roles: ['owner_driver'] },
      { key: 'docs', roles: ['owner_driver'] },
    ],
    tariffs: [
      {
        id: 'owner_basic',
        role: 'owner_driver',
        modules: ['orders_earnings'],
        maxVehicles: 1,
      },
      {
        id: 'owner_medium',
        role: 'owner_driver',
        modules: ['orders_earnings', 'fuel', 'docs'],
        maxVehicles: 3,
      },
    ],
  };
  const st = { ...baseState, platform: { entitlements: legacy } };
  const s = runWithState(st);
  const med = s.resolveSpaceModules({ productTariffId: 'owner_medium' });
  const basic = s.resolveSpaceModules({ productTariffId: 'owner_basic' });
  assert.equal(med.exchange, true);
  assert.equal(basic.exchange, false);
}

{
  const st = {
    ...baseState,
    vehicles: [{ id: 'v1', spaceId: 'sp-o' }],
  };
  const s = runWithState(st);
  const ownerSp = { id: 'sp-o', cabinetKind: 'owner_driver', productTariffId: 'owner_basic' };
  const lim = s.ownerDriverVehicleLimitGuard(ownerSp);
  assert.equal(lim.ok, false);
  assert.match(lim.message, /смените тариф/i);
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

// ownerPaidUntil / pilot fallback
{
  const s = runWithState({ ...baseState });
  const sp = {
    id: 'sp-own',
    cabinetKind: 'owner_driver',
    ownerPilotEndsAt: '2030-01-15T00:00:00.000Z',
  };
  assert.equal(s.ownerPaidUntilIsoFromSpace(sp), '2030-01-15T00:00:00.000Z');
  const st = s.ownerSubscriptionStatusForSpace(sp, Date.parse('2029-12-01T00:00:00.000Z'));
  assert.equal(st.phase, 'active');
  s.extendOwnerPaidUntilOnSpace(sp, 30);
  assert.ok(sp.ownerPaidUntil);
  assert.equal(sp.ownerPaidUntil, sp.ownerPilotEndsAt);
}

console.log('space-entitlements.test.mjs: ok');
