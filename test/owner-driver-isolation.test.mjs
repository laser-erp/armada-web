/**
 * Изоляция кабинета собственника (клиент): space, зеркало, контрагенты.
 * Синтетические данные, без staging/production.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function findDriverRecordLikeApp(state, name, companyId) {
  const list = state.drivers || [];
  const nm = String(name || '').trim();
  if (!nm) return null;
  if (companyId) {
    const hit = list.find(
      (d) =>
        String(d.name || '').trim().toLowerCase() === nm.toLowerCase() && d.companyId === companyId
    );
    if (hit) return hit;
  }
  return list.find((d) => String(d.name || '').trim().toLowerCase() === nm.toLowerCase()) || null;
}

function loadOwnerDriverSandbox(state, driver, companyId, jwtExtra = {}) {
  const smCode = readFileSync(path.join(root, 'space-modules.js'), 'utf8');
  let odCode = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
  odCode = odCode.replace(/\ninitOwnerDriverShell\(\);\s*$/, '\n');
  const sandbox = {
    URLSearchParams,
    state,
    DRIVER: driver,
    DRIVER_COMPANY_ID: companyId,
    sessionStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.get(k) ?? null;
      },
      setItem(k, v) {
        this._m.set(k, String(v));
      },
      removeItem(k) {
        this._m.delete(k);
      },
    },
    localStorage: {
      _m: new Map(),
      getItem(k) {
        return this._m.get(k) ?? null;
      },
      setItem(k, v) {
        this._m.set(k, String(v));
      },
      removeItem(k) {
        this._m.delete(k);
      },
    },
    location: { search: '', pathname: '/v/' },
    document: {
      querySelector: () => null,
      getElementById: (id) => sandbox.__els?.[id] || null,
      createElement: () => ({ appendChild() {}, insertBefore() {}, innerHTML: '' }),
    },
    __els: {},
    $: (id) => sandbox.document.getElementById(id),
    findCompanyById: (id) => (state.companies || []).find((c) => c.id === id),
    findSpaceById: (id) => (state.spaces || []).find((s) => s.id === id),
    findDriverRecord: (name, cid) => findDriverRecordLikeApp(state, name, cid),
    samePersonName: (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(),
    companyHasRole: (c, role) => (c.roles || []).includes(role),
    ownCompanyForSpaceId: (sid) =>
      (state.companies || []).find((c) => c.spaceId === sid && (c.roles || []).includes('own')),
    spaceModuleEnabled: () => true,
    fleetVehiclesForCompany: (cid) => (state.vehicles || []).filter((v) => v.companyId === cid),
    allOrders: () => state.orders || [],
    orderBelongsToDriver: (o) => o && o.driverName === driver,
    looksClosedOrder: (o) => !!(o && o.closedAt),
    esc: (s) => String(s ?? ''),
    fmt: (n) => String(n),
    persistLocalOnly: () => {
      sandbox.__persistLocalOnlyCalls = (sandbox.__persistLocalOnlyCalls || 0) + 1;
    },
    armadaApiTokenRole: () => jwtExtra.role || '',
    armadaApiRoleToken: () => jwtExtra.token || '',
    decodeArmadaJwtPayload: (t) => (t === jwtExtra.token ? jwtExtra.payload || null : null),
    mirrorDriverSessionToGlobal: () => {},
  };
  vm.runInNewContext(smCode, sandbox);
  vm.runInNewContext(odCode, sandbox);
  return sandbox;
}

const spaceMine = 'sp-mine';
const spaceOther = 'sp-other';

const baseState = {
  spaces: [
    { id: spaceMine, name: 'Мой space' },
    { id: spaceOther, name: 'Чужой space' },
  ],
  companies: [
    { id: 'co-own', name: 'Моя фирма', spaceId: spaceMine, roles: ['own'] },
    { id: 'co-foreign-own', name: 'Чужая own', spaceId: spaceOther, roles: ['own'] },
    { id: 'co-cust-mine', name: 'Свой заказчик', spaceId: spaceMine, roles: ['customer'] },
    { id: 'co-cust-foreign', name: 'Чужой заказчик', spaceId: spaceOther, roles: ['customer'] },
  ],
  admins: [{ id: 'adm-mirror', name: 'Иван Зеркало', spaceId: spaceMine, phone: '79001112233' }],
  drivers: [
    {
      id: 'drv-mirror',
      name: 'Иван Зеркало',
      companyId: 'co-own',
      spaceId: spaceMine,
      ownerAdminId: 'adm-mirror',
      phone: '79001112233',
    },
    {
      id: 'drv-hired',
      name: 'Пётр Наёмник',
      companyId: 'co-own',
      spaceId: spaceMine,
      ownerAdminId: 'adm-mirror',
      phone: '79002223344',
    },
  ],
  orders: [],
  vehicles: [],
};

// JWT /o/ — кабинет собственника (зеркало в данных без JWT — нет)
{
  const jwt = {
    role: 'owner_driver',
    token: 'jwt-iso',
    payload: {
      role: 'owner_driver',
      driverName: 'Иван Зеркало',
      companyId: 'co-own',
      spaceId: spaceMine,
      driverId: 'drv-mirror',
    },
  };
  const s = loadOwnerDriverSandbox(baseState, 'Иван Зеркало', 'co-own', jwt);
  assert.equal(s.isOwnerDriverCabinetMode(), true);
  assert.equal(s.isOwnerDriverCabinetActive(), true);
  assert.equal(s.ownerDriverSpaceId(), spaceMine);
  assert.equal(s.ownerDriverTrustedCompanyId(), 'co-own');
  const cps = s.ownerDriverCounterparties();
  assert.ok(cps.some((c) => c.id === 'co-cust-mine'));
  assert.ok(!cps.some((c) => c.id === 'co-cust-foreign'));
}

// Наёмник — не зеркало, space кабинета null
{
  const s = loadOwnerDriverSandbox(baseState, 'Пётр Наёмник', 'co-own');
  assert.equal(s.isOwnerDriverCabinetMode(), false);
  assert.equal(s.isOwnerDriverCabinetActive(), false);
  assert.equal(s.ownerDriverSpaceId(), null);
}

// preview-параметр не включает кабинет без зеркала
{
  const st = structuredClone(baseState);
  const s = loadOwnerDriverSandbox(st, 'Пётр Наёмник', 'co-own');
  s.location.search = '?ownerDriverPreview=1';
  s.captureOwnerDriverPreviewFromUrl();
  assert.equal(s.isOwnerDriverPreviewEnabled(), true);
  assert.equal(s.isOwnerDriverCabinetActive(), false);
}

// Подмена companyId без JWT — кабинет off
{
  const st = structuredClone(baseState);
  const s = loadOwnerDriverSandbox(st, 'Иван Зеркало', 'co-foreign-own');
  assert.equal(s.isOwnerDriverCabinetMode(), false);
  assert.equal(s.ownerDriverSpaceId(), null);
  assert.equal(s.ownerDriverTrustedCompanyId(), null);
}

// Нет записи сессии / водитель без зеркала
{
  const st = structuredClone(baseState);
  st.drivers = st.drivers.filter((d) => d.id !== 'drv-mirror');
  const s = loadOwnerDriverSandbox(st, 'Иван Зеркало', 'co-own');
  assert.equal(s.ownerDriverSessionRecord(), null);
  assert.equal(s.ownerDriverSpaceId(), null);
}

// upsert чужого space отклоняется на клиенте
{
  const st = structuredClone(baseState);
  const jwt = {
    role: 'owner_driver',
    token: 'jwt-upsert',
    payload: {
      role: 'owner_driver',
      driverName: 'Иван Зеркало',
      companyId: 'co-own',
      spaceId: spaceMine,
      driverId: 'drv-mirror',
    },
  };
  const s = loadOwnerDriverSandbox(st, 'Иван Зеркало', 'co-own', jwt);
  const foreign = st.companies.find((c) => c.id === 'co-cust-foreign');
  assert.equal(s.ownerDriverCanManageCounterparty(foreign), false);
}

// Сохранение справочника — только local + маркер (без persist на сервер)
{
  const s = loadOwnerDriverSandbox(baseState, 'Иван Зеркало', 'co-own');
  s.ownerDriverPersistDirectoryLocalOnly();
  assert.equal(s.__persistLocalOnlyCalls, 1);
  assert.equal(s.sessionStorage.getItem('armada_od_dir_local_v1'), '1');
  const msg = s.ownerDriverConsumeDirectoryNotice();
  assert.ok(msg.includes('только на этом устройстве'));
}

console.log('owner-driver-isolation.test.mjs: ok');
