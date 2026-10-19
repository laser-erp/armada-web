/* Конструктор продуктовых entitlements (супер). Не SaaS billing. Без серверной изоляции. */

function openAdminEntitlements() {
  if (!isSuperAdmin()) {
    alert('Доступно только супер-админу');
    return;
  }
  renderAdminEntitlements();
  show('admin-entitlements-screen');
}

function renderAdminEntitlements() {
  const ent = ensurePlatformEntitlements();
  const form = $('entitlements-form');
  if (!form) return;

  const tariffs = (ent.tariffs || []).filter((t) => t && String(t.role || '') === OWNER_DRIVER_ROLE);
  const tariffEditor = tariffs
    .map((t) => {
      const mods = SPACE_MODULE_IDS.map((mid) => {
        const on = (t.modules || []).includes(mid);
        const lab = SPACE_MODULE_LABELS[mid] || mid;
        return `<label style="display:block;font-size:.85rem;margin:4px 0">
          <input type="checkbox" data-ent-tariff-mod="${esc(t.id)}" data-mod="${esc(mid)}"${on ? ' checked' : ''} />
          ${esc(lab)}
        </label>`;
      }).join('');
      const price = String(t.priceLabel || 'по решению').trim() || 'по решению';
      return `<section class="card" style="margin-bottom:12px">
        <h3>${esc(t.labelRu || t.id)} <span class="meta">(${esc(t.id)})</span></h3>
        <p class="meta">Цена: ${esc(price)} · лимит ТС: <b>${esc(String(t.maxVehicles != null ? t.maxVehicles : '—'))}</b></p>
        <div style="margin-top:8px">${mods}</div>
        <button type="button" class="secondary" data-ent-save-tariff="${esc(t.id)}" style="margin-top:8px">Сохранить состав тарифа</button>
      </section>`;
    })
    .join('');

  const spaces = (state.spaces || [])
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
  const ownerSpaces = spaces.filter((sp) => sp && sp.cabinetKind === 'owner_driver');
  const ownerTableRows = ownerSpaces
    .map((sp) => {
      const iso =
        typeof ownerPaidUntilIsoFromSpace === 'function' ? ownerPaidUntilIsoFromSpace(sp) : null;
      const st =
        typeof ownerSubscriptionStatusForSpace === 'function'
          ? ownerSubscriptionStatusForSpace(sp)
          : { phase: 'none' };
      const label =
        typeof ownerPaidUntilLabelForSpace === 'function'
          ? ownerPaidUntilLabelForSpace(sp)
          : '—';
      const paidCell =
        st.phase === 'expired'
          ? `<span style="color:#dc2626;font-weight:600">${esc(label)}</span>`
          : esc(label);
      return `<tr>
        <td>${esc(sp.name)}</td>
        <td>${paidCell}</td>
        <td class="meta">${esc(sp.id)}</td>
      </tr>`;
    })
    .join('');
  const ownerTable =
    ownerSpaces.length
      ? `<table class="data-table" style="width:100%;margin-bottom:14px;font-size:.9rem">
        <thead><tr><th>Кабинет</th><th>Оплачено до</th><th>Space</th></tr></thead>
        <tbody>${ownerTableRows}</tbody>
      </table>`
      : '<p class="empty">Нет кабинетов частных перевозчиков</p>';
  const spaceRows = spaces
    .map((sp) => {
      const cur = spaceProductTariffIdFromSpace(sp) || '';
      const opts = tariffs
        .map((t) => {
          const sel = cur === t.id ? ' selected' : '';
          return `<option value="${esc(t.id)}"${sel}>${esc(t.labelRu || t.id)}</option>`;
        })
        .join('');
      const resolved = resolveEntitlements(OWNER_DRIVER_ROLE, sp);
      const overrideChecks = SPACE_MODULE_IDS.map((mid) => {
        const lab = SPACE_MODULE_LABELS[mid] || mid;
        const eff = resolved.modules[mid] !== false;
        const raw = sp.moduleOverrides && sp.moduleOverrides[mid];
        const hasOv = raw != null;
        const checked = hasOv ? !!raw : eff;
        return `<label style="display:block;font-size:.82rem;margin:3px 0">
          <input type="checkbox" data-ent-space-ov="${esc(sp.id)}" data-mod="${esc(mid)}"${checked ? ' checked' : ''} />
          ${esc(lab)}${hasOv ? ' (override)' : ''}
        </label>`;
      }).join('');
      const maxV = resolved.maxVehicles != null ? resolved.maxVehicles : '—';
      const kindBadge = sp.cabinetKind === 'owner_driver' ? ' · <span class="meta">частный перевозчик</span>' : '';
      let paidBlock = '';
      if (sp.cabinetKind === 'owner_driver' && typeof ownerPaidUntilLabelForSpace === 'function') {
        const st = ownerSubscriptionStatusForSpace(sp);
        const paidLabel = ownerPaidUntilLabelForSpace(sp);
        const paidStyle = st.phase === 'expired' ? 'color:#dc2626;font-weight:600' : '';
        paidBlock = `<p style="margin:8px 0"><span class="lbl">Оплачено до:</span> <b style="${paidStyle}">${esc(paidLabel)}</b></p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          <button type="button" class="secondary" data-ent-paid-add="${esc(sp.id)}" data-days="30">+30 дней</button>
          <button type="button" class="secondary" data-ent-paid-add="${esc(sp.id)}" data-days="90">+90 дней</button>
          <button type="button" class="secondary" data-ent-paid-set="${esc(sp.id)}">Указать дату</button>
          <button type="button" class="secondary" data-ent-paid-block="${esc(sp.id)}">Заблокировать</button>
        </div>`;
      }
      return `<section class="card" style="margin-bottom:10px">
        <h3>${esc(sp.name)}${kindBadge}</h3>
        <p class="meta">Space ${esc(sp.id)} · итог лимит ТС: <b>${esc(String(maxV))}</b></p>
        ${paidBlock}
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0">
          <label class="meta">Продуктовый тариф</label>
          <select id="ent-tariff-${esc(sp.id)}" style="min-width:160px">
            <option value="">— не задан (все модули) —</option>
            ${opts}
          </select>
          <button type="button" class="secondary" data-ent-save-space-tariff="${esc(sp.id)}">Тариф на фирму</button>
        </div>
        <details><summary style="cursor:pointer;font-size:.8rem">Override модулей на space</summary>
          <p class="meta" style="margin:6px 0">Галочка = включено. Сохранение пишет только отличия от тарифа в <code>moduleOverrides</code>.</p>
          ${overrideChecks}
          <button type="button" class="secondary" data-ent-save-space-ov="${esc(sp.id)}" style="margin-top:6px">Сохранить override</button>
        </details>
      </section>`;
    })
    .join('');

  form.innerHTML = `<p class="cat-panel-hint">Продуктовые модули кабинета частного перевозчика. Это <b>не</b> SaaS-тарифы из раздела «Тарифы и оплата». Лимиты ТС и модули проверяются на API для кабинетов <code>cabinetKind=owner_driver</code>.</p>
    <section class="card" style="margin-bottom:14px;border:1px solid rgba(59,130,246,.35)">
      <h2 class="owner-driver-h2">Создать частного перевозчика</h2>
      <p class="meta">Одним действием: фирма (тариф Базовый, 1 машина) + учётка + ТС. Вход только через <a href="/o/" target="_blank" rel="noopener">/o/</a>.</p>
      <label>ФИО</label><input id="ent-new-owner-name" autocomplete="name" />
      <label>Телефон</label><input id="ent-new-owner-phone" inputmode="tel" autocomplete="tel" />
      <label>PIN (от 4 цифр)</label><input id="ent-new-owner-pin" inputmode="numeric" maxlength="8" autocomplete="off" />
      <label>Название фирмы</label><input id="ent-new-owner-firm" />
      <label>ИНН (необязательно)</label><input id="ent-new-owner-inn" inputmode="numeric" />
      <label>Госномер машины</label><input id="ent-new-owner-plate" />
      <button type="button" class="primary" id="ent-new-owner-submit" style="margin-top:10px">Создать кабинет</button>
      <p class="error" id="ent-new-owner-error" role="status"></p>
    </section>
    <h2 class="owner-driver-h2">Шаблоны тарифов (роль частный перевозчик)</h2>
    ${tariffEditor || '<p class="empty">Нет тарифов в каталоге</p>'}
    <h2 class="owner-driver-h2" style="margin-top:16px">Кабинеты частных перевозчиков — оплата</h2>
    ${ownerTable}
    <h2 class="owner-driver-h2" style="margin-top:16px">Фирмы (space)</h2>
    ${spaceRows || '<p class="empty">Нет space</p>'}`;

  const back = $('entitlements-back');
  if (back) back.onclick = () => {
    show('admin');
    renderAdmin();
  };

  const createBtn = $('ent-new-owner-submit');
  if (createBtn) {
    createBtn.onclick = () => {
      const errEl = $('ent-new-owner-error');
      const setErr = (m) => {
        if (errEl) errEl.textContent = m || '';
      };
      setErr('');
      if (typeof createOwnerDriverCabinet !== 'function') {
        setErr('Функция создания недоступна');
        return;
      }
      const res = createOwnerDriverCabinet({
        name: ($('ent-new-owner-name') || {}).value,
        phone: ($('ent-new-owner-phone') || {}).value,
        pin: ($('ent-new-owner-pin') || {}).value,
        firmName: ($('ent-new-owner-firm') || {}).value,
        inn: ($('ent-new-owner-inn') || {}).value,
        plate: ($('ent-new-owner-plate') || {}).value,
      });
      if (!res || !res.ok) {
        setErr('Заполните ФИО, телефон, PIN и госномер');
        return;
      }
      if (typeof persist === 'function') persist();
      setErr(`Готово: ${res.driver.name}, вход /o/ · ${formatPhone(res.driver.phone)}`);
      renderAdminEntitlements();
    };
  }

  form.querySelectorAll('[data-ent-save-tariff]').forEach((btn) => {
    btn.onclick = () => {
      const tid = btn.dataset.entSaveTariff;
      const t = platformTariffById(tid);
      if (!t) return;
      const mods = [];
      form.querySelectorAll(`[data-ent-tariff-mod="${tid}"]`).forEach((inp) => {
        if (inp.checked) mods.push(inp.dataset.mod);
      });
      t.modules = mods;
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-tariff');
      persist();
      renderAdminEntitlements();
    };
  });

  form.querySelectorAll('[data-ent-save-space-tariff]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.entSaveSpaceTariff;
      const sp = findSpaceById(sid);
      if (!sp) return;
      const sel = $('ent-tariff-' + sid);
      const val = sel ? String(sel.value || '').trim() : '';
      if (val) sp.productTariffId = val;
      else delete sp.productTariffId;
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-space-tariff');
      persist();
      renderAdminEntitlements();
    };
  });

  form.querySelectorAll('[data-ent-paid-add]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.entPaidAdd;
      const days = Number(btn.dataset.days) || 0;
      const sp = findSpaceById(sid);
      if (!sp || typeof extendOwnerPaidUntilOnSpace !== 'function') return;
      extendOwnerPaidUntilOnSpace(sp, days);
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-owner-paid');
      persist();
      renderAdminEntitlements();
    };
  });
  form.querySelectorAll('[data-ent-paid-set]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.entPaidSet;
      const sp = findSpaceById(sid);
      if (!sp) return;
      const cur =
        typeof ownerPaidUntilIsoFromSpace === 'function' ? ownerPaidUntilIsoFromSpace(sp) : '';
      const hint = cur && cur.slice(0, 10) ? cur.slice(0, 10) : '';
      const raw = window.prompt('Оплачено до (ГГГГ-ММ-ДД)', hint);
      if (!raw) return;
      if (typeof setOwnerPaidUntilOnSpace === 'function') setOwnerPaidUntilOnSpace(sp, raw.trim());
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-owner-paid-set');
      persist();
      renderAdminEntitlements();
    };
  });
  form.querySelectorAll('[data-ent-paid-block]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.entPaidBlock;
      const sp = findSpaceById(sid);
      if (!sp || typeof blockOwnerSubscriptionOnSpace !== 'function') return;
      if (!window.confirm('Заблокировать запись для этого кабинета (подписка в прошлом)?')) return;
      blockOwnerSubscriptionOnSpace(sp);
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-owner-paid-block');
      persist();
      renderAdminEntitlements();
    };
  });

  form.querySelectorAll('[data-ent-save-space-ov]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.entSaveSpaceOv;
      const sp = findSpaceById(sid);
      if (!sp) return;
      const base = resolveSpaceModules(Object.assign({}, sp, { moduleOverrides: undefined }));
      const ov = {};
      let any = false;
      form.querySelectorAll(`[data-ent-space-ov="${sid}"]`).forEach((inp) => {
        const mid = inp.dataset.mod;
        const want = !!inp.checked;
        const fromTariff = base[mid] !== false;
        if (want !== fromTariff) {
          ov[mid] = want;
          any = true;
        }
      });
      if (any) sp.moduleOverrides = ov;
      else delete sp.moduleOverrides;
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('entitlements-space-ov');
      persist();
      renderAdminEntitlements();
    };
  });
}
