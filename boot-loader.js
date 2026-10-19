/* АРМАДА — внешний загрузчик (CSP script-src 'self' без unsafe-inline) */
(function () {
  var APP_BUILD = (typeof globalThis !== 'undefined' && globalThis.ARMADA_APP_BUILD) || '2026-10-19-fix409';
  var OWNER_DRIVER_PREVIEW_KEY = 'armada_owner_driver_preview_v1';
  var OWNER_DRIVER_PREVIEW_PARAM = 'ownerDriverPreview';

  function armadaOwnerDriverPreviewFromUrl() {
    try {
      var q = new URLSearchParams(location.search || '');
      if (q.get(OWNER_DRIVER_PREVIEW_PARAM) === '1') sessionStorage.setItem(OWNER_DRIVER_PREVIEW_KEY, '1');
      if (q.get(OWNER_DRIVER_PREVIEW_PARAM) === '0') sessionStorage.removeItem(OWNER_DRIVER_PREVIEW_KEY);
    } catch (_) {}
  }

  function armadaOwnerDriverPreviewEnabled() {
    armadaOwnerDriverPreviewFromUrl();
    try {
      return sessionStorage.getItem(OWNER_DRIVER_PREVIEW_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  armadaOwnerDriverPreviewFromUrl();

  window.__armadaBootDone = false;

  function dedicatedScreenId() {
    var p = (location.pathname || '').toLowerCase();
    if (/\/(a)(\/|$)/.test(p)) return 'admin-pin';
    if (/\/(o)(\/|$)/.test(p)) return 'owner-login';
    if (/\/(v)(\/|$)/.test(p)) return 'driver-login';
    if (/\/(z)(\/|$)/.test(p)) return 'customer-login';
    return null;
  }

  function showScreenEarly(id) {
    if (!id) return;
    if (typeof window.__armadaApplyEntryRoute === 'function') {
      window.__armadaApplyEntryRoute();
      return;
    }
    var target = document.getElementById(id);
    if (!target) return;
    var root = document.getElementById('shell') || document.querySelector('.phone');
    var screens = root ? root.querySelectorAll('.screen') : document.querySelectorAll('.phone > .screen');
    screens.forEach(function (s) {
      s.classList.remove('show');
    });
    target.classList.add('show');
  }

  showScreenEarly(dedicatedScreenId());

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('load ' + src));
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function shellScripts() {
    var p = (location.pathname || '').toLowerCase();
    var isV = /\/(v)(\/|$)/.test(p);
    var isO = /\/(o)(\/|$)/.test(p);
    var isA = /\/(a)(\/|$)/.test(p);
    var isZ = /\/(z)(\/|$)/.test(p);
    var files = ['store.js', 'billing.js'];
    if (isO) {
      files.push('space-modules.js', 'qrcode.min.js', 'entry-share.js', 'print-window.js', 'order-documents.js', 'doc-templates.js', 'admin-cabinet-theme.js', 'epd-sign.js', 'etrn.js', 'onboarding.js', 'owner-auth.js', 'driver.js', 'owner-driver.js');
    } else if (isV) {
      files.push('space-modules.js', 'qrcode.min.js', 'entry-share.js', 'print-window.js', 'order-documents.js', 'doc-templates.js', 'epd-sign.js', 'etrn.js', 'onboarding.js', 'auth.js', 'driver.js', 'owner-driver.js');
    } else if (isA) {
      files.push('space-modules.js', 'qrcode.min.js', 'entry-share.js', 'print-window.js', 'order-documents.js', 'doc-templates.js', 'contracts.js', 'contracts-ui.js', 'sign-operator-letters.js', 'operator-letters.js', 'admin-profile.js', 'admin-cabinet-settings.js', 'admin-cabinet-theme.js', 'epd-sign.js', 'etrn.js', 'admin-entitlements.js', 'fleet-rates.js', 'fleet-rates-ui.js', 'auth.js', 'vehicle-catalog-ui.js', 'admin-day-timeline.js', 'admin-super-cabinet-picker.js', 'admin.js', 'admin-docs.js', 'admin-plans-scenarios.js', 'admin-plans.js', 'admin-runs.js', 'onboarding.js');
    }
    else if (isZ) files.push('qrcode.min.js', 'customer-invoice.js', 'order-documents.js', 'doc-templates.js', 'epd-sign.js', 'etrn.js', 'fleet-rates.js', 'fleet-rates-ui.js', 'auth.js', 'customer.js', 'onboarding.js');
    else {
      files.push(
        'qrcode.min.js',
        'customer-invoice.js',
        'entry-share.js',
        'print-window.js',
        'order-documents.js',
        'doc-templates.js',
        'sign-operator-letters.js',
        'operator-letters.js',
        'admin-profile.js',
        'admin-cabinet-settings.js',
        'epd-sign.js',
        'driver.js',
        'etrn.js',
        'fleet-rates.js',
        'fleet-rates-ui.js',
        'auth.js',
        'vehicle-catalog-ui.js',
        'admin-day-timeline.js',
        'admin-super-cabinet-picker.js',
        'admin.js',
        'admin-docs.js',
        'admin-plans-scenarios.js',
        'admin-plans.js',
        'admin-runs.js',
        'customer.js',
        'onboarding.js'
      );
    }
    files.push('vehicle-podbor.js', 'app.js');
    if (!globalThis.ARMADA_APP_BUILD) files.unshift('armada-build.js');
    injectThemesScript(files);
    return files;
  }

  function inviteScripts() {
    var inv = ['store.js', 'billing.js', 'vehicle-podbor.js', 'app.js', 'driver.js', 'invite.js'];
    if (!globalThis.ARMADA_APP_BUILD) inv.unshift('armada-build.js');
    injectThemesScript(inv);
    return inv;
  }

  function injectThemesScript(files) {
    if (files.indexOf('themes.js') >= 0) return;
    var abi = files.indexOf('armada-build.js');
    if (abi >= 0) files.splice(abi + 1, 0, 'themes.js');
    else files.unshift('themes.js');
  }

  function scriptBundle() {
    var tag = document.currentScript;
    var mode = tag && tag.getAttribute('data-mode');
    if (mode === 'invite') return inviteScripts();
    return shellScripts();
  }

  function finishBoot() {
    window.__armadaBootDone = true;
    var early = dedicatedScreenId();
    // app.js boot() уже вошёл водителем (restoreDriverSession → enterAsDriver) — не перекрывать экраном входа
    if (early === 'driver-login' && document.querySelector('#driver.show')) return;
    if (early === 'owner-login' && document.querySelector('#driver.show')) return;
    if (early) {
      showScreenEarly(early);
      if (early === 'admin-pin' && typeof wireAdminLoginHandlers === 'function') wireAdminLoginHandlers();
      if (early === 'owner-login' && typeof wireOwnerLoginHandlers === 'function') wireOwnerLoginHandlers();
      if (early === 'driver-login' && typeof wireDriverLoginHandlers === 'function') wireDriverLoginHandlers();
      if (early === 'admin-pin') {
        var loginBtn = document.getElementById('pin-ok');
        if (loginBtn) loginBtn.disabled = false;
      }
      if (early === 'admin-pin' && typeof canAutoRestoreAdmin === 'function' && canAutoRestoreAdmin()) {
        if (typeof show === 'function') show('admin');
        if (typeof renderAdmin === 'function') renderAdmin();
      } else if (early !== 'admin-pin' && typeof openDedicatedEntryScreen === 'function') {
        if (
          !(early === 'owner-login' && typeof restoreOwnerDriverSession === 'function' && restoreOwnerDriverSession()) &&
          !(early === 'driver-login' && typeof restoreDriverSession === 'function' && restoreDriverSession())
        ) {
          openDedicatedEntryScreen();
        }
      }
      return;
    }
    setTimeout(function () {
      var sp = document.getElementById('splash');
      if (!sp || !sp.classList.contains('show') || window.__armadaSplashDone) return;
      if (typeof finishSplashOnce === 'function' && typeof armadaGoPublicLanding === 'function') {
        finishSplashOnce(armadaGoPublicLanding);
      } else if (typeof globalThis.armadaGoPublicLanding === 'function') {
        globalThis.armadaGoPublicLanding();
      }
    }, 6000);
  }

  var chain = Promise.resolve();
  scriptBundle().forEach(function (f) {
    chain = chain.then(function () {
      return loadScript('/' + f + '?v=' + encodeURIComponent(APP_BUILD));
    });
  });
  chain.then(finishBoot).catch(function (err) {
    console.error('АРМАДА boot-loader', err);
    finishBoot();
  });
})();
