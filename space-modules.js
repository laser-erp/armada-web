/* АРМАДА — продуктовые модули кабинета (собственник-водитель и др.).
 * Не SaaS BILLING_PLANS. Только чтение при загрузке; запись — супер в конструкторе. */
const SPACE_MODULE_IDS = ['orders_earnings', 'fuel', 'docs', 'counterparties', 'maintenance', 'exchange', 'branding'];
const OWNER_DRIVER_ROLE = 'owner_driver';

const SPACE_MODULE_LABELS = {
  orders_earnings: 'Заказы и заработок',
  fuel: 'Топливо',
  docs: 'Документы (накладные, ТН, ЭТрН)',
  counterparties: 'Контрагенты',
  maintenance: 'ТО и обслуживание',
  exchange: 'Биржа',
  branding: 'Оформление',
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
      modules: ['orders_earnings', 'fuel', 'docs', 'exchange'],
      maxVehicles: 3,
      priceLabel: 'по решению',
    },
    {
      id: 'owner_max',
      role: OWNER_DRIVER_ROLE,
      labelRu: 'Максимальный',
      modules: ['orders_earnings', 'fuel', 'docs', 'counterparties', 'maintenance', 'exchange', 'branding'],
      maxVehicles: 10,
      priceLabel: 'по решению',
    },
  ];
  return { version: 1, features, tariffs };
}

const EXCHANGE_AUTO_TARIFF_IDS = new Set(['owner_medium', 'owner_max']);
const BRANDING_AUTO_TARIFF_IDS = new Set(['owner_max']);

function catalogHasFeature(features, key) {
  return Array.isArray(features) && features.some((f) => f && String(f.key || '') === key);
}

function catalogHasExchangeFeature(features) {
  return catalogHasFeature(features, 'exchange');
}

/** Дополнить старый каталог из state (до модуля exchange). Не трогает явное снятие супером (exchange уже в features). */
function normalizePlatformEntitlementsCatalog(ent) {
  const def = defaultPlatformEntitlements();
  if (!ent || typeof ent !== 'object' || !Array.isArray(ent.tariffs) || !ent.tariffs.length) {
    return def;
  }
  const hadExchangeFeature = catalogHasExchangeFeature(ent.features);
  const hadBrandingFeature = catalogHasFeature(ent.features, 'branding');
  const features = Array.isArray(ent.features) ? ent.features.map((f) => ({ ...f })) : [];
  if (!hadExchangeFeature) {
    const ex = def.features.find((f) => f.key === 'exchange');
    if (ex) features.push({ ...ex });
  }
  if (!hadBrandingFeature) {
    const br = def.features.find((f) => f.key === 'branding');
    if (br) features.push({ ...br });
  }
  const superKnowsExchange = hadExchangeFeature;
  const superKnowsBranding = hadBrandingFeature;
  const tariffs = ent.tariffs.map((t) => {
    if (!t || typeof t !== 'object') return t;
    const id = String(t.id || '');
    const mods = Array.isArray(t.modules) ? t.modules.slice() : [];
    if (EXCHANGE_AUTO_TARIFF_IDS.has(id) && !mods.includes('exchange') && !superKnowsExchange) {
      mods.push('exchange');
    }
    if (BRANDING_AUTO_TARIFF_IDS.has(id) && !mods.includes('branding') && !superKnowsBranding) {
      mods.push('branding');
    }
    return { ...t, modules: mods };
  });
  return { ...ent, features, tariffs };
}

