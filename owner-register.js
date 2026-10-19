/* owner-register.html — самостоятельная регистрация собственника-водителя */
(function () {
  var API_BASE = '';
  try {
    API_BASE = String(window.ARMADA_API_BASE || '').replace(/\/$/, '');
  } catch (_) {}
  if (!API_BASE) {
    var host = location.hostname || '';
    if (host.indexOf('staging.') === 0) API_BASE = location.origin + '/armada-api';
    else if (host === 'app.armada.sx' || host === 'localhost') API_BASE = location.origin + '/armada-api';
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function showStatus(text, ok) {
    var el = qs('owner-reg-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'landing-lead-status' + (ok ? ' is-ok' : ok === false ? ' is-err' : '');
    el.hidden = !text;
  }

  function saveToken(token) {
    try {
      sessionStorage.setItem('armada_api_role_token_v1', token);
      sessionStorage.setItem('armada_owner_driver_session_v1', '1');
    } catch (_) {}
  }

  async function submit(ev) {
    if (ev) ev.preventDefault();
    if (!API_BASE) {
      showStatus('API недоступен. Попробуйте позже или обратитесь в поддержку.', false);
      return;
    }
    var body = {
      name: (qs('owner-reg-name') && qs('owner-reg-name').value || '').trim(),
      phone: (qs('owner-reg-phone') && qs('owner-reg-phone').value || '').trim(),
      pin: (qs('owner-reg-pin') && qs('owner-reg-pin').value || '').trim(),
      firmName: (qs('owner-reg-firm') && qs('owner-reg-firm').value || '').trim(),
      inn: (qs('owner-reg-inn') && qs('owner-reg-inn').value || '').trim(),
      plate: (qs('owner-reg-plate') && qs('owner-reg-plate').value || '').trim(),
    };
    if (!body.name || !body.phone || body.pin.length < 4 || !body.plate) {
      showStatus('Заполните ФИО, телефон, PIN и госномер', false);
      return;
    }
    var btn = qs('owner-reg-submit');
    if (btn) btn.disabled = true;
    showStatus('Создаём кабинет…', null);
    try {
      var res = await fetch(API_BASE + '/auth/register-owner-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 429) {
        showStatus('Слишком много попыток с этого адреса. Подождите 15 минут.', false);
        if (btn) btn.disabled = false;
        return;
      }
      if (!res.ok) {
        if (res.status === 409) showStatus('Этот телефон уже зарегистрирован. Войдите через /o/', false);
        else showStatus(data.message || 'Не удалось зарегистрироваться', false);
        if (btn) btn.disabled = false;
        return;
      }
      if (data.token) saveToken(data.token);
      var form = qs('owner-reg-form');
      var okBox = qs('owner-reg-success');
      if (form) form.hidden = true;
      if (okBox) okBox.hidden = false;
      showStatus('', null);
      setTimeout(function () {
        location.href = '/o/';
      }, 800);
    } catch (err) {
      showStatus('Ошибка сети', false);
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = qs('owner-reg-form');
    if (form) form.addEventListener('submit', submit);
  });
})();
