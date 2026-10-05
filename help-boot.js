/* АРМАДА — help.html: роль, навигация, видимость секций (CSP: без inline) */
(function () {
  var NAV = {
    carrier: [
      { href: '#start-carrier', label: 'С чего начать' },
      { href: '#admin', label: 'Логист' },
      { href: '#etrn', label: 'ЭТрН' },
      { href: '#driver', label: 'Водитель' },
      { href: '#sync', label: 'Синхронизация' },
      { href: '#faq-carrier', label: 'Вопросы' }
    ],
    admin: [
      { href: '#start-carrier', label: 'С чего начать' },
      { href: '#admin', label: 'Логист' },
      { href: '#etrn', label: 'ЭТрН' },
      { href: '#sync', label: 'Синхронизация' },
      { href: '#faq-carrier', label: 'Вопросы' }
    ],
    driver: [
      { href: '#start-carrier', label: 'С чего начать' },
      { href: '#driver', label: 'Водитель' },
      { href: '#etrn', label: 'ЭТрН' },
      { href: '#faq-carrier', label: 'Вопросы' }
    ],
    customer: [
      { href: '#start-customer', label: 'С чего начать' },
      { href: '#customer', label: 'Портал заказчика' },
      { href: '#etrn', label: 'ЭТрН' },
      { href: '#faq-customer', label: 'Вопросы' }
    ]
  };
  var TITLES = {
    carrier: ['Помощь перевозчику', 'Логист, диспетчер и водитель'],
    admin: ['Помощь логисту', 'Администратор перевозчика'],
    driver: ['Помощь водителю', 'Смены, заявки, ЕТО'],
    customer: ['Помощь заказчику', 'Портал заявок на перевозку']
  };
  var BACK = {
    carrier: '/a/',
    admin: '/a/',
    driver: '/v/',
    customer: '/z/'
  };

  function parseRole() {
    var q = new URLSearchParams(location.search);
    var role = (q.get('role') || '').trim().toLowerCase();
    if (role === 'перевозчик') role = 'carrier';
    if (role === 'заказчик') role = 'customer';
    if (role === 'водитель') role = 'driver';
    if (role === 'админ' || role === 'логист') role = 'admin';
    if (!role && location.hash) {
      var h = location.hash.replace(/^#/, '').toLowerCase();
      if (h === 'customer') role = 'customer';
      else if (h === 'driver') role = 'driver';
      else if (h === 'admin') role = 'admin';
      else if (h === 'start') role = 'carrier';
    }
    if (role && !NAV[role]) role = '';
    return role;
  }

  function sectionMatches(el, role) {
    var roles = (el.getAttribute('data-help-role') || '').split(/\s+/);
    if (role === 'carrier') return roles.indexOf('carrier') >= 0 || roles.indexOf('admin') >= 0 || roles.indexOf('driver') >= 0;
    return roles.indexOf(role) >= 0;
  }

  function renderNav(role) {
    var nav = document.getElementById('help-nav');
    var items = NAV[role] || [];
    nav.innerHTML = items.map(function (it) {
      return '<a href="' + it.href + '">' + it.label + '</a>';
    }).join('');
    nav.classList.remove('help-hidden');
  }

  function applyRole(role) {
    var picker = document.getElementById('help-role-picker');
    var title = document.getElementById('help-title');
    var lead = document.getElementById('help-lead');
    var back = document.getElementById('help-back');
    var sw = document.getElementById('help-role-switch');

    if (!role) {
      document.title = 'АРМАДА — помощь';
      picker.classList.remove('help-hidden');
      return;
    }

    picker.classList.add('help-hidden');
    var meta = TITLES[role] || TITLES.carrier;
    title.textContent = meta[0];
    lead.textContent = meta[1];
    document.title = 'АРМАДА — ' + meta[0];
    if (BACK[role]) {
      back.href = BACK[role];
      back.textContent = '← Назад в сервис';
    }

    sw.innerHTML = 'Другая роль: <a href="help.html?role=carrier">перевозчик</a> · <a href="help.html?role=customer">заказчик</a> · <a href="help.html">все роли</a>';
    sw.classList.remove('help-hidden');

    document.querySelectorAll('[data-help-role]').forEach(function (el) {
      el.classList.toggle('help-hidden', !sectionMatches(el, role));
    });

    renderNav(role);

    var hash = location.hash;
    if (hash) {
      var target = document.querySelector(hash);
      if (target && !target.classList.contains('help-hidden')) {
        setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
      }
    }
  }

  applyRole(parseRole());
})();