/** Каталог для резолвера: state или дефолт в памяти (без записи в state). */
function platformEntitlementsCatalog() {
  const cur = state.platform && state.platform.entitlements;
  if (cur && typeof cur === 'object' && Array.isArray(cur.tariffs) && cur.tariffs.length) {
    return normalizePlatformEntitlementsCatalog(cur);
  }
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
  const norm = normalizePlatformEntitlementsCatalog(cur);
  state.platform.entitlements = norm;
  return norm;
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

function isOwnerDriverProductSpace(space) {
  return !!(space && String(space.cabinetKind || '') === 'owner_driver');
}

const OWNER_SUBSCRIPTION_GRACE_MS = 3 * 86400000;

function ownerPaidUntilIsoFromSpace(space) {
  if (!isOwnerDriverProductSpace(space)) return null;
  const raw = space.ownerPaidUntil || space.ownerPilotEndsAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? String(raw).trim() : null;
}

function ownerSubscriptionStatusForSpace(space, nowMs) {
  const iso = ownerPaidUntilIsoFromSpace(space);
  if (!iso) return { phase: 'none' };
  const now = nowMs != null ? nowMs : Date.now();
  const end = new Date(iso).getTime();
  const graceEnd = end + OWNER_SUBSCRIPTION_GRACE_MS;
  if (now <= end) {
    return {
      phase: 'active',
      iso,
      daysLeft: Math.max(0, Math.ceil((end - now) / 86400000)),
    };
  }
  if (now <= graceEnd) {
    return {
      phase: 'grace',
      iso,
      daysLeft: Math.max(0, Math.ceil((graceEnd - now) / 86400000)),
    };
  }
  return { phase: 'expired', iso };
}

function ownerPaidUntilLabelForSpace(space) {
  const iso = ownerPaidUntilIsoFromSpace(space);
  if (!iso) return '—';
  const fmt = typeof formatBillingDate === 'function' ? formatBillingDate(iso) : iso.slice(0, 10);
  const st = ownerSubscriptionStatusForSpace(space);
  if (st.phase === 'active') return `${fmt} (осталось ${st.daysLeft} дн.)`;
  if (st.phase === 'grace') return `${fmt} (льгота ${st.daysLeft} дн.)`;
  if (st.phase === 'expired') return `${fmt} (просрочено)`;
  return fmt;
}

function extendOwnerPaidUntilOnSpace(space, addDays) {
  if (!space) return;
  const days = Number(addDays) || 0;
  if (days <= 0) return;
  const iso = ownerPaidUntilIsoFromSpace(space);
  const baseMs = iso && new Date(iso).getTime() > Date.now() ? new Date(iso).getTime() : Date.now();
  const next = new Date(baseMs + days * 86400000).toISOString();
  space.ownerPaidUntil = next;
  space.ownerPilotEndsAt = next;
}

function setOwnerPaidUntilOnSpace(space, isoDate) {
  if (!space || !isoDate) return;
  const d = new Date(isoDate);
  if (!Number.isFinite(d.getTime())) return;
  space.ownerPaidUntil = d.toISOString();
  space.ownerPilotEndsAt = space.ownerPaidUntil;
}

function blockOwnerSubscriptionOnSpace(space) {
  if (!space) return;
  const past = new Date(Date.now() - 10 * 86400000).toISOString();
  space.ownerPaidUntil = past;
  space.ownerPilotEndsAt = past;
}

/** Лимит ТС по продуктовому тарифу собственника (не SaaS). */
function ownerDriverVehicleLimitGuard(space) {
  if (!isOwnerDriverProductSpace(space)) return { ok: true };
  const max = resolveMaxVehiclesForSpace(space, OWNER_DRIVER_ROLE);
  if (max == null || !Number.isFinite(max)) return { ok: true };
  const sid = space.id;
  const count = (state.vehicles || []).filter((v) => v && v.spaceId === sid).length;
  if (count < max) return { ok: true };
  const tariffId = spaceProductTariffIdFromSpace(space);
  const tariff = tariffId ? platformTariffById(tariffId) : null;
  const label = (tariff && tariff.labelRu) || 'Базовый';
  const word = max === 1 ? 'машина' : 'машин';
  return {
    ok: false,
    code: 'owner_vehicle_limit',
    message: `На тарифе ${label} — ${max} ${word}. Чтобы добавить ещё, смените тариф (заявка суперадмину).`,
    maxVehicles: max,
  };
}

function ownerDriverDriverLimitGuard(space) {
  if (!isOwnerDriverProductSpace(space)) return { ok: true };
  const max = resolveMaxVehiclesForSpace(space, OWNER_DRIVER_ROLE) ?? 1;
  const sid = space.id;
  const count = (state.drivers || []).filter((d) => d && d.spaceId === sid).length;
  if (count < max) return { ok: true };
  const tariffId = spaceProductTariffIdFromSpace(space);
  const label = tariffId ? (platformTariffById(tariffId) || {}).labelRu : 'Базовый';
  return {
    ok: false,
    code: 'owner_driver_limit',
    message: `На тарифе ${label || 'Базовый'} — не больше ${max} водител${max === 1 ? 'я' : 'ей'}. Смените тариф, чтобы расширить.`,
  };
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

/** JWT входа /o/ — пока state ещё не подтянут с сервера. */
function ownerDriverRecordFromJwtClaims() {
  if (typeof armadaApiTokenRole !== 'function' || armadaApiTokenRole() !== 'owner_driver') return null;
  if (typeof DRIVER === 'undefined' || !DRIVER) return null;
  const tok = typeof armadaApiRoleToken === 'function' ? armadaApiRoleToken() : '';
  if (!tok || typeof decodeArmadaJwtPayload !== 'function') return null;
  const p = decodeArmadaJwtPayload(tok);
  if (!p || String(p.role || '').trim() !== 'owner_driver') return null;
  return {
    id: p.driverId || p.sub || null,
    name: DRIVER,
    companyId:
      (typeof DRIVER_COMPANY_ID !== 'undefined' && DRIVER_COMPANY_ID) || p.companyId || null,
    spaceId: p.spaceId || null,
    accountKind: 'owner_driver',
  };
}

/** Восстановить DRIVER / companyId из JWT (F5 на /o/). */
function applyOwnerDriverJwtToDriverSession() {
  if (typeof armadaApiTokenRole !== 'function' || armadaApiTokenRole() !== 'owner_driver') return;
  if (typeof DRIVER !== 'undefined' && DRIVER) return;
  const tok = typeof armadaApiRoleToken === 'function' ? armadaApiRoleToken() : '';
  const p = tok && typeof decodeArmadaJwtPayload === 'function' ? decodeArmadaJwtPayload(tok) : null;
  if (!p || !p.driverName) return;
  DRIVER = String(p.driverName).trim();
  DRIVER_COMPANY_ID = p.companyId || null;
  if (typeof mirrorDriverSessionToGlobal === 'function') mirrorDriverSessionToGlobal();
}

/** Учётка собственника или устаревшее зеркало админа (ownerAdminId не удаляем — только не пускаем на /v/). */
function isLegacyOwnerDriverMirrorRecord(rec) {
  if (!rec || !rec.ownerAdminId) return false;
  const adm = (state.admins || []).find((a) => a.id === rec.ownerAdminId);
  if (!adm || adm.skipDriverMirror) return false;
  if (typeof samePersonName !== 'function' || !samePersonName(adm.name, rec.name)) return false;
  const co =
    rec.companyId && typeof findCompanyById === 'function' ? findCompanyById(rec.companyId) : null;
  if (!co || typeof companyHasRole !== 'function' || !companyHasRole(co, 'own')) return false;
  if (adm.spaceId && co.spaceId && adm.spaceId !== co.spaceId) return false;
  return true;
}

function isOwnerDriverProfileRecord(rec) {
  if (!rec) return false;
  return String(rec.accountKind || '') === 'owner_driver';
}

function isDriverEntryPathV() {
  try {
    const p = String((typeof location !== 'undefined' && location.pathname) || '').toLowerCase();
    return /\/(v)(\/|$)/.test(p);
  } catch (_) {
    return false;
  }
}

/** На /v/ только accountKind owner_driver — сообщение с переходом на /o/; зеркало логиста входит как обычный водитель. */
function shouldRedirectOwnerFromDriverEntry(rec) {
  return isDriverEntryPathV() && isOwnerDriverProfileRecord(rec);
}

/** Сессия кабинета собственника — только JWT role owner_driver (вход /o/). */
function ownerDriverSessionRecord() {
  if (typeof armadaApiTokenRole !== 'function' || armadaApiTokenRole() !== 'owner_driver') {
    return null;
  }
  if (typeof applyOwnerDriverJwtToDriverSession === 'function') applyOwnerDriverJwtToDriverSession();
  if (typeof DRIVER === 'undefined' || !DRIVER) return null;
  const byJwt =
    typeof findDriverRecord === 'function' ? findDriverRecord(DRIVER, DRIVER_COMPANY_ID || null) : null;
  if (byJwt && String(byJwt.accountKind || '') === 'owner_driver') return byJwt;
  if (byJwt && byJwt.spaceId) return byJwt;
  if (byJwt) return byJwt;
  return ownerDriverRecordFromJwtClaims();
}

/** companyId из записи водителя-зеркала (не из подставленного поля сессии). */
function ownerDriverTrustedCompanyId() {
  const rec = ownerDriverSessionRecord();
  return rec && rec.companyId ? rec.companyId : null;
}

/** spaceId кабинета собственника — только при JWT owner_driver. */
function ownerDriverTrustedSpaceId() {
  const rec = ownerDriverSessionRecord();
  if (!rec) return null;
  if (rec.spaceId) return rec.spaceId;
  if (rec.companyId && typeof spaceIdForDriverCompany === 'function') {
    return spaceIdForDriverCompany(rec.companyId);
  }
  return null;
}

function isOwnerDriverCabinetMode() {
  return !!ownerDriverSessionRecord();
}

/**
 * Со стороны админа (/a/): legacy-зеркало «сам за рулём» (данные в справочнике; вход — отдельно /v/, пункт меню скрыт).
 * reason: null | no_admin | skip_mirror | no_space | no_own_company | no_driver_profile | no_phone
 */
function ownerDriverMirrorStatusForAdmin(adm) {
  if (!adm || !adm.id) return { rec: null, reason: 'no_admin' };
  if (adm.skipDriverMirror) return { rec: null, reason: 'skip_mirror' };
  const sp = adm.spaceId && typeof findSpaceById === 'function' ? findSpaceById(adm.spaceId) : null;
  if (!sp) return { rec: null, reason: 'no_space' };
  const hasOwn = (c) => !!c && typeof companyHasRole === 'function' && companyHasRole(c, 'own');
  let co = sp && sp.ownCompanyId && typeof findCompanyById === 'function' ? findCompanyById(sp.ownCompanyId) : null;
  if (!hasOwn(co) || (co.spaceId && co.spaceId !== adm.spaceId)) {
    co = adm.spaceId ? (state.companies || []).find((c) => c.spaceId === adm.spaceId && hasOwn(c)) || null : null;
  }
  if (!co) return { rec: null, reason: 'no_own_company' };
  const rec = (state.drivers || []).find(
    (d) =>
      d &&
      d.ownerAdminId === adm.id &&
      d.companyId === co.id &&
      typeof samePersonName === 'function' &&
      samePersonName(adm.name, d.name)
  );
  if (!rec) return { rec: null, reason: 'no_driver_profile' };
  if (!String(rec.phone || '').replace(/\D/g, '')) return { rec, reason: 'no_phone' };
  return { rec, reason: null };
}

function ownerDriverMirrorReasonText(reason) {
  switch (reason) {
    case 'skip_mirror':
      return 'В вашем кабинете отключён профиль водителя (при создании не отмечено «сам за рулём» или профиль удалили в справочнике).';
    case 'no_space':
      return 'Данные кабинета ещё загружаются (или кабинет не найден). Подождите несколько секунд и нажмите пункт ещё раз.';
    case 'no_own_company':
      return 'У кабинета нет «нашей фирмы» (компания с ролью «наша»). Отметьте её в «Справочники → Компании».';
    case 'no_driver_profile':
      return 'В «нашей фирме» нет водителя с вашим ФИО.';
    case 'no_phone':
      return 'У вашего профиля водителя нет телефона — без него не войти на /v/. Укажите телефон в «Профиль логиста» и сохраните.';
    case 'no_admin':
      return 'Сначала войдите в кабинет.';
    default:
      return '';
  }
}
