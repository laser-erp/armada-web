/* Гость на / или /index.html → landing.html (без Caddy). Тесты: guest-landing-redirect.test.mjs */
(function (g) {
  var ADMIN_SESSION_KEY = 'armada_admin_session_v1';
  var DRIVER_SESSION_KEY = 'armada_driver_session_v1';
  var CUSTOMER_SESSION_KEY = 'armada_customer_session_v1';
  var ROLE_TOKEN_KEY = 'armada_api_role_token_v1';
  var OWNER_FLAG_KEY = 'armada_owner_driver_session_v1';

  function parseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = b64.length % 4;
      if (pad) b64 += '===='.slice(pad);
      return JSON.parse(atob(b64));
    } catch (_) {
      return null;
    }
  }

  function jwtExpiredOrSoon(token, skewSec) {
    var sk = skewSec == null ? 60 : Number(skewSec) || 0;
    var p = decodeJwtPayload(token);
    if (!p || p.exp == null) return false;
    var now = Math.floor(Date.now() / 1000);
    return now >= Number(p.exp) - sk;
  }

  function roleTokenUsable(getItem) {
    var t = getItem(ROLE_TOKEN_KEY) || '';
    return !!t && !jwtExpiredOrSoon(t);
  }

  function roleFromToken(getItem) {
    var t = getItem(ROLE_TOKEN_KEY) || '';
    if (!t || jwtExpiredOrSoon(t)) return '';
    var p = decodeJwtPayload(t);
    return p && String(p.role || '').trim() || '';
  }

  function isExactAppRootPath(pathname) {
    var p = String(pathname || '/').toLowerCase();
    if (p === '/' || p === '') return true;
    return p === '/index.html';
  }

  function hasStoredAppSession(getLS, getSS) {
    var cust = parseJson(getLS(CUSTOMER_SESSION_KEY));
    if (cust && cust.companyId) return true;

    try {
      if (getSS(OWNER_FLAG_KEY) === '1' && roleFromToken(getLS) === 'owner_driver' && roleTokenUsable(getLS)) {
        return true;
      }
    } catch (_) {}

    var admin = parseJson(getLS(ADMIN_SESSION_KEY));
    if (admin && (admin.id || admin.name)) {
      var role = roleFromToken(getLS);
      if (role && role !== 'owner_driver' && role !== 'driver' && roleTokenUsable(getLS)) return true;
      if (admin.name || admin.id) return true;
    }

    var drv = parseJson(getLS(DRIVER_SESSION_KEY));
    if (drv && drv.name) {
      var r = roleFromToken(getLS);
      if (r === 'owner_driver') return false;
      if (roleTokenUsable(getLS)) return true;
      if (drv.name) return true;
    }

    return false;
  }

  function shouldRedirectGuestToLanding(env) {
    var pathname = env && env.pathname != null ? env.pathname : '/';
    if (!isExactAppRootPath(pathname)) {
      return { redirect: false };
    }
    var getLS =
      env && env.getLocalStorageItem
        ? env.getLocalStorageItem
        : function () {
            return '';
          };
    var getSS =
      env && env.getSessionStorageItem
        ? env.getSessionStorageItem
        : function () {
            return '';
          };
    if (hasStoredAppSession(getLS, getSS)) {
      return { redirect: false };
    }
    var search = env && env.search != null ? String(env.search) : '';
    if (search && search.charAt(0) !== '?') search = '?' + search;
    return { redirect: true, href: publicLandingHref(search) };
  }

  function publicLandingHref(search) {
    var s = search != null ? String(search) : '';
    if (s && s.charAt(0) !== '?') s = '?' + s;
    return '/landing.html' + s;
  }

  function goPublicLanding() {
    if (typeof location === 'undefined') return false;
    try {
      location.replace(publicLandingHref(location.search || ''));
      return true;
    } catch (_) {
      try {
        location.href = '/landing.html';
        return true;
      } catch (_e) {
        return false;
      }
    }
  }

  /** После boot на /: сессия не восстановилась → landing (хаб ролей отключён). */
  function appRootBootFallbackAction(sessionRestored) {
    if (sessionRestored) return { action: 'none' };
    return { action: 'redirect', href: publicLandingHref('') };
  }

  function applyGuestLandingRedirect() {
    if (typeof location === 'undefined') return false;
    var env = {
      pathname: location.pathname,
      search: location.search || '',
      getLocalStorageItem: function (key) {
        try {
          return localStorage.getItem(key);
        } catch (_) {
          return '';
        }
      },
      getSessionStorageItem: function (key) {
        try {
          return sessionStorage.getItem(key);
        } catch (_) {
          return '';
        }
      },
    };
    var plan = shouldRedirectGuestToLanding(env);
    if (plan.redirect && plan.href) {
      location.replace(plan.href);
      return true;
    }
    return false;
  }

  g.armadaIsExactAppRootPath = isExactAppRootPath;
  g.armadaHasStoredAppSession = hasStoredAppSession;
  g.armadaShouldRedirectGuestToLanding = shouldRedirectGuestToLanding;
  g.armadaPublicLandingHref = publicLandingHref;
  g.armadaGoPublicLanding = goPublicLanding;
  g.armadaAppRootBootFallbackAction = appRootBootFallbackAction;
  g.armadaApplyGuestLandingRedirect = applyGuestLandingRedirect;

  if (typeof document !== 'undefined') {
    applyGuestLandingRedirect();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
