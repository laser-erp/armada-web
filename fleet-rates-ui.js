/* UI: тарифы и график в карточке ТС, политики компании, котировки заказчика */
(function (g) {
  const FR = g.armadaFleetRates;
  if (!FR) return;

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s || '');
  }

  function ratesTabHtml(v) {
    const r = FR.normalizeVehicleRates(v);
    const outsideOpts = FR.OUTSIDE_KAD_TYPES
      .map((t) => `<option value="${esc(t)}" ${r.city.outsideKadPolicy.type === t ? 'selected' : ''}>${esc(t)}</option>`)
      .join('');
    const shiftRows = (block, prefix) =>
      (block.shiftOptions || [])
        .map(
          (row) =>
            `<tr><td>${esc(row.code)}</td><td><input data-shift-block="${prefix}" data-shift-code="${esc(row.code)}" class="vc-rate-shift" inputmode="numeric" value="${row.shift != null ? row.shift : ''}" /></td></tr>`
        )
        .join('');
    const shiftsCity = shiftRows(r.city, 'city');
    const shiftsSpec = shiftRows(r.special, 'special');
    return `
    <section class="form-section vc-panel-rates" data-vc-panel="rates" hidden>
      <h2 class="form-section-title">Тарифы</h2>
      <p class="form-section-hint">Город, межгород и спецтехника. ◎ — эталон из справочника. Ручная правка → correctedByOwner.</p>
      <div class="fin-grid">
        <label>Город ₽/ч <span class="catalog-ref-mark">◎</span><input id="vr-city-hourly" inputmode="decimal" value="${r.city.hourlyRate ?? ''}" /></label>
        <label>км/ч подачи <span class="catalog-ref-mark">◎</span><input id="vr-city-kmph" inputmode="decimal" value="${r.city.kmPerDeliveryHour ?? ''}" /></label>
        <label>Включено км <span class="catalog-ref-mark">◎</span><input id="vr-city-inckm" inputmode="decimal" value="${r.city.includedKm ?? ''}" /></label>
        <label>₽/км сверх <span class="catalog-ref-mark">◎</span><input id="vr-city-extrakm" inputmode="decimal" value="${r.city.extraKmRate ?? ''}" /></label>
        <label class="svc-full">За КАД <select id="vr-city-outside">${outsideOpts}</select></label>
        <label>Межгород ₽/км <span class="catalog-ref-mark">◎</span><input id="vr-ic-perkm" inputmode="decimal" value="${r.intercity.perKm ?? ''}" /></label>
        <label>Межгород длинн. <span class="catalog-ref-mark">◎</span><input id="vr-ic-perkml" inputmode="decimal" value="${r.intercity.perKmLong ?? ''}" /></label>
        <label>Минимум межгород <span class="catalog-ref-mark">◎</span><input id="vr-ic-min" inputmode="decimal" value="${r.intercity.minimum ?? ''}" /></label>
        <label>Спец ₽/ч <span class="catalog-ref-mark">◎</span><input id="vr-sp-hourly" inputmode="decimal" value="${r.special.hourlyRate ?? ''}" /></label>
        <label class="svc-full">Примечание спец<input id="vr-sp-note" value="${esc(r.special.deliveryNote || '')}" /></label>
        <p class="hint svc-full">Смены (город)</p>
        <table class="svc-full" style="width:100%;font-size:.8rem"><thead><tr><th>Смена</th><th>₽</th></tr></thead><tbody>${shiftsCity}</tbody></table>
        <p class="hint svc-full">Смены (спецтехника)</p>
        <table class="svc-full" style="width:100%;font-size:.8rem"><thead><tr><th>Смена</th><th>₽</th></tr></thead><tbody>${shiftsSpec}</tbody></table>
        <label>minSurcharge<input id="vr-min-sur" inputmode="numeric" value="${r.minSurcharge ?? ''}" /></label>
        <button type="button" class="secondary" id="vr-reset-market" style="width:auto">Сбросить к эталону marketRates</button>
        <button type="button" class="primary cat-add-btn fin-full" id="vr-save">Сохранить тарифы</button>
      </div>
    </section>`;
  }

  function scheduleTabHtml(v) {
    const s = v.schedule || FR.defaultSchedule();
    const tpl = s.template || {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayRows = days
      .map((d) => {
        const row = tpl[d];
        const off = !row;
        return `<label>${d}<input data-sched-day="${d}-start" value="${row ? row.start : ''}" placeholder="08:00" style="width:4.5rem" ${off ? 'disabled' : ''}/> — <input data-sched-day="${d}-end" value="${row ? row.end : ''}" placeholder="20:00" style="width:4.5rem" ${off ? 'disabled' : ''}/></label>`;
      })
      .join('');
    const ex = (s.exceptions || [])
      .map(
        (e, i) =>
          `<div class="hint">${esc(e.date)} · ${esc(e.type)} — ${esc(e.reason || '')} <button type="button" data-del-ex="${i}" class="icon-btn danger">×</button></div>`
      )
      .join('');
    return `
    <section class="form-section vc-panel-schedule" data-vc-panel="schedule" hidden>
      <h2 class="form-section-title">График работы</h2>
      <div class="fin-grid">${dayRows}</div>
      <h3 style="font-size:.85rem;margin:8px 0 4px">Исключения</h3>
      <div id="vr-ex-list">${ex || '<div class="hint">Нет исключений</div>'}</div>
      <button type="button" class="secondary" id="vr-sched-save" style="width:auto;margin-top:8px">Сохранить график</button>
      <button type="button" class="secondary" id="vr-sched-apply" style="width:auto;margin-top:8px">Применить к другим машинам фирмы</button>
    </section>`;
  }

  function wireVehicleCard(v, root) {
    if (!root || !v) return;
    const tabBar = document.createElement('div');
    tabBar.className = 'vc-tab-bar row';
    tabBar.style.gap = '6px';
    tabBar.innerHTML = `
      <button type="button" class="secondary on" data-vc-tab="main" style="width:auto;padding:6px 10px">Основное</button>
      <button type="button" class="secondary" data-vc-tab="rates" style="width:auto;padding:6px 10px">Тарифы</button>
      <button type="button" class="secondary" data-vc-tab="schedule" style="width:auto;padding:6px 10px">График</button>`;
    root.insertBefore(tabBar, root.firstChild);
    root.insertAdjacentHTML('beforeend', ratesTabHtml(v) + scheduleTabHtml(v));

    const panels = {
      main: () => root.querySelectorAll('.form-section:not([data-vc-panel])'),
      rates: () => [root.querySelector('[data-vc-panel="rates"]')],
      schedule: () => [root.querySelector('[data-vc-panel="schedule"]')],
    };
    function showTab(name) {
      tabBar.querySelectorAll('[data-vc-tab]').forEach((b) => b.classList.toggle('on', b.dataset.vcTab === name));
      root.querySelectorAll('[data-vc-panel]').forEach((p) => {
        p.hidden = p.dataset.vcPanel !== name;
      });
      panels.main().forEach((el) => {
        if (el && el.dataset && el.dataset.vcPanel) return;
        if (el) el.hidden = name !== 'main';
      });
    }
    tabBar.querySelectorAll('[data-vc-tab]').forEach((b) => {
      b.onclick = () => showTab(b.dataset.vcTab);
    });
    showTab('main');

    const num = (id) => {
      const n = +String((root.querySelector(id) || {}).value || '').replace(',', '.');
      return n > 0 && !Number.isNaN(n) ? n : null;
    };
    root.querySelector('#vr-save') &&
      (root.querySelector('#vr-save').onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        FR.normalizeVehicleFleetMeta(veh);
        const r = veh.rates;
        r.city.hourlyRate = num('#vr-city-hourly');
        r.city.kmPerDeliveryHour = num('#vr-city-kmph');
        r.city.includedKm = num('#vr-city-inckm');
        r.city.extraKmRate = num('#vr-city-extrakm');
        r.city.outsideKadPolicy.type = (root.querySelector('#vr-city-outside') || {}).value || null;
        r.intercity.perKm = num('#vr-ic-perkm');
        r.intercity.perKmLong = num('#vr-ic-perkml');
        r.intercity.minimum = num('#vr-ic-min');
        r.special.hourlyRate = num('#vr-sp-hourly');
        r.special.deliveryNote = String((root.querySelector('#vr-sp-note') || {}).value || '').trim() || null;
        root.querySelectorAll('.vc-rate-shift').forEach((inp) => {
          const code = inp.dataset.shiftCode;
          const blockKey = inp.dataset.shiftBlock === 'special' ? 'special' : 'city';
          const row = (r[blockKey].shiftOptions || []).find((x) => x.code === code);
          const val = +String(inp.value || '').replace(',', '.');
          if (row) row.shift = val > 0 && !Number.isNaN(val) ? val : null;
        });
        r.minSurcharge = num('#vr-min-sur') || 3000;
        r.correctedByOwner = true;
        bumpDataEpoch('veh-rates');
        persist();
        if (typeof flashCatOk === 'function') flashCatOk('Тарифы сохранены');
        openVehicleCard(v.id);
      });

    root.querySelector('#vr-reset-market') &&
      (root.querySelector('#vr-reset-market').onclick = () => {
        const cats = (typeof state !== 'undefined' && state.catalogs) || [];
        const mr = cats.filter((c) => c && c.type === 'marketRates');
        if (!mr.length) {
          alert('Справочник marketRates пуст — выполните seed на staging.');
          return;
        }
        const codes = mr.map((c) => c.code).slice(0, 12).join(', ');
        const code = prompt('Код эталона marketRates (' + codes + '):', mr[0].code);
        if (!code) return;
        const row = mr.find((c) => c.code === code);
        if (!row || !row.data) {
          alert('Не найден');
          return;
        }
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        FR.normalizeVehicleFleetMeta(veh);
        if (row.data.city) veh.rates.city = Object.assign({}, veh.rates.city, row.data.city);
        if (row.data.intercity) veh.rates.intercity = Object.assign(veh.rates.intercity, row.data.intercity);
        if (row.data.special) veh.rates.special = Object.assign(veh.rates.special, row.data.special);
        veh.rates.marketRateCode = code;
        veh.rates.correctedByOwner = false;
        bumpDataEpoch('veh-rates-reset');
        persist();
        openVehicleCard(v.id);
      });

    root.querySelector('#vr-sched-save') &&
      (root.querySelector('#vr-sched-save').onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        FR.normalizeVehicleFleetMeta(veh);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach((d) => {
          const st = (root.querySelector(`[data-sched-day="${d}-start"]`) || {}).value;
          const en = (root.querySelector(`[data-sched-day="${d}-end"]`) || {}).value;
          if (st && en) veh.schedule.template[d] = { start: st, end: en };
          else if (d === 'sunday') veh.schedule.template[d] = null;
        });
        bumpDataEpoch('veh-schedule');
        persist();
        flashCatOk('График сохранён');
        openVehicleCard(v.id);
      });
  }

  function companyPoliciesHtml(c) {
    FR.normalizeCompanyPolicies(c);
    const a = c.acceptanceRules;
    const cp = c.cancellationPolicy;
    const rt = c.rating;
    return `
    <h4>Правила приёма заявок</h4>
    <div class="form-pair">
      <div><label>Cut-off</label><input id="co-cutoff" value="${esc(a.cutOffTime || '16:00')}" /></div>
      <div><label>Срочная наценка</label><input id="co-urgent-mul" inputmode="decimal" value="${a.urgentSurcharge ?? 1.3}" /></div>
    </div>
    <h4>Политика отмен</h4>
    <p class="hint">Бесплатно за ${cp.freeCancellationHours || 24} ч · штраф от 12 ч: 10%</p>
    <h4>Рейтинг</h4>
    <p class="hint">Оценка ${rt.score} · заказов ${rt.totalOrders} · отмены ${(rt.cancellationRate * 100).toFixed(1)}%</p>
    <button type="button" class="secondary" id="co-policies-save" style="width:auto;margin-top:6px">Сохранить правила</button>`;
  }

  function wireCompanyPolicies(c, box) {
    if (!box || !c) return;
    const mount = document.createElement('div');
    mount.className = 'co-policies-box';
    mount.innerHTML = companyPoliciesHtml(c);
    box.appendChild(mount);
    const save = mount.querySelector('#co-policies-save');
    if (save) {
      save.onclick = () => {
        FR.normalizeCompanyPolicies(c);
        c.acceptanceRules.cutOffTime = (mount.querySelector('#co-cutoff') || {}).value || '16:00';
        c.acceptanceRules.urgentSurcharge = +(mount.querySelector('#co-urgent-mul') || {}).value || 1.3;
        c.ratesCorrectedByOwner = true;
        bumpDataEpoch('co-policies');
        persist();
        flashCatOk('Правила компании сохранены');
      };
    }
  }

  function renderCustomerQuoteBox(order, vehicles, company, container) {
    if (!container || !FR.buildCustomerQuoteVariants) return;
    const variants = FR.buildCustomerQuoteVariants(vehicles, company, order, { distanceKm: order.routeDistanceKm || 40 });
    if (!variants.length) {
      container.innerHTML = '<div class="hint">Нет подходящих машин для расчёта</div>';
      return;
    }
    container.innerHTML = variants
      .map((v) => {
        const p = v.pick;
        const risks = (p.risks || []).map((r) => r.label).join(', ') || '—';
        const lines = (p.price.lines || [])
          .map((l) => `${esc(l.label)}: ${l.amount} ₽`)
          .join(' · ');
        return `<div class="card" style="padding:8px;margin:6px 0">
          <strong>${esc(v.title)}</strong> — ${p.price.total} ₽ · подача ~${p.eta.minutes} мин
          <div class="hint">${esc(lines)}</div>
          <div class="hint">Риски: ${esc(risks)}</div>
        </div>`;
      })
      .join('');
  }

  g.armadaFleetRatesUi = {
    wireVehicleCard,
    wireCompanyPolicies,
    renderCustomerQuoteBox,
    companyPoliciesHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
