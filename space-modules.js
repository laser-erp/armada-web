/* АРМАДА — продуктовые модули кабинета (собственник-водитель и др.).
 * Не SaaS BILLING_PLANS. Только чтение при загрузке; запись — супер в конструкторе. */
const SPACE_MODULE_IDS = ['orders_earnings', 'fuel', 'docs', 'counterparties', 'maintenance'];
const OWNER_DRIVER_ROLE = 'owner_driver';

const SPACE_MODULE_LABELS = {
  orders_earnings: 'Заказы и заработок',
  fuel: 'Топливо',
  docs: 'Документы (накладные, ТН, ЭТрН)',
  counterparties: 'Контрагенты',
  maintenance: 'ТО и обслуживание',
};

const LEGACY_PRODUCT_TARIFF_IDS = { basic: 'owner_basic', medium: 'owner_medium', max: 'owner_max' };

function defaultPlatformEntitlements() {
  const features = SPACE_MODULE_IDS.map((key) => ({
    key,
    labelRu: SPACE_MODULE_LABELS[key] || key,
    roles: [OWNER_DRIVER_ROLE],
  }));
  const tariffs = [
    {
      id: 'owner_basic',
      role: OWNER_DRIVER_ROLE,
      labelRu: 'Базовый',
      modules: ['orders_earnings'],
      maxVehicles: 1,
      priceLabel: 'по решению',
    },
    {
      id: 'owner_medium',
      role: OWNER_DRIVER_ROLE,
      labelRu: 'Средний',
      modules: ['orders_earnings', 'fuel', 'docs'],
      maxVehicles: 3,
      priceLabel: 'по решению',
    },
    {
      id: 'owner_max',
      role: OWNER_DRIVER_ROLE,
      labelRu: 'Максимальный',
      modules: SPACE_MODULE_IDS.slice(),
      maxVehicles: 10,
      priceLabel: 'по решению',
    },
  ];
  return { version: 1, features, tariffs };
}

/** Каталог для резолвера: state или дефолт в памяти (без записи в state). */
function platformEntitlementsCatalog() {
  const cur = state.platform && state.platform.entitlements;
  if (cur && typeof cur === 'object' && Array.isArray(cur.tariffs) && cur.tariffs.length) return cur;
  return defaultPlatformEntitlements();
}

/** Записать каталог в state (конструктор супера). */
function ensurePlatformEntitlements() {
  if (!state.platform || typeof state.platform !== 'object') state.platform = {};
  const cur = state.platform.entitlements;
  if (!cur || typeof cur !== 'object' || !Array.isArray(cur.tariffs) || !cur.tariffs.length) {
    state.platform.entitlements = defaultPlatformEntitlements();
    return state.platform.entitlements;
  }
  if (!Array.isArray(cur.features)) cur.features = defaultPlatformEntitlements().features;
  return cur;
}

function normalizeProductTariffId(tariffId) {
  const id = String(tariffId || '').trim();
  if (!id) return '';
  return LEGACY_PRODUCT_TARIFF_IDS[id] || id;
}

function platformEntitlementTariffs(role) {
  const ent = platformEntitlementsCatalog();
  const r = String(role || OWNER_DRIVER_ROLE);
  return (ent.tariffs || []).filter((t) => t && String(t.role || '') === r);
}

function platformTariffById(tariffId) {
  const id = normalizeProductTariffId(tariffId);
  if (!id) return null;
  const ent = platformEntitlementsCatalog();
  return (ent.tariffs || []).find((t) => t && t.id === id) || null;
}

function spaceProductTariffById(tariffId) {
  return platformTariffById(tariffId);
}

function spaceProductTariffIdFromSpace(space) {
  if (!space || typeof space !== 'object') return null;
  const id = normalizeProductTariffId(space.productTariffId || space.ownerDriverTariffId || '');
  return id || null;
}

function normalizeModuleFlagsFromRaw(raw) {
  const out = {};
  SPACE_MODULE_IDS.forEach((mid) => {
    if (raw && typeof raw === 'object' && raw[mid] != null) out[mid] = !!raw[mid];
  });
  return out;
}

function allModulesOn() {
  const m = {};
  SPACE_MODULE_IDS.forEach((id) => {
    m[id] = true;
  });
  return m;
}

/** Итоговые флаги модулей для space. Без тарифа/overrides — все true (Армада/МБН/Нечаев). */
function resolveSpaceModules(space) {
  if (!space || typeof space !== 'object') return allModulesOn();

  const explicit = normalizeModuleFlagsFromRaw(space.modules);
  const overrides = normalizeModuleFlagsFromRaw(space.moduleOverrides);
  const hasExplicit = Object.keys(explicit).length > 0;
  const hasOverrides = Object.keys(overrides).length > 0;
  const tariffId = spaceProductTariffIdFromSpace(space);
  const tariff = tariffId ? platformTariffById(tariffId) : null;

  if (!hasExplicit && !hasOverrides && !tariff) return allModulesOn();

  const m = allModulesOn();
  if (tariff && Array.isArray(tariff.modules)) {
    SPACE_MODULE_IDS.forEach((id) => {
      m[id] = tariff.modules.includes(id);
    });
  }
  Object.keys(explicit).forEach((id) => {
    m[id] = explicit[id];
  });
  Object.keys(overrides).forEach((id) => {
    m[id] = overrides[id];
  });
  return m;
}

function resolveEntitlements(role, space) {
  const r = String(role || OWNER_DRIVER_ROLE);
  const modules = resolveSpaceModules(space);
  const tariffId = space ? spaceProductTariffIdFromSpace(space) : null;
  const tariff = tariffId ? platformTariffById(tariffId) : null;
  const maxVehicles = tariff && tariff.maxVehicles != null ? Number(tariff.maxVehicles) : null;
  return {
    role: r,
    modules,
    tariffId: tariff ? tariff.id : null,
    maxVehicles: Number.isFinite(maxVehicles) ? maxVehicles : null,
  };
}

function resolveMaxVehiclesForSpace(space, role) {
  return resolveEntitlements(role || OWNER_DRIVER_ROLE, space).maxVehicles;
}

function spaceModuleEnabled(space, moduleId) {
  const mid = String(moduleId || '').trim();
  if (!SPACE_MODULE_IDS.includes(mid)) return true;
  const flags = resolveSpaceModules(space);
  return flags[mid] !== false;
}

function spaceIdForDriverCompany(companyId) {
  if (!companyId) return null;
  const co = typeof findCompanyById === 'function' ? findCompanyById(companyId) : null;
  return (co && co.spaceId) || null;
}

/** Зеркало водителя = тот же человек, что админ space (галочка «сам за рулём»). */
function ownerDriverSessionRecord() {
  if (typeof DRIVER === 'undefined' || !DRIVER) return null;
  const cid = typeof DRIVER_COMPANY_ID !== 'undefined' ? DRIVER_COMPANY_ID : null;
  const rec = typeof findDriverRecord === 'function' ? findDriverRecord(DRIVER, cid) : null;
  if (!rec || !rec.ownerAdminId) return null;
  const adm = (state.admins || []).find((a) => a.id === rec.ownerAdminId);
  if (!adm || typeof samePersonName !== 'function' || !samePersonName(adm.name, rec.name)) return null;
  if (adm.skipDriverMirror) return null;
  const co = cid && typeof findCompanyById === 'function' ? findCompanyById(cid) : null;
  if (co && typeof companyHasRole === 'function' && !companyHasRole(co, 'own')) return null;
  return rec;
}

function isOwnerDriverCabinetMode() {
  return !!ownerDriverSessionRecord();
}
