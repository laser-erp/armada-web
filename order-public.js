/* order.html — публичная заявка с armada.sx (CSP: без inline) */
(function () {
  var BUILD = (typeof globalThis !== 'undefined' && globalThis.ARMADA_APP_BUILD) || '2026-10-05-pr158-f1';
  var OFFLINE_MSG = 'Нет связи с сервером. Заявка не отправлена — проверьте интернет и нажмите «Отправить заявку» ещё раз.';
  var form = null;
  var statusEl = null;
  var selectedVtype = '';
  var VTYP_LABELS = {
    shalanda: 'Шаланда',
    manipulator: 'Манипулятор',
    tent: 'Тентованный',
    dump: 'Самосвал',
    tral: 'Трал',
    board: 'Бортовой',
    ref: 'Рефрижератор',
    isotherm: 'Изотерм',
    van: 'Фургон',
    lowbed: 'Низкорамник',
    autocistern: 'Автоцистерна',
    timber: 'Лесовоз',
    container: 'Контейнеровоз'
  };
  var DECK_HEIGHT = { shalanda: 1.15, manipulator: 0.55, tent: 1.15, dump: 1.2, tral: 0.85, board: 0.9 };
  var ROAD_HEIGHT_LIMIT = 3.95;

  function qs(id) {
    return document.getElementById(id);
  }

  function readQuery() {
    var q = new URLSearchParams(location.search || '');
    return {
      vtype: (q.get('vtype') || q.get('type') || '').trim().toLowerCase(),
      source: (q.get('source') || 'armada.sx').trim() || 'armada.sx'
    };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  /** store.js грузится только при отправке заявки (ensureStoreForSubmit), не при открытии страницы. */
  function ensureStoreForSubmit() {
    if (typeof appendCustomerPortalLead === 'function') return Promise.resolve();
    window.ARMADA_PUBLIC_ORDER_STANDALONE = true;
    return loadScript('/store.js?v=' + encodeURIComponent(BUILD));
  }

  function deckHeightM(vtypeId) {
    var id = String(vtypeId || '').trim();
    if (id && DECK_HEIGHT[id] > 0) return DECK_HEIGHT[id];
    return 1;
  }

  function cargoRoadHeightViolation(vtypeId, cargoHeightM) {
    var cargo = +cargoHeightM;
    if (!(cargo > 0)) return null;
    var deck = deckHeightM(vtypeId);
    var sum = Math.round((deck + cargo) * 100) / 100;
    if (sum <= ROAD_HEIGHT_LIMIT) return null;
    return { deck: deck, cargo: cargo, sum: sum, limit: 4 };
  }

  function heightRoadWarningText(v) {
    if (!v) return '';
    var d = String(v.deck).replace('.', ',');
    var c = String(v.cargo).replace('.', ',');
    var s = String(v.sum).replace('.', ',');
    return 'Пол кузова ' + d + ' м + высота груза ' + c + ' м = ' + s + ' м. По приложению № 1 к Правилам перевозок грузов (постановление Правительства РФ № 2200 от 21.12.2020) допустимая высота транспортного средства с грузом — не более 4 м от поверхности дороги.\n\nВам требуется негабаритная перевозка (разрешение и маршрут). Выберите другой тип ТС, если изменение высоты груза не допустимо.';
  }

  function showStatus(text, ok) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'landing-lead-status' + (ok ? ' is-ok' : ok === false ? ' is-err' : '');
    statusEl.hidden = !text;
  }

  function vtypeLabel(id) {
    if (!id) return '';
    if (VTYP_LABELS[id]) return VTYP_LABELS[id];
    if (typeof custVehicleTypeLabel === 'function') {
      var lbl = custVehicleTypeLabel(id);
      if (lbl && lbl !== id) return lbl;
    }
    if (typeof ARMADA_SX_ORDER_VTYPES !== 'undefined') {
      var hit = ARMADA_SX_ORDER_VTYPES.find(function (x) { return x.id === id; });
      if (hit && hit.label) return hit.label;
    }
    return VTYP_LABELS[id] || id;
  }

  function featuredVtypes() {
    if (typeof ARMADA_SX_ORDER_VTYPES !== 'undefined' && ARMADA_SX_ORDER_VTYPES.length) {
      return ARMADA_SX_ORDER_VTYPES.slice();
    }
    return [
      { id: 'shalanda', label: 'Шаланда' },
      { id: 'manipulator', label: 'Манипулятор' },
      { id: 'tent', label: 'Тентованный' },
      { id: 'dump', label: 'Самосвал' },
      { id: 'tral', label: 'Трал' },
      { id: 'board', label: 'Бортовой' }
    ];
  }

  function normalizeVtype(raw) {
    var id = String(raw || '').trim().toLowerCase();
    if (!id) return '';
    if (typeof normalizeArmadaSxVtype === 'function') return normalizeArmadaSxVtype(id) || id;
    return featuredVtypes().some(function (x) { return x.id === id; }) ? id : '';
  }

  function syncOrderHeroTitle() {
    var title = qs('order-title');
    var badge = qs('order-badge');
    if (selectedVtype && selectedVtype !== 'other') {
      var lbl = vtypeLabel(selectedVtype);
      if (title) title.textContent = 'Заказать: ' + lbl;
      if (badge) badge.textContent = lbl;
    } else {
      if (title) title.textContent = 'Заказать транспорт';
      if (badge) badge.textContent = 'Заявка на транспорт';
    }
  }

  function paintVtypes(preselect) {
    var grid = qs('order-vtype-grid');
    if (!grid) return;
    var items = featuredVtypes().concat([{ id: 'other', label: 'Другое' }]);
    grid.innerHTML = items.map(function (t) {
      var checked = preselect === t.id ? ' checked' : '';
      var label = t.id === 'other' ? t.label : vtypeLabel(t.id);
      return '<label class="landing-order-vtype">' +
        '<input type="radio" name="vtype" value="' + t.id + '"' + checked + ' />' +
        '<span>' + label + '</span></label>';
    }).join('');
    grid.querySelectorAll('input[name="vtype"]').forEach(function (inp) {
      inp.addEventListener('change', onVtypeChange);
    });
    selectedVtype = preselect || '';
    if (!selectedVtype) {
      var first = grid.querySelector('input[name="vtype"]');
      if (first) { first.checked = true; selectedVtype = first.value; }
    }
    onVtypeChange();
  }

  function onVtypeChange() {
    var picked = document.querySelector('input[name="vtype"]:checked');
    selectedVtype = picked ? picked.value : '';
    syncOrderHeroTitle();
    var unloadWrap = qs('order-unload-wrap');
    var addrLabel = qs('order-address-label');
    var rental = isRentalOnlyVtype();
    if (unloadWrap) unloadWrap.hidden = rental;
    if (addrLabel) {
      var cap = addrLabel.querySelector('.field-label');
      if (cap) {
        cap.innerHTML = (rental ? 'Адрес подачи ' : 'Адрес загрузки ') + '<span class="req">*</span>';
      }
    }
    var wLabel = qs('order-weight-label');
    var wReq = qs('order-weight-req');
    if (wLabel) wLabel.hidden = rental;
    if (wReq) wReq.hidden = rental;
    refreshHeightLawWarn();
  }

  function parseDimInput(id) {
    var raw = (qs(id) && qs(id).value || '').trim().replace(',', '.');
    if (!raw) return null;
    var n = parseFloat(raw);
    return n > 0 ? n : null;
  }

  function refreshHeightLawWarn() {
    var box = qs('order-height-law-warn');
    if (!box) return;
    var h = parseDimInput('order-cargo-h');
    if (!h) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    var vtype = selectedVtype && selectedVtype !== 'other' ? selectedVtype : '';
    var v = cargoRoadHeightViolation(vtype, h);
    if (!v) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.textContent = heightRoadWarningText(v);
    box.hidden = !box.textContent;
  }

  function applyPageMeta(params) {
    var portal = qs('order-portal-link');
    if (portal) {
      var q = new URLSearchParams();
      if (params.vtype) q.set('vtype', params.vtype);
      if (params.source) q.set('source', params.source);
      var qsStr = q.toString();
      portal.href = '/z/' + (qsStr ? '?' + qsStr : '');
    }
    document.title = params.vtype && params.vtype !== 'other'
      ? 'Заказать ' + vtypeLabel(normalizeVtype(params.vtype)) + ' — ООО «Армада»'
      : 'Заказать транспорт — ООО «Армада» · app.armada.sx';
  }

  function readVehicleAt() {
    var d = (qs('order-date') && qs('order-date').value || '').trim();
    var t = (qs('order-time') && qs('order-time').value || '').trim();
    if (!d) return '';
    return t ? d + 'T' + t : d;
  }

  function readForm(params) {
    var cargoKg = parseInt((qs('order-cargo-weight') && qs('order-cargo-weight').value || '').replace(/\D/g, ''), 10);
    return {
      kind: 'transport',
      company: (qs('order-company') && qs('order-company').value || '').trim(),
      phone: (qs('order-phone') && qs('order-phone').value || '').trim(),
      contactName: (qs('order-name') && qs('order-name').value || '').trim(),
      loadAddress: (qs('order-address') && qs('order-address').value || '').trim(),
      unloadAddress: (qs('order-unload') && qs('order-unload').value || '').trim(),
      vehicleAt: readVehicleAt(),
      comment: (qs('order-comment') && qs('order-comment').value || '').trim(),
      vehicleTypeId: selectedVtype === 'other' ? '' : selectedVtype,
      vtype: selectedVtype === 'other' ? '' : selectedVtype,
      cargoWeightKg: cargoKg > 0 ? cargoKg : null,
      reqLengthM: parseDimInput('order-cargo-l'),
      reqWidthM: parseDimInput('order-cargo-w'),
      reqHeightM: parseDimInput('order-cargo-h'),
      source: params.source,
      carrierHint: 'ООО «Армада»'
    };
  }

  function isRentalOnlyVtype() {
    return selectedVtype === 'shalanda' || selectedVtype === 'manipulator';
  }

  function normalizePhoneDigits(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = d.slice(1);
    return d.length === 10 ? d : '';
  }

  function publicOrderUserError(err) {
    var raw = (err && err.message) ? String(err.message) : String(err || '');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE_MSG;
    if (/load \/store|appendCustomerPortalLead|initCloudSync|Не удалось загрузить|Failed to fetch|NetworkError|network|ERR_|Нет связи с сервером|не сохранена/i.test(raw)) {
      return OFFLINE_MSG;
    }
    if (/Не удалось сохранить на сервер/i.test(raw)) return OFFLINE_MSG;
    if (typeof armadaUserFacingError === 'function') {
      var ru = armadaUserFacingError(raw);
      if (ru) return ru;
    }
    return 'Не удалось отправить заявку. Проверьте интернет и нажмите «Отправить заявку» ещё раз.';
  }

  function markFieldError(id, msg) {
    var el = qs(id);
    if (!el) return;
    el.setCustomValidity(msg || 'Заполните поле');
    el.classList.add('order-field-invalid');
  }

  function clearFieldErrors() {
    if (!form) return;
    form.querySelectorAll('.order-field-invalid').forEach(function (el) {
      el.classList.remove('order-field-invalid');
      el.setCustomValidity('');
    });
  }

  function wireOrderFieldMessages() {
    if (!form) return;
    var fieldIds = [
      'order-company', 'order-phone', 'order-name', 'order-address', 'order-unload',
      'order-date', 'order-time', 'order-cargo-weight', 'order-comment'
    ];
    fieldIds.forEach(function (id) {
      var el = qs(id);
      if (!el) return;
      el.addEventListener('input', function () {
        el.setCustomValidity('');
        el.classList.remove('order-field-invalid');
      });
    });
    var phoneEl = qs('order-phone');
    if (phoneEl) {
      phoneEl.addEventListener('blur', function () {
        var v = (phoneEl.value || '').trim();
        if (!v) return;
        if (!normalizePhoneDigits(v)) {
          markFieldError('order-phone', 'Укажите телефон: 10 цифр, например +7 965 073-00-02');
          showStatus('Укажите телефон: 10 цифр, например +7 965 073-00-02', false);
        }
      });
    }
    var agree = qs('order-legal-agree');
    if (agree) {
      agree.addEventListener('change', function () { agree.setCustomValidity(''); });
    }
  }

  function orderVehicleAtIso(data) {
    var d = (qs('order-date') && qs('order-date').value || '').trim();
    var t = (qs('order-time') && qs('order-time').value || '').trim();
    if (!d || !t) return null;
    return d + 'T' + t + ':00';
  }

  function orderVehicleAtPastError() {
    var iso = orderVehicleAtIso();
    if (!iso) return '';
    if (typeof validateVehicleAtNotPast === 'function') {
      var chk = validateVehicleAtNotPast(iso);
      return chk.ok ? '' : chk.msg;
    }
    var dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return 'Некорректные дата или время подачи';
    if (dt.getTime() < Date.now() - 60000) return 'Дата и время подачи не могут быть в прошлом';
    return '';
  }

  function orderCargoWeightError() {
    if (isRentalOnlyVtype()) return '';
    var raw = String((qs('order-cargo-weight') && qs('order-cargo-weight').value) || '').trim();
    if (!raw) return 'Укажите вес груза (кг)';
    if (/[^\d,.\s-]/.test(raw)) return 'Вес груза: укажите число, не буквы';
    var n = +raw.replace(',', '.');
    if (Number.isNaN(n)) return 'Вес груза: укажите число';
    if (n === 0) return 'Вес груза не может быть 0';
    if (n < 0) return 'Вес груза не может быть отрицательным';
    if (!(n > 0)) return 'Укажите вес груза (кг)';
    return '';
  }

  function validate(data) {
    clearFieldErrors();
    var errors = [];
    function add(id, msg) {
      errors.push(msg);
      markFieldError(id, msg);
    }
    if (!selectedVtype) errors.push('Выберите тип транспорта');
    if (!data.company) add('order-company', 'Укажите компанию или ФИО');
    if (!normalizePhoneDigits(data.phone)) add('order-phone', 'Укажите телефон: 10 цифр, например +7 965 073-00-02');
    if (!data.contactName) add('order-name', 'Укажите контактное лицо');
    if (!data.loadAddress) add('order-address', isRentalOnlyVtype() ? 'Укажите адрес подачи' : 'Укажите адрес загрузки');
    if (!isRentalOnlyVtype() && !data.unloadAddress) add('order-unload', 'Укажите адрес выгрузки');
    var d = (qs('order-date') && qs('order-date').value || '').trim();
    var t = (qs('order-time') && qs('order-time').value || '').trim();
    if (!d) add('order-date', 'Укажите дату подачи');
    if (!t) add('order-time', 'Укажите время подачи (выберите из списка)');
    var pastErr = orderVehicleAtPastError();
    if (pastErr) {
      if (d) markFieldError('order-date', pastErr);
      if (t) markFieldError('order-time', pastErr);
      errors.push(pastErr);
    }
    if (!data.comment) add('order-comment', 'Опишите груз или особенности (комментарий)');
    var weightErr = orderCargoWeightError();
    if (weightErr) add('order-cargo-weight', weightErr);
    var agree = qs('order-legal-agree');
    if (!agree || !agree.checked) errors.push('Подтвердите условия заявки на транспорт (галочка ниже)');
    if (errors.length) {
      showStatus(errors.join(' · '), false);
      var firstBad = form && form.querySelector('.order-field-invalid');
      if (firstBad && firstBad.focus) firstBad.focus();
      return errors[0];
    }
    return '';
  }

  function resetForm() {
    if (form) {
      form.hidden = false;
      form.reset();
    }
    clearFieldErrors();
    var okBox = qs('order-success');
    if (okBox) okBox.hidden = true;
    showStatus('', null);
    var params = readQuery();
    paintVtypes(normalizeVtype(params.vtype));
  }

  async function submitOrder(ev) {
    if (ev) ev.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showStatus(OFFLINE_MSG, false);
      return;
    }
    var params = readQuery();
    var data = readForm(params);
    var err = validate(data);
    if (err) return;
    var btn = qs('order-submit');
    if (btn) btn.disabled = true;
    showStatus('Отправляем заявку…', null);
    try {
      await ensureStoreForSubmit();
      if (typeof appendCustomerPortalLead !== 'function') throw new Error('Не удалось загрузить модуль заявки');
      var res = await appendCustomerPortalLead(data, { rollbackOnPersistFail: true });
      if (!res || !res.ok) {
        throw new Error((res && res.error) || OFFLINE_MSG);
      }
      if (res.duplicate && !res.orderId) {
        throw new Error('Похожая заявка уже отправлена — дождитесь звонка диспетчера или позвоните нам');
      }
      if (!res.duplicate && !res.orderId) {
        throw new Error('Заявка не попала в диспетчерскую (нет ООО «Армада» в базе)');
      }
      if (form) form.hidden = true;
      var okBox = qs('order-success');
      if (okBox) {
        okBox.hidden = false;
        var lead = okBox.querySelector('[data-order-num]');
        if (lead) {
          lead.textContent = res.orderNumber
            ? ('Заявка принята. Номер заявки №' + res.orderNumber + '. Диспетчер ООО «Армада» свяжется с вами в рабочее время.')
            : 'Заявка принята. Диспетчер ООО «Армада» свяжется с вами в рабочее время.';
          lead.hidden = false;
        }
      }
      showStatus('', null);
    } catch (e) {
      console.warn('public transport order', e);
      showStatus(publicOrderUserError(e), false);
      var okBox = qs('order-success');
      if (okBox) okBox.hidden = true;
      if (form) form.hidden = false;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wire() {
    form = qs('order-form');
    statusEl = qs('order-status');
    var params = readQuery();
    applyPageMeta(params);
    paintVtypes(normalizeVtype(params.vtype));
    syncOrderHeroTitle();
    if (form) form.addEventListener('submit', submitOrder);
    wireOrderFieldMessages();
    ['order-cargo-h', 'order-cargo-weight'].forEach(function (id) {
      var el = qs(id);
      if (el) el.addEventListener('input', refreshHeightLawWarn);
    });
    var again = qs('order-again');
    if (again) again.addEventListener('click', resetForm);
    var dateEl = qs('order-date');
    var timeEl = qs('order-time');
    if (dateEl && !dateEl.value) {
      var now = new Date();
      dateEl.min = now.toISOString().slice(0, 10);
    }
    if (timeEl && !timeEl.min) timeEl.min = '00:00';
    if (dateEl) {
      dateEl.addEventListener('change', function () {
        var now = new Date();
        var today = now.toISOString().slice(0, 10);
        if (dateEl.value === today && timeEl) {
          var hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
          timeEl.min = hm;
        } else if (timeEl) {
          timeEl.min = '00:00';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
