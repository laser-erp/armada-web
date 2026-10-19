/* UI: тарифы и график в карточке ТС, политики компании, котировки заказчика */
(function (g) {
  const FR = g.armadaFleetRates;
  if (!FR) return;

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s || '');
  }

  function persistCompanyRatesImmediate(company) {
    if (typeof persistLocalOnly === 'function') persistLocalOnly();
    const id = company && company.id;
    if (typeof persistAdminFleetEntityImmediate === 'function' && id) {
      persistAdminFleetEntityImmediate('company', id).catch(() => {});
      return;
    }
    if (typeof persist === 'function') persist();
  }

  function outsideKadLabel(code) {
    return (FR.outsideKadLabel && FR.outsideKadLabel(code)) || (FR.OUTSIDE_KAD_LABELS && FR.OUTSIDE_KAD_LABELS[code]) || code;
  }

  function shiftPriceValue(row) {
    if (!row) return '';
    if (row.price != null && row.price !== '') return row.price;
    if (row.shift != null && row.shift !== '') return row.shift;
    return '';
  }

  function shiftTableHtml(block, prefix) {
    return (block.shiftOptions || [])
      .map((row, i) => {
        const wh = row.workHours != null ? row.workHours : '';
        const dh = row.deliveryHours != null ? row.deliveryHours : '';
        const pr = shiftPriceValue(row);
        const minChk = FR.shiftOptionIsMinimum && FR.shiftOptionIsMinimum(row) ? ' checked' : '';
        return `<tr data-shift-block="${prefix}" data-shift-i="${i}">
          <td><input class="vc-shift-wh" data-shift-block="${prefix}" data-shift-i="${i}" inputmode="numeric" value="${wh}" style="width:3.2rem" /></td>
          <td><input class="vc-shift-dh" data-shift-block="${prefix}" data-shift-i="${i}" inputmode="numeric" value="${dh}" style="width:3.2rem" /></td>
          <td><input class="vc-shift-price" data-shift-block="${prefix}" data-shift-i="${i}" inputmode="numeric" value="${pr}" style="width:5rem" /></td>
          <td style="text-align:center"><input type="checkbox" class="vc-shift-min" data-shift-block="${prefix}" data-shift-i="${i}" title="Минималка почасовой"${minChk} /></td>
          <td><button type="button" class="icon-btn danger vc-shift-del" data-shift-block="${prefix}" data-shift-i="${i}" title="Удалить">×</button></td>
        </tr>`;
      })
      .join('');
  }

  function companyShiftTableHtml(shifts) {
    return (shifts || [])
      .map((row, i) => {
        const wh = row.workHours != null ? row.workHours : '';
        const dh = row.deliveryHours != null ? row.deliveryHours : '';
        const pr = shiftPriceValue(row);
        const minChk = FR.shiftOptionIsMinimum && FR.shiftOptionIsMinimum(row) ? ' checked' : '';
        return `<tr data-co-shift-i="${i}">
          <td><input class="co-rbt-shift-wh" data-shift-i="${i}" inputmode="numeric" value="${wh}" style="width:3.2rem" /></td>
          <td><input class="co-rbt-shift-dh" data-shift-i="${i}" inputmode="numeric" value="${dh}" style="width:3.2rem" /></td>
          <td><input class="co-rbt-shift-price" data-shift-i="${i}" inputmode="numeric" value="${pr}" style="width:5rem" /></td>
          <td style="text-align:center"><input type="checkbox" class="co-rbt-shift-min" data-shift-i="${i}" title="Минималка почасовой"${minChk} /></td>
          <td><button type="button" class="icon-btn danger co-rbt-shift-del" data-shift-i="${i}" title="Удалить">×</button></td>
        </tr>`;
      })
      .join('');
  }

  function readShiftRowsFromVehicleForm(root, blockKey) {
    const rows = [];
    root.querySelectorAll(`tr[data-shift-block="${blockKey}"]`).forEach((tr) => {
      const i = tr.dataset.shiftI;
      const wh = +String((tr.querySelector(`.vc-shift-wh[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
      const dh = +String((tr.querySelector(`.vc-shift-dh[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
      const pr = +String((tr.querySelector(`.vc-shift-price[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
      const isMin = !!(tr.querySelector(`.vc-shift-min[data-shift-i="${i}"]`) || {}).checked;
      const workHours = wh > 0 && !Number.isNaN(wh) ? wh : null;
      const deliveryHours = dh >= 0 && !Number.isNaN(dh) ? dh : null;
      const code = workHours && deliveryHours != null ? workHours + '+' + deliveryHours : '4+1';
      const row = {
        code,
        workHours: workHours || 4,
        deliveryHours: deliveryHours != null ? deliveryHours : 1,
        price: pr > 0 && !Number.isNaN(pr) ? pr : null,
        shift: pr > 0 && !Number.isNaN(pr) ? pr : null,
      };
      if (isMin) row.isMinimum = true;
      rows.push(row);
    });
    return rows;
  }

  function ratesTabHtml(v, company) {
    const inherited = v && v.rates === null;
    const co = company || (typeof findCompanyById === 'function' ? findCompanyById(v.companyId) : null);
    const r = inherited ? FR.resolveRatesForVehicle(v, co) : FR.normalizeVehicleRates(v);
    const outsideOpts = FR.OUTSIDE_KAD_TYPES
      .map(
        (t) =>
          `<option value="${esc(t)}" ${r.city.outsideKadPolicy.type === t ? 'selected' : ''}>${esc(outsideKadLabel(t))}</option>`
      )
      .join('');
    const shiftsCity = shiftTableHtml(r.city, 'city');
    const shiftsSpec = shiftTableHtml(r.special, 'special');
    const inheritBadge = inherited
      ? '<span class="chip">унаследовано от компании</span>'
      : '<span class="chip hot">свои условия</span>';
    const inheritHint = inherited
      ? `<p class="hint">${inheritBadge} Тариф от компании${co && co.name ? ' «' + esc(co.name) + '»' : ''}. «Переопределить» — свои условия на машине.</p>
      <button type="button" class="secondary" id="vr-inherit-reset" style="width:auto;margin-bottom:8px">Переопределить</button>`
      : `<p class="hint">${inheritBadge}</p><button type="button" class="secondary" id="vr-inherit-company" style="width:auto;margin-bottom:8px">Снова наследовать от компании</button>`;
    return `
    <section class="form-section vc-panel-rates" data-vc-panel="rates" hidden>
      <h2 class="form-section-title">Тарифы</h2>
      ${inheritHint}
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
        <label>Ставка ₽/ч (спец) <span class="catalog-ref-mark">◎</span><input id="vr-sp-hourly" inputmode="decimal" value="${r.special.hourlyRate ?? ''}" /></label>
        <label class="svc-full">Примечание<input id="vr-sp-note" value="${esc(r.special.deliveryNote || '')}" /></label>
        <p class="hint svc-full">Смены (город)</p>
        <table class="svc-full vc-shift-table" style="width:100%;font-size:.8rem"><thead><tr><th>Часов работы</th><th>Часов подачи</th><th>Цена ₽</th><th>Мин.</th><th></th></tr></thead><tbody id="vr-shifts-city">${shiftsCity}</tbody></table>
        <button type="button" class="secondary svc-full vc-shift-add" data-shift-block="city" style="width:auto;margin-bottom:8px">+ Добавить смену</button>
        <p class="hint svc-full">Смены (спецтехника)</p>
        <table class="svc-full vc-shift-table" style="width:100%;font-size:.8rem"><thead><tr><th>Часов работы</th><th>Часов подачи</th><th>Цена ₽</th><th>Мин.</th><th></th></tr></thead><tbody id="vr-shifts-special">${shiftsSpec}</tbody></table>
        <button type="button" class="secondary svc-full vc-shift-add" data-shift-block="special" style="width:auto;margin-bottom:8px">+ Добавить смену</button>
        <label>Минимальная доплата<input id="vr-min-sur" inputmode="numeric" value="${r.minSurcharge ?? ''}" /></label>
        <button type="button" class="secondary" id="vr-reset-market" style="width:auto">Сбросить к эталону marketRates</button>
        <button type="button" class="primary cat-add-btn fin-full" id="vr-save" ${inherited ? 'disabled' : ''}>Сохранить тарифы</button>
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
    const co = typeof findCompanyById === 'function' ? findCompanyById(v.companyId) : null;
    root.insertAdjacentHTML('beforeend', ratesTabHtml(v, co) + scheduleTabHtml(v));

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
    root.querySelector('#vr-inherit-reset') &&
      (root.querySelector('#vr-inherit-reset').onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        const resolved = FR.resolveRatesForVehicle(veh, co);
        veh.rates = JSON.parse(JSON.stringify(resolved));
        FR.normalizeVehicleFleetMeta(veh);
        veh.rates.correctedByOwner = true;
        bumpDataEpoch('veh-rates-override');
        persist();
        openVehicleCard(v.id);
      });
    root.querySelector('#vr-inherit-company') &&
      (root.querySelector('#vr-inherit-company').onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        state.vehicles[vi].rates = null;
        bumpDataEpoch('veh-rates-inherit');
        persist();
        openVehicleCard(v.id);
      });
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
        r.city.shiftOptions = readShiftRowsFromVehicleForm(root, 'city');
        r.special.shiftOptions = readShiftRowsFromVehicleForm(root, 'special');
        r.minSurcharge = num('#vr-min-sur') || 3000;
        r.correctedByOwner = true;
        bumpDataEpoch('veh-rates');
        persist();
        if (typeof flashCatOk === 'function') flashCatOk('Тарифы сохранены');
        openVehicleCard(v.id);
      });

    root.querySelectorAll('.vc-shift-add').forEach((btn) => {
      btn.onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        if (veh.rates == null) {
          const resolved = FR.resolveRatesForVehicle(veh, co);
          veh.rates = JSON.parse(JSON.stringify(resolved));
          veh.rates.correctedByOwner = true;
        }
        FR.normalizeVehicleFleetMeta(veh);
        const blockKey = btn.dataset.shiftBlock === 'special' ? 'special' : 'city';
        const block = veh.rates[blockKey];
        if (!block.shiftOptions) block.shiftOptions = [];
        block.shiftOptions.push({ code: '4+1', workHours: 4, deliveryHours: 1, price: null, shift: null });
        bumpDataEpoch('veh-shift-add');
        persist();
        openVehicleCard(v.id);
      };
    });
    root.querySelectorAll('.vc-shift-del').forEach((btn) => {
      btn.onclick = () => {
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        if (veh.rates == null) return;
        const blockKey = btn.dataset.shiftBlock === 'special' ? 'special' : 'city';
        const i = +btn.dataset.shiftI;
        const block = veh.rates[blockKey];
        if (!block || !Array.isArray(block.shiftOptions)) return;
        block.shiftOptions.splice(i, 1);
        bumpDataEpoch('veh-shift-del');
        persist();
        openVehicleCard(v.id);
      };
    });

    root.querySelector('#vr-reset-market') &&
      (root.querySelector('#vr-reset-market').onclick = () => {
        const cats = (typeof state !== 'undefined' && state.catalogs) || [];
        const vi = (state.vehicles || []).findIndex((x) => x.id === v.id);
        if (vi < 0) return;
        const veh = state.vehicles[vi];
        const result = FR.applyMarketRatesFromCatalog(veh, cats);
        if (!result.ok) {
          alert(
            'Нет эталона marketRates для типа «' +
              (result.typeId || veh.bodyTypeId || 'board') +
              '». Выполните seed marketRates на staging.'
          );
          return;
        }
        state.vehicles[vi].rates = result.rates;
        bumpDataEpoch('veh-rates-reset');
        persist();
        if (typeof flashCatOk === 'function') {
          flashCatOk('Подтянут эталон: ' + (result.codes || []).join(', '));
        }
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

  async function loadTariffRulesCatalog() {
    if (typeof fetchArmadaApi !== 'function' || typeof armadaApiJsonHeaders !== 'function') return [];
    if (typeof ensureArmadaApiToken === 'function') {
      try {
        await ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
      } catch (_) {}
    }
    const res = await fetchArmadaApi('/catalogs?type=tariffRules', { headers: armadaApiJsonHeaders() }, 60000);
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];
    FR.setCatalogTariffRules(rows);
    return rows;
  }

  function catalogTariffRulesPanelHtml(rows) {
    const list = (rows || [])
      .map((rec) => {
        const d = rec.data || {};
        const vt = d.vehicleType || rec.group || '';
        const L = d.lengthM || {};
        const P = d.payloadTons || {};
        const city = (d.rates && d.rates.city) || {};
        return `<details class="fin-rule-row" style="margin:8px 0;border:1px solid var(--border,#ddd);border-radius:8px;padding:8px">
          <summary style="cursor:pointer;font-weight:600"><span class="chip">общее правило</span> ${esc(rec.name || rec.code)}</summary>
          <p class="hint">Тип ${esc(vt)} · длина ${esc(L.min)}–${esc(L.max)} м · до ${esc(P.max)} т · город ${esc(city.hourlyRate)} ₽/ч</p>
          <button type="button" class="secondary co-cat-rule-edit" data-rule-id="${esc(rec.id)}" style="width:auto">Редактировать ₽/ч</button>
        </details>`;
      })
      .join('');
    return list || '<p class="hint">Нет правил — scripts/seed-staging-catalogs.py на staging.</p>';
  }

  function wireCatalogTariffRules(root) {
    if (!root) return;
    const slot = root.querySelector('#catalog-tariff-rules-mount');
    if (!slot) return;
    loadTariffRulesCatalog().then((rows) => {
      slot.innerHTML = `<section><h3 class="form-section-title" style="font-size:1rem">Общие правила тарифов</h3>
        <p class="cat-panel-hint">Справочник catalogs · tariffRules. Компании и машины наследуют, пока не уточнят.</p>
        ${catalogTariffRulesPanelHtml(rows)}</section>`;
      slot.querySelectorAll('.co-cat-rule-edit').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.ruleId;
          const rec = (rows || []).find((r) => r.id === id);
          if (!rec) return;
          const d = rec.data || {};
          const city = (d.rates && d.rates.city) || {};
          const hourly = prompt('Город ₽/ч', city.hourlyRate != null ? String(city.hourlyRate) : '');
          if (hourly === null) return;
          const n = +String(hourly).replace(',', '.');
          if (!(n > 0)) {
            alert('Нужно число > 0');
            return;
          }
          if (!d.rates) d.rates = {};
          if (!d.rates.city) d.rates.city = {};
          d.rates.city.hourlyRate = n;
          fetchArmadaApi(
            '/catalogs/' + encodeURIComponent(id),
            {
              method: 'PATCH',
              headers: Object.assign({}, armadaApiJsonHeaders(), { 'Content-Type': 'application/json' }),
              body: JSON.stringify({ name: rec.name, data: d }),
            },
            60000
          )
            .then((res) => {
              if (!res.ok) throw new Error('save');
              if (typeof flashCatOk === 'function') flashCatOk('Общее правило сохранено');
              return loadTariffRulesCatalog();
            })
            .then((fresh) => {
              slot.innerHTML = `<section><h3 class="form-section-title" style="font-size:1rem">Общие правила тарифов</h3>
                <p class="cat-panel-hint">Справочник catalogs · tariffRules.</p>${catalogTariffRulesPanelHtml(fresh)}</section>`;
              wireCatalogTariffRules(root);
            })
            .catch(() => alert('Сохранение только на staging (PATCH /catalogs)'));
        };
      });
    });
  }

  function companyRatesByTypeHtml(c, typeSel) {
    FR.normalizeCompanyRatesByType(c);
    const types = FR.RATES_BY_TYPE_IDS || [];
    const t0 = typeSel || types[0] || 'board';
    const ov = FR.companyTypeOverrideEntry(c, t0);
    const active = FR.effectiveRatesByTypeEntry(c, t0);
    const locked = !ov;
    const badge = locked
      ? '<span class="chip">унаследовано из общего справочника</span>'
      : '<span class="chip hot">уточнено компанией</span>';
    const typeOpts = types.map((t) => `<option value="${esc(t)}" ${t === t0 ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const shifts = (active.city && active.city.shiftOptions) || [];
    const shiftRows = companyShiftTableHtml(shifts);
    const dis = locked ? ' disabled' : '';
    return `
    <h4>Тарифы по типам ТС</h4>
    <p class="hint">${badge}</p>
    <label>Тип ТС</label>
    <select id="co-rbt-type">${typeOpts}</select>
    <button type="button" class="secondary" id="co-rbt-clarify" style="width:auto;margin:6px 0">Уточнить</button>
    <div class="form-pair">
      <div><label>Город ₽/ч</label><input id="co-rbt-hourly" inputmode="decimal"${dis} value="${active.city && active.city.hourlyRate != null ? active.city.hourlyRate : ''}" /></div>
      <div><label>Включено км</label><input id="co-rbt-inckm" inputmode="decimal"${dis} value="${active.city && active.city.includedKm != null ? active.city.includedKm : ''}" /></div>
    </div>
    <div class="form-pair">
      <div><label>₽/км сверх</label><input id="co-rbt-extrakm" inputmode="decimal"${dis} value="${active.city && active.city.extraKmRate != null ? active.city.extraKmRate : ''}" /></div>
      <div><label>Межгород ₽/км</label><input id="co-rbt-ic-km" inputmode="decimal"${dis} value="${active.intercity && active.intercity.perKm != null ? active.intercity.perKm : ''}" /></div>
    </div>
    <label>Межгород длинн. ₽/км</label><input id="co-rbt-ic-kml" inputmode="decimal"${dis} value="${active.intercity && active.intercity.perKmLong != null ? active.intercity.perKmLong : ''}" />
    <p class="hint">Смены (город)</p>
    <table class="svc-full" style="width:100%;font-size:.8rem"><thead><tr><th>Часов работы</th><th>Часов подачи</th><th>Цена ₽</th><th title="Минималка для почасовой оплаты">Мин.</th><th></th></tr></thead><tbody id="co-rbt-shifts">${shiftRows}</tbody></table>
    <button type="button" class="secondary" id="co-rbt-shift-add" style="width:auto;margin-top:4px"${locked ? ' disabled' : ''}>+ Добавить смену</button>
    <button type="button" class="secondary" id="co-rbt-save" style="width:auto;margin-top:6px"${locked ? ' disabled' : ''}>Сохранить тариф типа</button>`;
  }

  function wireCompanyRatesByType(c, box) {
    if (!box || !c) return;
    const mount = document.createElement('div');
    mount.className = 'co-rates-by-type-box';
    loadTariffRulesCatalog().then(() => {
      mount.innerHTML = companyRatesByTypeHtml(c);
      box.appendChild(mount);
      bindCompanyRatesMount(c, mount);
    });
  }

  function bindCompanyRatesMount(c, mount) {
    if (!mount || !c) return;
    const typeNow = (mount.querySelector('#co-rbt-type') || {}).value || 'board';
    let draftShifts = (FR.effectiveRatesByTypeEntry(c, typeNow).city.shiftOptions || []).slice();
    const num = (sel) => {
      const n = +String((mount.querySelector(sel) || {}).value || '').replace(',', '.');
      return n > 0 && !Number.isNaN(n) ? n : null;
    };
    const repaint = (typeId) => {
      mount.innerHTML = companyRatesByTypeHtml(c, typeId);
      bindCompanyRatesMount(c, mount);
    };
    const readCompanyShiftsFromForm = () => {
      const rows = [];
      mount.querySelectorAll('tr[data-co-shift-i]').forEach((tr) => {
        const i = tr.dataset.coShiftI;
        const wh = +String((tr.querySelector(`.co-rbt-shift-wh[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
        const dh = +String((tr.querySelector(`.co-rbt-shift-dh[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
        const pr = +String((tr.querySelector(`.co-rbt-shift-price[data-shift-i="${i}"]`) || {}).value || '').replace(',', '.');
        const isMin = !!(tr.querySelector(`.co-rbt-shift-min[data-shift-i="${i}"]`) || {}).checked;
        const workHours = wh > 0 && !Number.isNaN(wh) ? wh : 4;
        const deliveryHours = dh >= 0 && !Number.isNaN(dh) ? dh : 1;
        const row = {
          workHours,
          deliveryHours,
          price: pr > 0 && !Number.isNaN(pr) ? pr : null,
        };
        if (isMin) row.isMinimum = true;
        rows.push(row);
      });
      return rows;
    };
    mount.querySelector('#co-rbt-type') &&
      (mount.querySelector('#co-rbt-type').onchange = () => {
        repaint(mount.querySelector('#co-rbt-type').value);
      });
    mount.querySelector('#co-rbt-clarify') &&
      (mount.querySelector('#co-rbt-clarify').onclick = () => {
        const t = (mount.querySelector('#co-rbt-type') || {}).value || 'board';
        const eff = FR.effectiveRatesByTypeEntry(c, t);
        let entry = (c.ratesByType || []).find((x) => x && x.type === t);
        if (!entry) {
          entry = JSON.parse(JSON.stringify(eff));
          c.ratesByType = c.ratesByType || [];
          c.ratesByType.push(entry);
        }
        entry.companyOverride = true;
        c.ratesCorrectedByOwner = true;
        bumpDataEpoch('co-rates-clarify');
        persistCompanyRatesImmediate(c);
        repaint(t);
      });
    mount.querySelector('#co-rbt-shift-add') &&
      (mount.querySelector('#co-rbt-shift-add').onclick = () => {
        const tbody = mount.querySelector('#co-rbt-shifts');
        if (!tbody) return;
        draftShifts = readCompanyShiftsFromForm();
        draftShifts.push({ workHours: 4, deliveryHours: 1, price: null });
        tbody.innerHTML = companyShiftTableHtml(draftShifts);
      });
    mount.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('.co-rbt-shift-del');
      if (!btn || !mount.contains(btn)) return;
      const i = +btn.dataset.shiftI;
      draftShifts = readCompanyShiftsFromForm();
      draftShifts.splice(i, 1);
      const tbody = mount.querySelector('#co-rbt-shifts');
      if (tbody) tbody.innerHTML = companyShiftTableHtml(draftShifts);
    });
    mount.querySelector('#co-rbt-save') &&
      (mount.querySelector('#co-rbt-save').onclick = () => {
        FR.normalizeCompanyRatesByType(c);
        const t = (mount.querySelector('#co-rbt-type') || {}).value || 'board';
        let entry = (c.ratesByType || []).find((x) => x.type === t);
        if (!entry) {
          entry = JSON.parse(JSON.stringify(FR.effectiveRatesByTypeEntry(c, t)));
          c.ratesByType.push(entry);
        }
        entry.companyOverride = true;
        entry.city = entry.city || {};
        entry.intercity = entry.intercity || {};
        entry.city.hourlyRate = num('#co-rbt-hourly');
        entry.city.includedKm = num('#co-rbt-inckm');
        entry.city.extraKmRate = num('#co-rbt-extrakm');
        entry.intercity.perKm = num('#co-rbt-ic-km');
        entry.intercity.perKmLong = num('#co-rbt-ic-kml');
        entry.city.shiftOptions = readCompanyShiftsFromForm().map((row) => {
          const code = row.workHours + '+' + row.deliveryHours;
          const out = {
            workHours: row.workHours,
            deliveryHours: row.deliveryHours,
            price: row.price,
            shift: row.price,
            code,
          };
          if (row.isMinimum) out.isMinimum = true;
          return out;
        });
        if (!entry.special) entry.special = FR.defaultRatesByTypeEntry(t).special;
        if (entry.special.hourlyRate == null) entry.special.hourlyRate = entry.city.hourlyRate;
        if (!entry.special.deliveryNote) {
          entry.special.deliveryNote = FR.defaultRatesByTypeEntry(t).special.deliveryNote;
        }
        c.ratesCorrectedByOwner = true;
        bumpDataEpoch('co-rates-by-type');
        persistCompanyRatesImmediate(c);
        if (typeof flashCatOk === 'function') flashCatOk('Тариф типа сохранён');
        repaint(t);
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
        persistCompanyRatesImmediate(c);
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
    wireCompanyRatesByType,
    wireCatalogTariffRules,
    loadTariffRulesCatalog,
    renderCustomerQuoteBox,
    companyPoliciesHtml,
    companyRatesByTypeHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);
