/* АРМАДА — пресеты тем кабинета (шаг 2). Без ?theme= на проде — переменные из styles.css. */
(function (g) {
  'use strict';

  /** Параметры как в docs/design/theme-studio (16 пресетов). */
  var ARMADA_THEMES = {
    graphite: {
      name: 'Графит',
      note: 'фирменный стиль АРМАДЫ',
      accent: '#E01F26',
      menuBg: '#1E1F22',
      bg: '#F3F3F1',
      surface: '#FFFFFF',
      font: 'Onest',
      head: 'Onest',
      radius: 10,
      button: 'fill',
      card: 'border',
      status: 'pill',
      menuPos: 'left',
      layout: 'kanban',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    light: {
      name: 'Светлый',
      note: 'белый, меню сверху',
      accent: '#E01F26',
      menuBg: '#FFFFFF',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      font: 'Onest',
      head: 'Onest',
      radius: 6,
      button: 'fill',
      card: 'border',
      status: 'dot',
      menuPos: 'top',
      layout: 'table',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    night: {
      name: 'Ночь',
      note: 'тёмная, для ночных смен',
      accent: '#E01F26',
      menuBg: '#0B0B0C',
      bg: '#121214',
      surface: '#1C1D20',
      font: 'Onest',
      head: 'Onest',
      radius: 12,
      button: 'fill',
      card: 'border',
      status: 'dot',
      menuPos: 'left',
      layout: 'map',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    carbon: {
      name: 'Карбон',
      note: 'тёмный, точечная сетка, диспетчерская',
      accent: '#FF5A1F',
      menuBg: '#0A0B0D',
      bg: '#111317',
      surface: '#191C21',
      font: 'IBM Plex Sans',
      head: 'IBM Plex Sans',
      radius: 6,
      button: 'fill',
      card: 'border',
      status: 'stripe',
      menuPos: 'left',
      layout: 'timeline',
      texture: 'dots',
      bw: 1,
      caps: true,
    },
    asphalt: {
      name: 'Асфальт',
      note: 'холодный серый, строгий',
      accent: '#2F6FED',
      menuBg: '#263238',
      bg: '#ECEFF1',
      surface: '#FFFFFF',
      font: 'IBM Plex Sans',
      head: 'IBM Plex Sans',
      radius: 4,
      button: 'fill',
      card: 'flat',
      status: 'pill',
      menuPos: 'left',
      layout: 'table',
      texture: 'none',
      bw: 1,
      caps: true,
    },
    road: {
      name: 'Трасса',
      note: 'жёлто-чёрный, как дорожный знак',
      accent: '#F5C400',
      menuBg: '#111111',
      bg: '#F4F1E8',
      surface: '#FFFFFF',
      font: 'Golos Text',
      head: 'Golos Text',
      radius: 0,
      button: 'fill',
      card: 'border',
      status: 'stripe',
      menuPos: 'top',
      layout: 'tiles',
      texture: 'lines',
      bw: 2,
      caps: true,
    },
    brutal: {
      name: 'Бруталист',
      note: 'жирные рамки, моноширинный шрифт',
      accent: '#E01F26',
      menuBg: '#FFFFFF',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      font: 'IBM Plex Mono',
      head: 'IBM Plex Mono',
      radius: 0,
      button: 'fill',
      card: 'border',
      status: 'stripe',
      menuPos: 'top',
      layout: 'table',
      texture: 'none',
      bw: 2,
      caps: true,
    },
    paper: {
      name: 'Бланк',
      note: 'как документ: бумага и засечки',
      accent: '#1F3A93',
      menuBg: '#F7F4EC',
      bg: '#F7F4EC',
      surface: '#FFFDF7',
      font: 'PT Sans',
      head: 'PT Serif',
      radius: 2,
      button: 'outline',
      card: 'border',
      status: 'pill',
      menuPos: 'top',
      layout: 'table',
      texture: 'grid',
      bw: 1,
      caps: false,
    },
    sand: {
      name: 'Песок',
      note: 'тёплый и мягкий',
      accent: '#B4532A',
      menuBg: '#3B2F2A',
      bg: '#F6F0E6',
      surface: '#FFFDF9',
      font: 'PT Sans',
      head: 'PT Sans',
      radius: 14,
      button: 'soft',
      card: 'shadow',
      status: 'pill',
      menuPos: 'left',
      layout: 'kanban',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    ocean: {
      name: 'Океан',
      note: 'морской синий, карта',
      accent: '#0E9AAE',
      menuBg: '#0B2540',
      bg: '#EEF3F8',
      surface: '#FFFFFF',
      font: 'Manrope',
      head: 'Manrope',
      radius: 12,
      button: 'fill',
      card: 'shadow',
      status: 'pill',
      menuPos: 'left',
      layout: 'map',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    north: {
      name: 'Север',
      note: 'светлый холодный, линии',
      accent: '#3A6EA5',
      menuBg: '#E4EAF0',
      bg: '#F2F5F8',
      surface: '#FFFFFF',
      font: 'Manrope',
      head: 'Manrope',
      radius: 8,
      button: 'fill',
      card: 'border',
      status: 'dot',
      menuPos: 'left',
      layout: 'timeline',
      texture: 'grid',
      bw: 1,
      caps: false,
    },
    forest: {
      name: 'Лес',
      note: 'зелёный, спокойный',
      accent: '#2E7D4F',
      menuBg: '#14261C',
      bg: '#F1F4EF',
      surface: '#FFFFFF',
      font: 'Rubik',
      head: 'Rubik',
      radius: 10,
      button: 'soft',
      card: 'border',
      status: 'dot',
      menuPos: 'left',
      layout: 'kanban',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    minimal: {
      name: 'Минимал',
      note: 'чёрно-белый, ничего лишнего',
      accent: '#111111',
      menuBg: '#FFFFFF',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      font: 'Montserrat',
      head: 'Montserrat',
      radius: 0,
      button: 'outline',
      card: 'border',
      status: 'stripe',
      menuPos: 'top',
      layout: 'kanban',
      texture: 'none',
      bw: 1,
      caps: true,
    },
    classic: {
      name: 'Классика',
      note: 'как привычные 1С и Excel',
      accent: '#1F6FD1',
      menuBg: '#F3F6FA',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      font: 'PT Sans',
      head: 'PT Sans',
      radius: 3,
      button: 'fill',
      card: 'border',
      status: 'pill',
      menuPos: 'top',
      layout: 'table',
      texture: 'none',
      bw: 1,
      caps: false,
    },
    violet: {
      name: 'Неон',
      note: 'тёмный фиолетовый',
      accent: '#7C5CFF',
      menuBg: '#0E0E1A',
      bg: '#14142A',
      surface: '#1D1D36',
      font: 'Nunito',
      head: 'Nunito',
      radius: 16,
      button: 'fill',
      card: 'shadow',
      status: 'pill',
      menuPos: 'left',
      layout: 'tiles',
      texture: 'dots',
      bw: 1,
      caps: false,
    },
    coral: {
      name: 'Коралл',
      note: 'светлый, дружелюбный',
      accent: '#E8505B',
      menuBg: '#FFF4F2',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
      font: 'Nunito',
      head: 'Nunito',
      radius: 18,
      button: 'soft',
      card: 'shadow',
      status: 'dot',
      menuPos: 'top',
      layout: 'tiles',
      texture: 'none',
      bw: 1,
      caps: false,
    },
  };

  var ARMADA_THEME_IDS = Object.keys(ARMADA_THEMES);
  var STAGING_THEME_IDS = ARMADA_THEME_IDS;
  var fontsLoaded = Object.create(null);

  function lum(h) {
    var n = String(h).replace('#', '');
    return [0, 2, 4]
      .map(function (i) {
        return parseInt(n.substr(i, 2), 16) / 255;
      })
      .map(function (v) {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      })
      .reduce(function (a, v, i) {
        return a + v * [0.2126, 0.7152, 0.0722][i];
      }, 0);
  }

  function contrast(a, b) {
    var A = lum(a);
    var B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  }

  function onColor(h) {
    return contrast(h, '#FFFFFF') >= contrast(h, '#17181B') ? '#FFFFFF' : '#17181B';
  }

  function armadaThemeVars(t) {
    var dark = lum(t.surface) < 0.2;
    var darkMenu = lum(t.menuBg) < 0.3;
    var text = dark ? '#ECECEE' : '#17181B';
    var heroFg = lum(t.menuBg) < 0.35 ? '#ECECEE' : '#17181B';
    return {
      '--accent': t.accent,
      '--on-accent': onColor(t.accent),
      '--link': contrast(t.accent, t.surface) >= 3 ? t.accent : text,
      '--bg0': t.bg,
      '--bg1': t.surface,
      '--surface': t.surface,
      '--text': text,
      '--ink': text,
      '--muted': dark ? '#B4B6BE' : '#5F6168',
      '--border': dark ? '#7A7D87' : '#7A808A',
      '--field': dark ? '#32343A' : '#F2F2EF',
      '--surface-hover': dark ? '#2E3036' : '#F2F2EF',
      '--surface2': dark ? '#2A2C30' : '#F0F0ED',
      '--order-hero-bg':
        'linear-gradient(135deg, color-mix(in srgb, var(--menu-bg) 90%, var(--accent)) 0%, color-mix(in srgb, var(--accent) 38%, var(--menu-bg)) 100%)',
      '--order-hero-fg': heroFg,
      '--menu-bg': t.menuBg,
      '--menu-text': darkMenu ? '#D8D9DE' : '#45474D',
      '--radius': t.radius + 'px',
      '--pill': Math.min(t.radius, 20) + 'px',
      '--font': "'" + t.font + "', system-ui, sans-serif",
      '--font-head': "'" + (t.head || t.font) + "', system-ui, sans-serif",
    };
  }

  function googleFontHref(name) {
    var q = String(name || '').trim().replace(/\s+/g, '+');
    return 'https://fonts.googleapis.com/css2?family=' + q + ':wght@400;500;600;700&display=swap';
  }

  function ensureThemeFont(name) {
    if (!name || name === 'Inter' || fontsLoaded[name]) return;
    fontsLoaded[name] = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontHref(name);
    document.head.appendChild(link);
  }

  function applyArmadaTheme(t) {
    if (!t) return;
    var vars = armadaThemeVars(t);
    var root = document.documentElement;
    Object.keys(vars).forEach(function (k) {
      root.style.setProperty(k, vars[k]);
    });
    root.style.colorScheme = lum(t.surface) < 0.2 ? 'dark' : 'light';
    root.setAttribute('data-armada-theme', 'preview');
    ensureThemeFont(t.font);
    if (t.head && t.head !== t.font) ensureThemeFont(t.head);
  }

  function armadaThemeStagingHost() {
    try {
      var h = (location.hostname || '').toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1') return true;
      if (h === 'staging.app.armada.sx') return true;
      if (h.endsWith('.localtest.me')) return true;
    } catch (_) {}
    return false;
  }

  function armadaThemePresetFromId(id) {
    var key = String(id || '').toLowerCase();
    if (!ARMADA_THEMES[key]) return null;
    var base = ARMADA_THEMES[key];
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = base[k];
    });
    if (!out.head) out.head = out.font;
    return out;
  }

  function armadaParseThemeQuery() {
    if (!armadaThemeStagingHost()) return null;
    try {
      var q = new URLSearchParams(location.search || '');
      var themeId = (q.get('theme') || '').toLowerCase();
      if (!ARMADA_THEMES[themeId]) return null;
      var preset = armadaThemePresetFromId(themeId);
      if (!preset) return null;
      var accentRaw = (q.get('accent') || '').replace(/^#/, '');
      if (/^[0-9A-Fa-f]{6}$/.test(accentRaw)) preset.accent = '#' + accentRaw.toUpperCase();
      return preset;
    } catch (_) {
      return null;
    }
  }

  function armadaApplyThemeFromUrl() {
    var preset = armadaParseThemeQuery();
    if (preset) applyArmadaTheme(preset);
    return preset;
  }

  var DENSITY_VARS = {
    compact: { '--pad': '8px', '--gap': '6px', '--touch': '40px', '--fs': '14px' },
    normal: { '--pad': '12px', '--gap': '8px', '--touch': '44px', '--fs': '15px' },
    roomy: { '--pad': '16px', '--gap': '12px', '--touch': '48px', '--fs': '16px' },
  };

  var THEME_FONT_OPTIONS = [
    'Onest',
    'Manrope',
    'IBM Plex Sans',
    'Golos Text',
    'PT Sans',
    'PT Serif',
    'Montserrat',
    'Rubik',
    'Nunito',
    'IBM Plex Mono',
  ];

  function defaultSpaceThemeConfig() {
    return {
      preset: 'light',
      accent: null,
      logo: null,
      font: null,
      radius: null,
      density: 'normal',
      applyTo: { cabinet: true, driver: true, portal: true, docs: false },
      driverTheme: 'same',
    };
  }

  function normalizeSpaceThemeConfig(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var base = defaultSpaceThemeConfig();
    var preset = String(raw.preset || base.preset).toLowerCase();
    if (!ARMADA_THEMES[preset]) preset = 'light';
    base.preset = preset;
    var acc = String(raw.accent || '').trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(acc)) base.accent = '#' + acc.replace('#', '').toUpperCase();
    if (raw.logo && String(raw.logo).indexOf('data:image/') === 0) base.logo = String(raw.logo);
    if (raw.font && THEME_FONT_OPTIONS.indexOf(String(raw.font)) >= 0) base.font = String(raw.font);
    var r = Number(raw.radius);
    if (Number.isFinite(r) && r >= 0 && r <= 24) base.radius = Math.round(r);
    if (raw.density === 'compact' || raw.density === 'roomy' || raw.density === 'normal') base.density = raw.density;
    if (raw.driverTheme === 'night' || raw.driverTheme === 'same') base.driverTheme = raw.driverTheme;
    if (raw.applyTo && typeof raw.applyTo === 'object') {
      base.applyTo = {
        cabinet: raw.applyTo.cabinet !== false,
        driver: raw.applyTo.driver !== false,
        portal: raw.applyTo.portal !== false,
        docs: !!raw.applyTo.docs,
      };
    }
    return base;
  }

  function armadaThemeLogoBytes(logo) {
    if (!logo || typeof logo !== 'string') return 0;
    var m = logo.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
    if (!m) return logo.length;
    return Math.floor((m[1].length * 3) / 4);
  }

  function armadaResolvedThemeTokens(themeCfg, context) {
    var cfg = normalizeSpaceThemeConfig(themeCfg);
    if (!cfg) return null;
    var presetId = cfg.preset;
    if (context === 'driver' && cfg.driverTheme === 'night') presetId = 'night';
    var preset = armadaThemePresetFromId(presetId);
    if (!preset) return null;
    if (cfg.accent) preset.accent = cfg.accent;
    if (cfg.font) {
      preset.font = cfg.font;
      preset.head = cfg.font;
    }
    if (cfg.radius != null) preset.radius = cfg.radius;
    return { preset: preset, density: cfg.density || 'normal', logo: cfg.logo || null };
  }

  function armadaResetThemeInline() {
    var root = document.documentElement;
    var sample = armadaThemeVars({
      accent: '#E01F26',
      menuBg: '#FFFFFF',
      bg: '#F3F3F1',
      surface: '#FFFFFF',
      font: 'Onest',
      head: 'Onest',
      radius: 6,
    });
    Object.keys(sample).forEach(function (k) {
      root.style.removeProperty(k);
    });
    Object.keys(DENSITY_VARS.normal).forEach(function (k) {
      root.style.removeProperty(k);
    });
    root.style.removeProperty('color-scheme');
    root.removeAttribute('data-armada-theme');
    root.removeAttribute('data-armada-density');
    root.removeAttribute('data-armada-space-id');
  }

  function armadaApplyDefaultAppTheme() {
    var preset = armadaThemePresetFromId('light');
    if (!preset) return null;
    applyArmadaTheme(preset);
    armadaApplyDensity('normal');
    try {
      document.documentElement.removeAttribute('data-armada-space-id');
    } catch (_) {}
    return preset;
  }

  function armadaApplyDensity(density) {
    var d = DENSITY_VARS[density] || DENSITY_VARS.normal;
    var root = document.documentElement;
    Object.keys(d).forEach(function (k) {
      root.style.setProperty(k, d[k]);
    });
    root.setAttribute('data-armada-density', density || 'normal');
  }

  function armadaPaintBrandLogo(logoUrl, imgEl, fallbackSrc) {
    if (!imgEl) return;
    if (logoUrl) {
      imgEl.src = logoUrl;
      imgEl.hidden = false;
    } else if (fallbackSrc) {
      imgEl.src = fallbackSrc;
      imgEl.hidden = false;
    }
  }

  function armadaPaintAdminSidebarBrand(space) {
    var brand = document.querySelector('.admin-sidebar-brand span');
    var img = document.querySelector('.admin-sidebar-logo');
    if (brand && space && space.name) brand.textContent = space.name;
    else if (brand) brand.textContent = 'АРМАДА';
    var logo = space && space.theme && space.theme.logo ? space.theme.logo : null;
    armadaPaintBrandLogo(logo, img, '/icons/icon-192.png');
  }

  function armadaResolvePortalCarrierSpace() {
    if (typeof findSpaceById !== 'function' || typeof findSpaceByPortalSlug !== 'function') return null;
    try {
      var fromUrl = typeof readPortalScopeFromUrl === 'function' ? readPortalScopeFromUrl() : null;
      if (fromUrl) {
        if (fromUrl.spaceId) return findSpaceById(fromUrl.spaceId);
        if (fromUrl.portalSlug) return findSpaceByPortalSlug(fromUrl.portalSlug);
        if (fromUrl.companyId && typeof findCompanyById === 'function') {
          var coUrl = findCompanyById(fromUrl.companyId);
          if (coUrl && coUrl.spaceId) return findSpaceById(coUrl.spaceId);
        }
      }
      var scope = typeof getPortalScope === 'function' ? getPortalScope() : null;
      if (scope) {
        if (scope.spaceId) return findSpaceById(scope.spaceId);
        if (scope.portalSlug) return findSpaceByPortalSlug(scope.portalSlug);
      }
      var path = String((location.pathname || '').toLowerCase());
      var slugM = path.match(/\/z\/([a-z0-9][a-z0-9_-]{2,31})\/?/i);
      if (slugM) return findSpaceByPortalSlug(slugM[1].toLowerCase());
      if (typeof currentCustomer !== 'undefined' && currentCustomer) {
        if (currentCustomer.spaceId) return findSpaceById(currentCustomer.spaceId);
        if (currentCustomer.companyId && typeof findCompanyById === 'function') {
          var co = findCompanyById(currentCustomer.companyId);
          if (co && co.spaceId) return findSpaceById(co.spaceId);
        }
      }
    } catch (_) {}
    return null;
  }

  function armadaEntryContextKind() {
    try {
      var p = String((location.pathname || '').toLowerCase());
      if (/\/(a)(\/|$)/.test(p)) return 'cabinet';
      if (/\/(o)(\/|$)/.test(p)) return 'owner';
      if (/\/(v)(\/|$)/.test(p)) return 'driver';
      if (/\/(z)(\/|$)/.test(p)) return 'portal';
    } catch (_) {}
    return null;
  }

  function armadaShouldApplySpaceTheme(context, themeCfg) {
    var cfg = normalizeSpaceThemeConfig(themeCfg);
    if (!cfg) return false;
    var a = cfg.applyTo || {};
    if (context === 'cabinet' || context === 'owner') return !!a.cabinet;
    if (context === 'driver') return !!a.driver;
    if (context === 'portal') return !!a.portal;
    return false;
  }

  function armadaApplySpaceThemeForSpace(space, context) {
    if (!space || !context) return;
    var applyCtx = context === 'owner' ? 'cabinet' : context;
    if (!armadaShouldApplySpaceTheme(applyCtx, space.theme)) {
      armadaApplyDefaultAppTheme();
      armadaPaintAdminSidebarBrand(space);
      return;
    }
    var resolved = armadaResolvedThemeTokens(space.theme, context === 'driver' ? 'driver' : 'cabinet');
    if (!resolved) return;
    applyArmadaTheme(resolved.preset);
    armadaApplyDensity(resolved.density);
    document.documentElement.setAttribute('data-armada-space-id', space.id || '');
    if (context === 'cabinet' || context === 'owner') armadaPaintAdminSidebarBrand(space);
    return resolved;
  }

  function armadaSyncEntryBranding() {
    if (armadaParseThemeQuery()) {
      armadaApplyThemeFromUrl();
      return;
    }
    var ctx = armadaEntryContextKind();
    if (!ctx) {
      armadaApplyDefaultAppTheme();
      return;
    }
    var space = null;
    try {
      if (ctx === 'cabinet' && typeof findSpaceById === 'function') {
        var cabSid = null;
        try {
          if (typeof catalogViewSpaceId === 'function') cabSid = catalogViewSpaceId();
        } catch (_) {}
        if (!cabSid && typeof currentSpaceId === 'function') cabSid = currentSpaceId();
        if (cabSid) space = findSpaceById(cabSid);
      } else if (ctx === 'owner' && typeof ownerDriverTrustedSpaceId === 'function' && typeof findSpaceById === 'function') {
        space = findSpaceById(ownerDriverTrustedSpaceId());
      } else if (ctx === 'driver' && typeof DRIVER !== 'undefined' && typeof spaceIdForDriverCompany === 'function') {
        var cid = typeof DRIVER_COMPANY_ID !== 'undefined' ? DRIVER_COMPANY_ID : null;
        var sid = spaceIdForDriverCompany(cid);
        if (sid && typeof findSpaceById === 'function') space = findSpaceById(sid);
      } else if (ctx === 'portal') {
        space = armadaResolvePortalCarrierSpace();
      }
    } catch (_) {}
    if (!space || !space.theme) {
      armadaApplyDefaultAppTheme();
      if (space) armadaPaintAdminSidebarBrand(space);
      return;
    }
    armadaApplySpaceThemeForSpace(space, ctx === 'owner' ? 'owner' : ctx);
  }

  function armadaContrastLabel(accent, surface) {
    var surf = surface || '#FFFFFF';
    var c = contrast(accent, surf);
    if (c >= 4.5) return { ok: true, text: 'читается' };
    if (c >= 3) return { ok: false, text: 'слабовато' };
    return { ok: false, text: 'плохо читается' };
  }

  /** Контраст текста на акцентной кнопке (как armadaOnColor в UI). */
  function armadaButtonContrastLabel(accent) {
    var acc = String(accent || '#E01F26').trim();
    if (!/^#[0-9A-F]{6}$/i.test(acc)) acc = '#E01F26';
    var on = onColor(acc);
    var cOn = contrast(on, acc);
    if (cOn >= 4.5) return { ok: true, text: 'читается', onColor: on };
    var cW = contrast('#FFFFFF', acc);
    var cD = contrast('#17181B', acc);
    if (cW >= 4.5 || cD >= 4.5) {
      return { ok: true, text: 'читается', onColor: cW >= cD ? '#FFFFFF' : '#17181B' };
    }
    if (Math.max(cW, cD) >= 3) return { ok: false, text: 'слабовато', onColor: on };
    return { ok: false, text: 'плохо читается', onColor: on };
  }

  function mixHex(a, b, t) {
    var pa = parseInt(String(a || '#000000').replace('#', ''), 16);
    var pb = parseInt(String(b || '#ffffff').replace('#', ''), 16);
    var ar = (pa >> 16) & 255;
    var ag = (pa >> 8) & 255;
    var ab = pa & 255;
    var br = (pb >> 16) & 255;
    var bg = (pb >> 8) & 255;
    var bb = pb & 255;
    var u = Math.max(0, Math.min(1, Number(t) || 0));
    var r = Math.round(ar + (br - ar) * u);
    var g = Math.round(ag + (bg - ag) * u);
    var bl = Math.round(ab + (bb - ab) * u);
    return (
      '#' +
      [r, g, bl]
        .map(function (x) {
          return ('0' + x.toString(16)).slice(-2);
        })
        .join('')
        .toUpperCase()
    );
  }

  function armadaSuggestReadableAccent(accent, surface) {
    var surf = surface || '#FFFFFF';
    var h = String(accent || '#E01F26').trim();
    if (!/^#[0-9A-F]{6}$/i.test(h)) h = '#E01F26';
    if (contrast(h, surf) >= 4.5) return h;
    var palette = ['#E01F26', '#157A4A', '#2F6FED', '#B4532A', '#0E9AAE', '#17181B', '#7C5CFF'];
    var best = null;
    var bestC = 0;
    palette.forEach(function (cand) {
      var c = contrast(cand, surf);
      if (c >= 4.5 && c > bestC) {
        best = cand;
        bestC = c;
      }
    });
    if (best) return best;
    var darkSurf = lum(surf) > 0.55;
    for (var i = 0; i < 24; i++) {
      h = darkSurf ? mixHex(h, '#17181B', 0.1) : mixHex(h, '#FFFFFF', 0.12);
      if (contrast(h, surf) >= 4.5) return h;
    }
    return h;
  }

  function armadaColorsFromLogo(dataUrl, limit) {
    return new Promise(function (resolve) {
      if (!dataUrl) {
        resolve([]);
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          var w = 48;
          var h = 48;
          canvas.width = w;
          canvas.height = h;
          var ctx2 = canvas.getContext('2d');
          ctx2.drawImage(img, 0, 0, w, h);
          var data = ctx2.getImageData(0, 0, w, h).data;
          var freq = Object.create(null);
          for (var i = 0; i < data.length; i += 16) {
            var a = data[i + 3];
            if (a < 128) continue;
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];
            var key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            freq[key] = (freq[key] || 0) + 1;
          }
          var keys = Object.keys(freq).sort(function (a, b) {
            return freq[b] - freq[a];
          });
          var out = [];
          keys.forEach(function (k) {
            if (out.length >= (limit || 5)) return;
            var r = ((k >> 8) & 15) << 4;
            var g = ((k >> 4) & 15) << 4;
            var b = (k & 15) << 4;
            var hex =
              '#' +
              [r, g, b]
                .map(function (x) {
                  return ('0' + x.toString(16)).slice(-2);
                })
                .join('')
                .toUpperCase();
            if (out.indexOf(hex) < 0) out.push(hex);
          });
          resolve(out);
        } catch (e) {
          resolve([]);
        }
      };
      img.onerror = function () {
        resolve([]);
      };
      img.src = dataUrl;
    });
  }

  function armadaCompressImageFile(file, maxBytes) {
    maxBytes = maxBytes || 200 * 1024;
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('not_image'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxSide = 512;
          var w = img.width;
          var h = img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx2 = canvas.getContext('2d');
          ctx2.drawImage(img, 0, 0, w, h);
          var q = 0.92;
          var dataUrl = canvas.toDataURL('image/jpeg', q);
          while (armadaThemeLogoBytes(dataUrl) > maxBytes && q > 0.35) {
            q -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', q);
          }
          if (armadaThemeLogoBytes(dataUrl) > maxBytes) {
            reject(new Error('too_large'));
            return;
          }
          resolve(dataUrl);
        };
        img.onerror = function () {
          reject(new Error('decode'));
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        reject(new Error('read'));
      };
      reader.readAsDataURL(file);
    });
  }

  g.ARMADA_THEMES = ARMADA_THEMES;
  g.ARMADA_THEME_IDS = ARMADA_THEME_IDS;
  g.ARMADA_THEME_STAGING_IDS = STAGING_THEME_IDS;
  g.armadaLum = lum;
  g.armadaContrast = contrast;
  g.armadaOnColor = onColor;
  g.armadaThemeVars = armadaThemeVars;
  g.applyArmadaTheme = applyArmadaTheme;
  g.armadaThemeStagingHost = armadaThemeStagingHost;
  g.armadaThemePresetFromId = armadaThemePresetFromId;
  g.armadaParseThemeQuery = armadaParseThemeQuery;
  g.armadaApplyThemeFromUrl = armadaApplyThemeFromUrl;
  g.defaultSpaceThemeConfig = defaultSpaceThemeConfig;
  g.normalizeSpaceThemeConfig = normalizeSpaceThemeConfig;
  g.armadaThemeLogoBytes = armadaThemeLogoBytes;
  g.armadaResolvedThemeTokens = armadaResolvedThemeTokens;
  g.armadaResetThemeInline = armadaResetThemeInline;
  g.armadaApplyDefaultAppTheme = armadaApplyDefaultAppTheme;
  g.armadaApplyDensity = armadaApplyDensity;
  g.armadaSyncEntryBranding = armadaSyncEntryBranding;
  g.armadaApplySpaceThemeForSpace = armadaApplySpaceThemeForSpace;
  g.armadaContrastLabel = armadaContrastLabel;
  g.armadaButtonContrastLabel = armadaButtonContrastLabel;
  g.armadaSuggestReadableAccent = armadaSuggestReadableAccent;
  g.armadaColorsFromLogo = armadaColorsFromLogo;
  g.armadaCompressImageFile = armadaCompressImageFile;
  g.ARMADA_THEME_FONT_OPTIONS = THEME_FONT_OPTIONS;
  g.armadaEntryContextKind = armadaEntryContextKind;
  g.armadaResolvePortalCarrierSpace = armadaResolvePortalCarrierSpace;

  armadaApplyThemeFromUrl();
})(typeof globalThis !== 'undefined' ? globalThis : window);
