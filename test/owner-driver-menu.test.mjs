/**
 * Пункт «Водитель-собственник» в меню админки (/a/).
 * Причина бага: на /a/ не грузится driver.js → openDriverLogin undefined → кнопка молчала.
 * Синтетические данные, без staging/production.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');

// 1. Корневая причина: бандл /a/ без driver.js, обработчик меню не должен зависеть от openDriverLogin
{
  const boot = read('boot-loader.js');
  const aList = boot.match(/else if \(isA\) \{\s*files\.push\(([^)]*)\)/);
  assert.ok(aList, 'список файлов /a/ найден');
  assert.ok(!aList[1].includes("'driver.js'"), '/a/ не грузит driver.js');
  const app = read('app.js');
  const wire = app.match(/\$\('admin-as-driver'\)&&[^\n]*/);
  assert.ok(wire, 'обработчик admin-as-driver есть');
  assert.ok(!wire[0].includes('openDriverLogin'), 'кнопка не вызывает openDriverLogin (его нет на /a/)');
  assert.ok(wire[0].includes('openAdminOwnerDriverCabinet'));
  assert.ok(read('admin.js').includes('syncAdminAsDriverNav()'), 'updateAdminChrome обновляет пункт меню');
  // /v/ с сессией админа: restoreAdminSession → updateAdminChrome (нет admin.js) падал и ломал восстановление водителя
  assert.ok(
    /early === 'admin-pin' && typeof canAutoRestoreAdmin === 'function' && canAutoRestoreAdmin\(\)/.test(boot),
    'автовосстановление админа только на /a/'
  );
  // F5 на /v/: app.js показывает #driver раньше finishBoot — загрузчик не должен вернуть форму входа
  const fb = boot.slice(boot.indexOf('function finishBoot'));
  const guard = fb.indexOf("early === 'driver-login' && document.querySelector('#driver.show')");
  assert.ok(guard > 0 && guard < fb.indexOf('showScreenEarly(early)'), 'восстановленный водитель не перекрывается экраном входа');
}

const spaceMine = 'sp-mine';
const spaceOther = 'sp-other';
const baseState = {
  spaces: [
    { id: spaceMine, name: 'Мой space', ownCompanyId: 'co-own' },
    { id: spaceOther, name: 'Чужой space', ownCompanyId: 'co-foreign-own' },
  ],
  companies: [
    { id: 'co-own', name: 'Моя фирма', spaceId: spaceMine, roles: ['own'] },
    { id: 'co-foreign-own', name: 'Чужая own', spaceId: spaceOther, roles: ['own'] },
  ],
  admins: [
    { id: 'adm-mirror', name: 'Иван Зеркало', spaceId: spaceMine, phone: '+79001112233', role: 'dispatcher' },
    { id: 'adm-plain', name: 'Анна Логист', spaceId: spaceMine, phone: '+79005556677', role: 'dispatcher' },
  ],
  drivers: [
    { id: 'drv-mirror', name: 'Иван Зеркало', companyId: 'co-own', spaceId: spaceMine, ownerAdminId: 'adm-mirror', phone: '+79001112233' },
    { id: 'drv-hired', name: 'Пётр Наёмник', companyId: 'co-own', spaceId: spaceMine, ownerAdminId: 'adm-plain', phone: '+79002223344' },
  ],
  orders: [],
  vehicles: [],
};

function findDriverRecordLikeApp(state, name, companyId) {
  const nm = String(name || '').trim().toLowerCase();
  const list = state.drivers || [];
  return (
    (companyId && list.find((d) => String(d.name || '').trim().toLowerCase() === nm && d.companyId === companyId)) ||
    list.find((d) => String(d.name || '').trim().toLowerCase() === nm) ||
    null
  );
}

