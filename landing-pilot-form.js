/* landing.html — заявка «Пилотный проект» → appendCustomerPortalLead (kind pilot, pilotProject) */
(function () {
  var BUILD = '2026-10-17-landing-pilot';

  function qs(id) {
    return document.getElementById(id);
  }

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
      document.head.appendChild(s);
    });
  }

  function ensureStore() {
    if (typeof appendCustomerPortalLead === 'function') return Promise.resolve();
    return loadScript('/store.js?v=' + encodeURIComponent(BUILD));
  }

  function showStatus(text, ok) {
    var statusEl = qs('landing-pilot-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'landing-pilot-status' + (ok ? ' is-ok' : ok === false ? ' is-err' : '');
    statusEl.hidden = !text;
  }

  function readForm() {
    return {
      kind: 'pilot',
      pilotProject: true,
      pilotRole: 'project',
      contactName: (qs('landing-pilot-name') && qs('landing-pilot-name').value) || '',
      phone: (qs('landing-pilot-phone') && qs('landing-pilot-phone').value) || '',
      company: (qs('landing-pilot-company') && qs('landing-pilot-company').value) || '',
      fleetSize: (qs('landing-pilot-fleet') && qs('landing-pilot-fleet').value) || '',
      workNeeds: (qs('landing-pilot-needs') && qs('landing-pilot-needs').value) || '',
      source: 'landing.html#pilot',
    };
  }

  function validate(data) {
    var name = String(data.contactName || '').trim();
    var company = String(data.company || '').trim();
    if (!name && !company) return 'Укажите имя или компанию';
    if (!data.phone || String(data.phone).replace(/\D/g, '').length < 10) return 'Укажите телефон для связи';
    if (!company) data.company = name;
    if (!name) data.contactName = company;
    return '';
  }

  async function submit(ev) {
    if (ev) ev.preventDefault();
    var data = readForm();
    var err = validate(data);
    if (err) {
      showStatus(err, false);
      return;
    }
    var btn = qs('landing-pilot-submit');
    if (btn) btn.disabled = true;
    showStatus('Отправляем заявку…', null);
    try {
      await ensureStore();
      if (typeof formatPhone === 'function') data.phone = formatPhone(data.phone);
      data.contactName = String(data.contactName).trim();
      data.company = String(data.company).trim();
      data.fleetSize = String(data.fleetSize).trim();
      data.workNeeds = String(data.workNeeds).trim();
      if (typeof appendCustomerPortalLead !== 'function') throw new Error('sync');
      var res = await appendCustomerPortalLead(data);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Не удалось сохранить');
      var form = qs('landing-pilot-form');
      if (form) form.reset();
      showStatus('Заявка принята. Свяжемся в рабочее время.', true);
    } catch (e) {
      console.warn('landing pilot lead', e);
      showStatus('Не удалось отправить. Напишите hello@armada.sx или позвоните +7 (965) 073-00-02', false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wire() {
    var form = qs('landing-pilot-form');
    if (form) form.addEventListener('submit', submit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
