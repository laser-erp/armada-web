/* Вход собственника-водителя (/o/) — отдельно от auth.js (логист) и driver.js (наёмный). */
const OWNER_SESSION_FLAG_KEY = 'armada_owner_driver_session_v1';

function ownerLoginPhoneEl() {
  return $('owner-login-phone');
}

function ownerLoginShowErr(msg) {
  const err = $('owner-login-error');
  if (err) err.textContent = msg || '';
}

function markOwnerDriverSession() {
  try {
    sessionStorage.setItem(OWNER_SESSION_FLAG_KEY, '1');
  } catch (_) {}
}

function clearOwnerDriverSessionFlag() {
  try {
    sessionStorage.removeItem(OWNER_SESSION_FLAG_KEY);
  } catch (_) {}
}

function isOwnerDriverApiSession() {
  return typeof armadaApiTokenRole === 'function' && armadaApiTokenRole() === 'owner_driver';
}

function openOwnerLogin() {
  if (typeof show === 'function') show('owner-login');
  ownerLoginShowErr('');
  const phone = ownerLoginPhoneEl();
  if (phone) phone.value = '';
  const pin = $('owner-login-pin');
  if (pin) pin.value = '';
  setTimeout(() => {
    if (phone && phone.focus) phone.focus();
  }, 50);
}

async function loginOwnerDriver() {
  ownerLoginShowErr('');
  const phone = formatPhone((ownerLoginPhoneEl() && ownerLoginPhoneEl().value) || '');
  const pin = String(($('owner-login-pin') && $('owner-login-pin').value) || '').trim();
  if (!phone) {
    ownerLoginShowErr('Введите телефон');
    return;
  }
  if (!pin || pin.length < 4) {
    ownerLoginShowErr('Введите PIN (от 4 цифр)');
    return;
  }
  if (navigator.onLine !== false && typeof armadaApiVerifyOwnerDriver === 'function' && API_BASE) {
    const verified = await armadaApiVerifyOwnerDriver(phone, pin);
    if (verified && verified.driver) {
      markOwnerDriverSession();
      if (typeof enterAsDriver === 'function') enterAsDriver({ ...verified.driver, accountKind: 'owner_driver' });
      return;
    }
    if (verified && verified.__verifyFail) {
      if (verified.error === 'wrong_pin' || verified.error === 'phone_not_found') {
        ownerLoginShowErr('Неверный телефон или PIN');
        return;
      }
      ownerLoginShowErr('Вход недоступен. Попробуйте позже.');
      return;
    }
  }
  const list = (typeof findDriversByPhone === 'function' ? findDriversByPhone(phone) : []).filter(
    (d) => String(d.accountKind || '') === 'owner_driver'
  );
  if (!list.length) {
    ownerLoginShowErr('Учётка частного перевозчика не найдена. Вход только через /o/ после регистрации.');
    return;
  }
  const matched = list.filter((d) => typeof resolveDriverPin === 'function' && resolveDriverPin(d) === pin);
  if (!matched.length) {
    ownerLoginShowErr('Неверный PIN');
    return;
  }
  if (matched.length > 1) {
    ownerLoginShowErr('Несколько профилей — обратитесь в поддержку');
    return;
  }
  markOwnerDriverSession();
  if (typeof enterAsDriver === 'function') enterAsDriver(matched[0]);
}

function restoreOwnerDriverSession() {
  if (!isOwnerDriverApiSession()) return false;
  try {
    if (sessionStorage.getItem(OWNER_SESSION_FLAG_KEY) !== '1') return false;
  } catch (_) {
    return false;
  }
  if (typeof applyOwnerDriverJwtToDriverSession === 'function') applyOwnerDriverJwtToDriverSession();
  const rec =
    typeof ownerDriverSessionRecord === 'function' ? ownerDriverSessionRecord() : null;
  if (!rec) {
    clearOwnerDriverSessionFlag();
    return false;
  }
  if (typeof enterAsDriver === 'function') {
    void enterAsDriver({ ...rec, accountKind: 'owner_driver' });
    return true;
  }
  clearOwnerDriverSessionFlag();
  return false;
}

/** Бандл /o/ грузит owner-auth.js вместо auth.js — те же имена, что ждёт app.js/driver.js. */
function isSuperAdmin() {
  return !!(currentAdmin && currentAdmin.isSuper);
}
function superAdminCabinetViewActive() {
  if (!isSuperAdmin()) return false;
  const f = (typeof state !== 'undefined' && state && state.adminOwnerFilter) || 'all';
  return f !== 'all' && f !== '_none';
}
function adminSuperUiActive() {
  return isSuperAdmin() && !superAdminCabinetViewActive();
}

function wireOwnerLoginHandlers() {
  const back = $('owner-login-back');
  if (back && typeof backFromEntryLogin === 'function') {
    back.onclick = () => backFromEntryLogin();
  }
  const ok = $('owner-login-ok');
  if (ok) ok.onclick = () => loginOwnerDriver();
  const pin = $('owner-login-pin');
  if (pin) {
    pin.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loginOwnerDriver();
      }
    };
  }
}