function sandboxFor(state, extra = {}) {
  const els = {
    'admin-as-driver': { textContent: 'Водитель', title: '', hidden: false, style: { display: '' }, setAttribute() {} },
  };
  const sb = {
    state,
    DRIVER: '',
    DRIVER_COMPANY_ID: null,
    currentAdmin: null,
    location: { pathname: '/a/', search: '', assigned: null, assign(u) { this.assigned = u; } },
    $: (id) => els[id] || null,
    __els: els,
    findCompanyById: (id) => (state.companies || []).find((c) => c.id === id),
    findSpaceById: (id) => (state.spaces || []).find((s) => s.id === id),
    findDriverRecord: (n, c) => findDriverRecordLikeApp(state, n, c),
    samePersonName: (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(),
    companyHasRole: (c, r) => !!(c && (c.roles || []).includes(r)),
    ownCompanyForSpaceId: (sid) => (state.companies || []).find((c) => c.spaceId === sid && (c.roles || []).includes('own')),
    unmarkDriverDeleted: () => false,
    ensureAdminDriverMirror: (adm) => {
      const co = sb.ownCompanyForSpaceId(adm.spaceId);
      if (!co || adm.skipDriverMirror) return false;
      if (state.drivers.some((d) => d.companyId === co.id && sb.samePersonName(d.name, adm.name))) return false;
      state.drivers.push({ id: 'drv-new', name: adm.name, companyId: co.id, spaceId: adm.spaceId, ownerAdminId: adm.id, phone: adm.phone || '' });
      return true;
    },
    bumpDataEpoch: () => {},
    persistDriverCardImmediate: async () => ({ ok: true }),
    restoreAdminSession: () => false,
    show: () => {},
    confirmAnswers: [],
    confirmCalls: [],
    alerts: [],
    ...extra,
  };
  sb.confirm = (msg) => { sb.confirmCalls.push(msg); return sb.confirmAnswers.length ? sb.confirmAnswers.shift() : false; };
  sb.alert = (msg) => { sb.alerts.push(msg); };
  vm.createContext(sb);
  vm.runInContext(read('space-modules.js'), sb);
  const app = read('app.js');
  const start = app.indexOf('function adminRecordForDriverNav(');
  const end = app.indexOf('function wireShellHandlers(');
  assert.ok(start > 0 && end > start, 'функции меню найдены в app.js');
  vm.runInContext(app.slice(start, end), sb);
  return sb;
}

const asAdmin = (sb, id) => { sb.currentAdmin = { id }; };

// 2. Статус зеркала для админа
{
  const sb = sandboxFor(structuredClone(baseState));
  const st = (id) => sb.ownerDriverMirrorStatusForAdmin(sb.state.admins.find((a) => a.id === id) || null);
  assert.equal(st('adm-mirror').reason, null);
  assert.equal(st('adm-mirror').rec.id, 'drv-mirror');
  assert.equal(st('adm-plain').reason, 'no_driver_profile', 'наёмный водитель админа — не зеркало');
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(null).reason, 'no_admin');
}
{
  const s = structuredClone(baseState);
  s.admins[0].skipDriverMirror = true;
  const sb = sandboxFor(s);
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(s.admins[0]).reason, 'skip_mirror');
}
{
  const s = structuredClone(baseState);
  s.spaces = [];
  const sb = sandboxFor(s);
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(s.admins[1]).reason, 'no_space', 'данные не загружены — не «нет фирмы»');
  asAdmin(sb, 'adm-plain');
  await sb.openAdminOwnerDriverCabinet();
  assert.equal(sb.confirmCalls.length, 0, 'меню водителя из /a/ отключено');
  assert.equal(s.drivers.length, 2);
}
{
  const s = structuredClone(baseState);
  s.drivers[0].companyId = 'co-foreign-own';
  const sb = sandboxFor(s);
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(s.admins[0]).reason, 'no_driver_profile', 'зеркало в чужой фирме не считается');
}
{
  const s = structuredClone(baseState);
  s.companies[0].roles = ['carrier'];
  const sb = sandboxFor(s);
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(s.admins[0]).reason, 'no_own_company');
}
{
  const s = structuredClone(baseState);
  s.drivers[0].phone = '';
  const sb = sandboxFor(s);
  assert.equal(sb.ownerDriverMirrorStatusForAdmin(s.admins[0]).reason, 'no_phone');
}

// 3. /v/: зеркало логиста — обычный вход; owner_driver — редирект на /o/; наёмник — нет; кабинет только с JWT
{
  const s = structuredClone(baseState);
  const sb = sandboxFor(s);
  sb.location.pathname = '/v/';
  const mirror = s.drivers.find((d) => d.id === 'drv-mirror');
  assert.equal(sb.shouldRedirectOwnerFromDriverEntry(mirror), false, 'зеркало — не owner_driver');
  const hired = s.drivers.find((d) => d.id === 'drv-hired');
  assert.equal(sb.shouldRedirectOwnerFromDriverEntry(hired), false);
  s.drivers.push({
    id: 'drv-owner-kind',
    name: 'Собственник ОО',
    companyId: 'co-own',
    spaceId: spaceMine,
    accountKind: 'owner_driver',
    phone: '+79009998877',
  });
  const ownerDrv = s.drivers.find((d) => d.id === 'drv-owner-kind');
  assert.equal(sb.shouldRedirectOwnerFromDriverEntry(ownerDrv), true);
  sb.DRIVER = 'Иван Зеркало';
  assert.equal(sb.isOwnerDriverCabinetMode(), false);
}

// 4. Пункт меню скрыт (этап 2.7)
{
  const sb = sandboxFor(structuredClone(baseState));
  asAdmin(sb, 'adm-mirror');
  sb.syncAdminAsDriverNav();
  assert.equal(sb.__els['admin-as-driver'].hidden, true);
  assert.equal(sb.__els['admin-as-driver'].style.display, 'none');
}

// 5. openAdminOwnerDriverCabinet — no-op
{
  const sb = sandboxFor(structuredClone(baseState));
  asAdmin(sb, 'adm-mirror');
  await sb.openAdminOwnerDriverCabinet();
  assert.equal(sb.location.assigned, null);
  assert.equal(sb.confirmCalls.length, 0);
}

console.log('owner-driver-menu.test.mjs: ok');
