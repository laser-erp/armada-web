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
      return `<section class="card" style="margin-bottom:10px">
        <h3>${esc(sp.name)}</h3>
        <p class="meta">Space ${esc(sp.id)} · итог лимит ТС: <b>${esc(String(maxV))}</b></p>
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

  form.innerHTML = `<p class="cat-panel-hint">Продуктовые модули кабинета собственника-водителя. Это <b>не</b> SaaS-тарифы из раздела «Тарифы и оплата». Сервер модулей пока не проверяет — только скрытие во фронте.</p>
    <h2 class="owner-driver-h2">Шаблоны тарифов (роль собственник-водитель)</h2>
    ${tariffEditor || '<p class="empty">Нет тарифов в каталоге</p>'}
    <h2 class="owner-driver-h2" style="margin-top:16px">Фирмы (space)</h2>
    ${spaceRows || '<p class="empty">Нет space</p>'}`;

  const back = $('entitlements-back');
  if (back) back.onclick = () => {
    show('admin');
    renderAdmin();
  };

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
