/**
 * Гонка enterAsDriver: updateDriverChrome до show('driver') не должна оставлять наёмный UI.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeDom() {
  const screens = new Map();
  const mkEl = (id) => {
    const el = {
      id,
      className: '',
      hidden: false,
      innerHTML: '',
      children: [],
      parentNode: null,
      dataset: {},
      classList: {
        add(c) {
          el.className = `${el.className} ${c}`.trim();
        },
        remove(c) {
          el.className = el.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim();
        },
        toggle(c, on) {
          if (on) el.classList.add(c);
          else el.classList.remove(c);
        },
      },
      querySelector() {
        return null;
      },
      appendChild(ch) {
        el.children.push(ch);
        ch.parentNode = el;
      },
      insertBefore(ch) {
        el.appendChild(ch);
      },
      setAttribute() {},
      removeAttribute() {},
    };
    if (id) screens.set(id, el);
    return el;
  };
  const driver = mkEl('driver');
  mkEl('shell');
  return {
    driver,
    document: {
      querySelector(sel) {
        if (sel === '#driver.show') {
          return driver.className.includes('show') ? driver : null;
        }
        return null;
      },
      getElementById(id) {
        return screens.get(id) || null;
      },
      querySelectorAll(sel) {
        if (sel === '.phone > .screen') return [...screens.values()];
        return [];
      },
      createElement() {
        return mkEl('');
      },
    },
  };
}

function loadSandbox(dom) {
  const state = { drivers: [], companies: [], admins: [], spaces: [] };
  let odCode = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
  odCode = odCode.replace(/\ninitOwnerDriverShell\(\);\s*$/, '\n');
  const smCode = readFileSync(path.join(root, 'space-modules.js'), 'utf8');
  const sandbox = {
    URLSearchParams,
    state,
    DRIVER: '',
    DRIVER_COMPANY_ID: 'co-new',
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
    location: { search: '', pathname: '/o/' },
    document: dom.document,
    $: (id) => dom.document.getElementById(id),
    findCompanyById: () => null,
    findSpaceById: () => null,
    findDriverRecord: () => null,
    samePersonName: (a, b) => String(a || '').trim() === String(b || '').trim(),
    companyHasRole: () => true,
    armadaApiTokenRole: () => 'owner_driver',
    armadaApiRoleToken: () => 'jwt-race',
    decodeArmadaJwtPayload: () => ({
      role: 'owner_driver',
      driverName: 'ТЕСТ QA Собственник',
      companyId: 'co-new',
      spaceId: 'sp-new',
    }),
    spaceModuleEnabled: () => true,
    fleetVehiclesForCompany: () => [],
    allOrders: () => [],
    esc: (s) => String(s ?? ''),
    fmt: (n) => String(n),
    hideDriverPanels: () => {},
    leaveDriverMode: () => {},
    renderDriverHome: () => {},
    driverHomeStats: () => ({ pay: 0, km: 0, done: 0, activeCount: 0, shiftVal: '—', shiftCls: '' }),
    driverDayKmHtml: () => '<b>0</b>',
    ownerDriverCounterpartyModuleEnabled: () => true,
    ownerDriverVehicleNavEnabled: () => false,
    ownerDriverCounterparties: () => [],
    ownerDriverOwnCompany: () => null,
    ownerDriverFleetVehicles: () => [],
    ownerDriverResolveVehicleId: () => null,
    ownerDriverMyOrders: () => [],
    ownerDriverDirectoryNoticeHtml: () => '',
    ownerDriverOrderKm: () => null,
    ownerDriverOrderPriceLabel: () => '',
    ownerDriverTripDocsHtml: () => '',
    ownerDriverWireTripDocs: () => {},
    ownerDriverTripsTableHtml: () => '',
    ownerDriverWireNavButtons: () => {},
    ownerDriverSyncModuleNav: () => {},
    ownerDriverSyncSidebarHead: () => {},
    ownerDriverSetHandoffClass: () => {},
  };
  vm.runInNewContext(smCode, sandbox);
  vm.runInNewContext(odCode, sandbox);
  sandbox.ownerDriverActivateUi = function () {
    dom.driver.classList.add('owner-driver-active');
  };
  sandbox.ensureOwnerDriverShellDom = function () {};
  sandbox.show = function (id) {
    dom.document.querySelectorAll('.phone > .screen').forEach((s) => s.classList.remove('show'));
    const el = dom.document.getElementById(id);
    if (el) el.classList.add('show');
    if (id === 'driver') sandbox.ownerDriverMaybeActivateCabinetUi();
  };
  sandbox.patchShowForOwnerDriverCabinet();
  sandbox.updateDriverChrome = function () {
    sandbox.ownerDriverMaybeActivateCabinetUi();
  };
  sandbox.enterAsDriver = async function (rec) {
    sandbox.DRIVER = rec.name;
    sandbox.updateDriverChrome();
    sandbox.show('driver');
  };
  sandbox.wrapEnterAsDriverForOwnerCabinet();
  sandbox.patchUpdateDriverChromeForOwner = function () {};
  return sandbox;
}

await (async () => {
  const dom = makeDom();
  const sandbox = loadSandbox(dom);
  assert.equal(dom.driver.className.includes('owner-driver-active'), false);
  await sandbox.enterAsDriver({ name: 'ТЕСТ QA Собственник', accountKind: 'owner_driver' });
  assert.equal(dom.driver.className.includes('show'), true);
  assert.equal(dom.driver.className.includes('owner-driver-active'), true, 'owner UI after enterAsDriver race');
})();

{
  const od = readFileSync(path.join(root, 'owner-driver.js'), 'utf8');
  assert.match(od, /function ownerDriverMaybeActivateCabinetUi/, 'maybe activate helper');
  assert.match(od, /patchShowForOwnerDriverCabinet/, 'show() patch');
  const syncFn = od.match(/function syncOwnerDriverChrome\(\)\{[\s\S]*?\n\}/);
  assert.ok(syncFn, 'syncOwnerDriverChrome');
  assert.doesNotMatch(syncFn[0], /ownerDriverDeactivateUi/, 'no deactivate in syncOwnerDriverChrome');
}

console.log('owner-driver-activate-race.test.mjs: ok');
