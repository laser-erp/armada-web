/* АРМАДА — «Настройки кабинета → Оформление» (шаг 3) */
let cabinetThemeDraft = null;
let cabinetThemeSaved = null;

function cabinetThemeSpaceId() {
  if (typeof ownerDriverTrustedSpaceId === 'function' && ownerDriverTrustedSpaceId()) {
    return ownerDriverTrustedSpaceId();
  }
  return typeof currentSpaceId === 'function' ? currentSpaceId() : null;
}

function cabinetThemeSpace() {
  const sid = cabinetThemeSpaceId();
  return sid && typeof findSpaceById === 'function' ? findSpaceById(sid) : null;
}

function isCabinetThemeOwnerEditor() {
  if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return true;
  if (typeof ownerDriverSessionRecord === 'function' && ownerDriverSessionRecord()) {
    const sp = cabinetThemeSpace();
    return sp && typeof spaceModuleEnabled === 'function' && spaceModuleEnabled(sp, 'branding');
  }
  if (!currentAdmin) return false;
  const sp = cabinetThemeSpace();
  if (!sp) return false;
  if (!sp.adminId) return true;
  return sp.adminId === currentAdmin.id;
}

function cabinetThemeOwnerTariffLocked() {
  if (typeof ownerDriverSessionRecord !== 'function' || !ownerDriverSessionRecord()) return false;
  const sp = cabinetThemeSpace();
  return !!(sp && typeof spaceModuleEnabled === 'function' && !spaceModuleEnabled(sp, 'branding'));
}

function cabinetThemeLockedHint() {
  const sp = cabinetThemeSpace();
  if (cabinetThemeOwnerTariffLocked()) {
    return 'Оформление доступно в тарифе «Максимальный» — обратитесь к администратору.';
  }
  if (currentAdmin && sp && sp.adminId && sp.adminId !== currentAdmin.id) {
    return 'Менять оформление может только владелец кабинета. Вы можете посмотреть текущие настройки.';
  }
  return '';
}

function cloneThemeDraft(cfg) {
  const base = typeof normalizeSpaceThemeConfig === 'function' ? normalizeSpaceThemeConfig(cfg) : cfg;
  const d = JSON.parse(JSON.stringify(base || defaultSpaceThemeConfig()));
  if (d.radius === 0) d.radius = null;
  return d;
}

function cabinetThemeAccentPalette() {
  return ['#E01F26', '#157A4A', '#2F6FED', '#F5C400', '#7C5CFF', '#B4532A', '#0E9AAE', '#17181B'];
}

function cabinetThemePresetIds() {
  if (typeof ARMADA_THEME_IDS !== 'undefined' && ARMADA_THEME_IDS.length) return ARMADA_THEME_IDS.slice();
  return Object.keys(ARMADA_THEMES || {});
}

function cabinetThemePresetTile(id, selected) {
  const preset = typeof armadaThemePresetFromId === 'function' ? armadaThemePresetFromId(id) : null;
  const t = ARMADA_THEMES[id];
  if (!t || !preset) return '';
  const sel = selected === id ? ' cabinet-theme-tile on' : ' cabinet-theme-tile';
  const note = t.note ? `<small class="cabinet-theme-tile-note">${esc(t.note)}</small>` : '';
  return `<button type="button" class="${sel.trim()}" data-theme-preset="${esc(id)}" aria-pressed="${selected === id ? 'true' : 'false'}" style="--tile-accent:${esc(t.accent)};--tile-menu:${esc(t.menuBg)};--tile-bg:${esc(t.bg)};--tile-surface:${esc(t.surface)}">
    <span class="cabinet-theme-tile-thumb" aria-hidden="true"><i class="cabinet-theme-tile-thumb-menu"></i><i class="cabinet-theme-tile-thumb-body"></i></span>
    <span class="cabinet-theme-tile-name">${esc(t.name)}</span>
    ${note}
  </button>`;
}

function cabinetThemePreviewHtml(draft, space) {
  const resolved = typeof armadaResolvedThemeTokens === 'function' ? armadaResolvedThemeTokens(draft, 'cabinet') : null;
  const p = resolved && resolved.preset ? resolved.preset : null;
  if (!p) return '<div class="cabinet-theme-live hint">Превью</div>';
  const accent = p.accent;
  const onAcc = typeof armadaOnColor === 'function' ? armadaOnColor(accent) : '#fff';
  const btnLbl =
    typeof armadaButtonContrastLabel === 'function' ? armadaButtonContrastLabel(accent) : { ok: true };
  const btnWeak = !btnLbl.ok;
  const firmName = space && space.name ? space.name : 'Ваша фирма';
  const textMain = lum(p.surface) < 0.2 ? '#ECECEE' : '#17181B';
  const logo = draft && draft.logo ? draft.logo : null;
  const logoHtml = logo
    ? `<span class="cabinet-theme-live-logo-frame"><img src="${esc(logo)}" alt="" class="cabinet-theme-live-logo" /></span>`
    : '<span class="cabinet-theme-live-logo-frame cabinet-theme-live-logo-ph" aria-hidden="true">А</span>';
  return `<div class="cabinet-theme-live" style="background:${esc(p.bg)};color:${esc(textMain)};border-radius:${esc(String(p.radius))}px">
    <div class="cabinet-theme-live-head">${logoHtml}<span class="cabinet-theme-live-title">${esc(firmName)}</span></div>
    <nav class="cabinet-theme-live-menu" style="background:${esc(p.menuBg)}">Заявки · Парк · Настройки</nav>
    <div class="cabinet-theme-live-btns">
      <button type="button" class="cabinet-theme-live-primary" style="background:${esc(accent)};color:${esc(onAcc)}">Назначить</button>
      <button type="button" class="cabinet-theme-live-secondary">Отмена</button>
    </div>
    <article class="cabinet-theme-live-card" style="background:${esc(p.surface)}">
      <div class="cabinet-theme-live-card-top"><b>№ 51</b><span class="cabinet-theme-live-status">В работе</span></div>
      <p class="cabinet-theme-live-route">Москва → Тверь</p>
    </article>
    <label class="cabinet-theme-live-field-invalid"><span>Ставка</span><input type="text" value="" readonly tabindex="-1" aria-invalid="true" /><em>Укажите сумму</em></label>
    ${btnWeak ? '<p class="hint warn cabinet-theme-live-btn-hint">На кнопках текст станет тёмным</p>' : ''}
  </div>`;
}

function cabinetThemePaintPreviewNodes(draft, space) {
  const html = cabinetThemePreviewHtml(draft, space);
  const side = $('cabinet-theme-preview');
  const mob = $('cabinet-theme-preview-mobile-inner');
  if (side) side.innerHTML = html;
  if (mob) mob.innerHTML = html;
}

function lum(hex) {
  return typeof armadaLum === 'function' ? armadaLum(hex) : 0.5;
}

function renderCabinetThemeContrastHint(draft, canEdit) {
  const resolved = typeof armadaResolvedThemeTokens === 'function' ? armadaResolvedThemeTokens(draft, 'cabinet') : null;
  const accent = resolved && resolved.preset ? resolved.preset.accent : '#E01F26';
  const lbl =
    typeof armadaButtonContrastLabel === 'function'
      ? armadaButtonContrastLabel(accent)
      : { ok: true, text: '' };
  const el = $('cabinet-theme-contrast');
  const pick = $('cabinet-theme-pick-readable');
  if (!el) return;
  let msg = lbl.text ? `Контраст на кнопке: ${lbl.text}` : '';
  if (!lbl.ok && lbl.text === 'слабовато') msg += ' — ни светлый, ни тёмный текст не читается.';
  el.textContent = msg;
  el.className = lbl.ok ? 'hint' : 'hint warn';
  if (pick) {
    pick.hidden = !!(lbl.ok || !canEdit);
  }
}

function renderCabinetSettingsTheme(form) {
  const sp = cabinetThemeSpace();
  const locked = cabinetThemeLockedHint();
  const tariffLocked = cabinetThemeOwnerTariffLocked();
  const canEdit = isCabinetThemeOwnerEditor();
  const showSaveActions = canEdit && !tariffLocked;
  cabinetThemeSaved = sp && sp.theme ? cloneThemeDraft(sp.theme) : null;
  cabinetThemeDraft = cloneThemeDraft(cabinetThemeSaved || defaultSpaceThemeConfig());
  const presets = cabinetThemePresetIds();
  const fonts = typeof ARMADA_THEME_FONT_OPTIONS !== 'undefined' ? ARMADA_THEME_FONT_OPTIONS : ['Onest'];
  const logoBytes = typeof armadaThemeLogoBytes === 'function' ? armadaThemeLogoBytes(cabinetThemeDraft.logo) : 0;
  const logoWarn = logoBytes > 50 * 1024 ? `<p class="hint warn">Логотип ${Math.round(logoBytes / 1024)} КБ — большой для общего state. Рекомендуем до 50 КБ.</p>` : '';
  const logoPreview = cabinetThemeDraft.logo
    ? `<img src="${esc(cabinetThemeDraft.logo)}" alt="" class="cabinet-theme-logo-preview" />`
    : '<span class="cabinet-theme-logo-empty hint">Нет логотипа</span>';
  const layoutCls = `cabinet-theme-layout${tariffLocked ? ' cabinet-theme--tariff-lock' : ''}${!canEdit ? ' cabinet-theme--readonly' : ''}`;
  const fontOpts = `<option value=""${!cabinetThemeDraft.font ? ' selected' : ''}>как в теме</option>${fonts.map((f) => `<option value="${esc(f)}"${cabinetThemeDraft.font === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}`;
  const previewHtml = cabinetThemePreviewHtml(cabinetThemeDraft, sp);
  form.classList.add('cabinet-theme-form');
  form.innerHTML = `
    <p class="cat-panel-hint">Тема, цвет и логотип для кабинета, водителей и портала заказчика. Сайт и правовые страницы — всегда стиль АРМАДА.</p>
    ${locked ? `<p class="hint warn cabinet-theme-lock-banner">${esc(locked)}</p>` : ''}
    <div class="${layoutCls}">
      <div class="cabinet-theme-preview-mobile" id="cabinet-theme-preview-mobile">
        <button type="button" class="cabinet-theme-preview-toggle" id="cabinet-theme-preview-toggle" aria-expanded="false">Как будет выглядеть ▾</button>
        <div class="cabinet-theme-preview-wrap" id="cabinet-theme-preview-mobile-inner" hidden>${previewHtml}</div>
      </div>
      <div class="cabinet-theme-main">
        <h4 class="form-section-title">Основа</h4>
        <div class="cabinet-theme-presets">${presets.map((id) => cabinetThemePresetTile(id, cabinetThemeDraft.preset)).join('')}</div>
        <h4 class="form-section-title">Цвет фирмы</h4>
        <div class="cabinet-theme-colors" id="cabinet-theme-colors"></div>
        <label class="fld"><span>Свой цвет</span><input id="cabinet-theme-accent" type="text" inputmode="text" value="${esc(cabinetThemeDraft.accent || '')}" placeholder="#E01F26" ${canEdit ? '' : 'disabled'} /></label>
        <p id="cabinet-theme-contrast" class="hint"></p>
        <button type="button" class="secondary cabinet-theme-pick-readable" id="cabinet-theme-pick-readable" hidden style="width:auto;margin-bottom:8px">Подобрать читаемый</button>
        <h4 class="form-section-title">Логотип</h4>
        <div class="cabinet-theme-logo-row">
          <div class="cabinet-theme-logo-box">${logoPreview}</div>
          ${showSaveActions ? `<div class="cabinet-theme-logo-actions">
            <input type="file" id="cabinet-theme-logo-file" accept="image/*" hidden />
            <button type="button" class="secondary" id="cabinet-theme-logo-upload" style="width:auto">Загрузить</button>
            <button type="button" class="secondary" id="cabinet-theme-logo-color" style="width:auto" ${cabinetThemeDraft.logo ? '' : 'disabled'}>Взять цвет из логотипа</button>
            <button type="button" class="secondary" id="cabinet-theme-logo-clear" style="width:auto" ${cabinetThemeDraft.logo ? '' : 'disabled'}>Убрать</button>
          </div>` : ''}
        </div>
        ${logoWarn}
        <h4 class="form-section-title">Шрифт и форма</h4>
        <label class="fld"><span>Шрифт</span><select id="cabinet-theme-font" ${canEdit ? '' : 'disabled'}>${fontOpts}</select></label>
        <label class="fld"><span>Скругление, px</span><input id="cabinet-theme-radius" type="text" inputmode="numeric" autocomplete="off" value="${cabinetThemeDraft.radius != null ? esc(String(cabinetThemeDraft.radius)) : ''}" placeholder="как в теме" ${canEdit ? '' : 'disabled'} /></label>
        <label class="fld"><span>Плотность</span><select id="cabinet-theme-density" ${canEdit ? '' : 'disabled'}>
          <option value="compact"${cabinetThemeDraft.density === 'compact' ? ' selected' : ''}>Компактно</option>
          <option value="normal"${cabinetThemeDraft.density === 'normal' ? ' selected' : ''}>Обычно</option>
          <option value="roomy"${cabinetThemeDraft.density === 'roomy' ? ' selected' : ''}>Просторно</option>
        </select></label>
        <h4 class="form-section-title">Где применять</h4>
        <div class="cabinet-theme-apply-list">
          <label class="check cabinet-theme-apply-item"><input type="checkbox" id="cabinet-theme-apply-cabinet" ${cabinetThemeDraft.applyTo.cabinet ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /><span>Кабинет логиста</span></label>
          <label class="check cabinet-theme-apply-item"><input type="checkbox" id="cabinet-theme-apply-driver" ${cabinetThemeDraft.applyTo.driver ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /><span>Водители</span></label>
          <label class="check cabinet-theme-apply-item"><input type="checkbox" id="cabinet-theme-apply-portal" ${cabinetThemeDraft.applyTo.portal ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /><span>Портал заказчика</span></label>
        </div>
        <label class="fld"><span>Тема для водителей</span><select id="cabinet-theme-driver-theme" ${canEdit ? '' : 'disabled'}>
          <option value="same"${cabinetThemeDraft.driverTheme === 'same' ? ' selected' : ''}>Как у кабинета</option>
          <option value="night"${cabinetThemeDraft.driverTheme === 'night' ? ' selected' : ''}>Ночь (тёмный)</option>
        </select></label>
      </div>
      <aside class="cabinet-theme-side" aria-label="Превью оформления">
        <h4 class="form-section-title">Превью</h4>
        <div id="cabinet-theme-preview">${previewHtml}</div>
      </aside>
    </div>
    ${showSaveActions ? `<div class="row cabinet-theme-actions" style="gap:8px;margin-top:16px;flex-wrap:wrap">
      <button type="button" class="primary" id="cabinet-theme-save">Сохранить</button>
      <button type="button" class="secondary" id="cabinet-theme-cancel" style="width:auto">Отменить</button>
      <button type="button" class="secondary" id="cabinet-theme-reset" style="width:auto">Вернуть как было</button>
    </div>` : canEdit ? '' : `<div class="row cabinet-theme-actions" style="gap:8px;margin-top:16px"><button type="button" class="secondary" id="cabinet-theme-cancel" style="width:auto">Закрыть</button></div>`}
    <p id="cabinet-theme-status" class="hint" aria-live="polite"></p>`;

  const pal = $('cabinet-theme-colors');
  if (pal) {
    pal.innerHTML = cabinetThemeAccentPalette()
      .map(
        (c) =>
          `<button type="button" class="cabinet-theme-swatch${cabinetThemeDraft.accent === c ? ' on' : ''}" data-accent="${esc(c)}" style="background:${esc(c)}" title="${esc(c)}" ${canEdit ? '' : 'disabled'}></button>`
      )
      .join('');
  }

  function refreshPreview() {
    cabinetThemePaintPreviewNodes(cabinetThemeDraft, sp);
    renderCabinetThemeContrastHint(cabinetThemeDraft, canEdit);
    if (typeof armadaApplySpaceThemeForSpace === 'function' && sp) {
      const tmp = { ...sp, theme: cabinetThemeDraft };
      armadaApplySpaceThemeForSpace(tmp, 'cabinet');
    }
  }

  const previewToggle = $('cabinet-theme-preview-toggle');
  const previewMobWrap = $('cabinet-theme-preview-mobile-inner');
  if (previewToggle && previewMobWrap) {
    previewToggle.onclick = () => {
      const open = previewMobWrap.hidden;
      previewMobWrap.hidden = !open;
      previewToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      previewToggle.textContent = open ? 'Как будет выглядеть ▴' : 'Как будет выглядеть ▾';
    };
  }

  const pickReadable = $('cabinet-theme-pick-readable');
  if (pickReadable) {
    pickReadable.onclick = () => {
      if (!canEdit) return;
      const resolved = typeof armadaResolvedThemeTokens === 'function' ? armadaResolvedThemeTokens(cabinetThemeDraft, 'cabinet') : null;
      const surf = resolved && resolved.preset ? resolved.preset.surface : '#FFFFFF';
      const acc = cabinetThemeDraft.accent || (resolved && resolved.preset ? resolved.preset.accent : '#E01F26');
      const next = typeof armadaSuggestReadableAccent === 'function' ? armadaSuggestReadableAccent(acc, surf) : acc;
      if (next) {
        cabinetThemeDraft.accent = next;
        if ($('cabinet-theme-accent')) $('cabinet-theme-accent').value = next;
        form.querySelectorAll('[data-accent]').forEach((x) => x.classList.toggle('on', x.dataset.accent === next));
        refreshPreview();
      }
    };
  }

  function readDraftFromForm() {
    const acc = ($('cabinet-theme-accent') && $('cabinet-theme-accent').value || '').trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(acc)) cabinetThemeDraft.accent = '#' + acc.replace('#', '').toUpperCase();
    else cabinetThemeDraft.accent = null;
    const font = $('cabinet-theme-font') && $('cabinet-theme-font').value;
    cabinetThemeDraft.font = font || null;
    const rad = ($('cabinet-theme-radius') && $('cabinet-theme-radius').value || '').trim();
    if (rad === '') cabinetThemeDraft.radius = null;
    else {
      const n = Number(rad);
      cabinetThemeDraft.radius = Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n) : null;
    }
    cabinetThemeDraft.density = ($('cabinet-theme-density') && $('cabinet-theme-density').value) || 'normal';
    cabinetThemeDraft.applyTo = {
      cabinet: !!($('cabinet-theme-apply-cabinet') && $('cabinet-theme-apply-cabinet').checked),
      driver: !!($('cabinet-theme-apply-driver') && $('cabinet-theme-apply-driver').checked),
      portal: !!($('cabinet-theme-apply-portal') && $('cabinet-theme-apply-portal').checked),
      docs: false,
    };
    cabinetThemeDraft.driverTheme = ($('cabinet-theme-driver-theme') && $('cabinet-theme-driver-theme').value) || 'same';
  }

  form.querySelectorAll('[data-theme-preset]').forEach((b) => {
    b.onclick = () => {
      if (!canEdit) return;
      cabinetThemeDraft.preset = b.dataset.themePreset;
      form.querySelectorAll('[data-theme-preset]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      refreshPreview();
    };
  });
  form.querySelectorAll('[data-accent]').forEach((b) => {
    b.onclick = () => {
      if (!canEdit) return;
      cabinetThemeDraft.accent = b.dataset.accent;
      if ($('cabinet-theme-accent')) $('cabinet-theme-accent').value = cabinetThemeDraft.accent;
      form.querySelectorAll('[data-accent]').forEach((x) => x.classList.toggle('on', x === b));
      refreshPreview();
    };
  });
  const accIn = $('cabinet-theme-accent');
  if (accIn) accIn.oninput = () => {
    readDraftFromForm();
    refreshPreview();
  };
  ['cabinet-theme-font', 'cabinet-theme-radius', 'cabinet-theme-density', 'cabinet-theme-driver-theme'].forEach((id) => {
    const el = $(id);
    if (el) el.onchange = () => {
      readDraftFromForm();
      refreshPreview();
    };
  });
  ['cabinet-theme-apply-cabinet', 'cabinet-theme-apply-driver', 'cabinet-theme-apply-portal'].forEach((id) => {
    const el = $(id);
    if (el) el.onchange = readDraftFromForm;
  });

  const uploadBtn = $('cabinet-theme-logo-upload');
  const fileIn = $('cabinet-theme-logo-file');
  if (uploadBtn && fileIn) {
    uploadBtn.onclick = () => {
      if (!showSaveActions) return;
      fileIn.click();
    };
  }
  if (fileIn) {
    fileIn.onchange = async () => {
      if (!canEdit || !fileIn.files || !fileIn.files[0]) return;
      const st = $('cabinet-theme-status');
      try {
        const dataUrl = await armadaCompressImageFile(fileIn.files[0], 200 * 1024);
        cabinetThemeDraft.logo = dataUrl;
        if (st) st.textContent = 'Логотип загружен.';
        openCabinetSettings('theme');
      } catch (e) {
        if (st) st.textContent = 'Не удалось сжать логотип до 200 КБ.';
      }
      fileIn.value = '';
    };
  }
  const clr = $('cabinet-theme-logo-clear');
  if (clr) clr.onclick = () => {
    if (!canEdit) return;
    cabinetThemeDraft.logo = null;
    openCabinetSettings('theme');
  };
  const fromLogo = $('cabinet-theme-logo-color');
  if (fromLogo) {
    fromLogo.onclick = async () => {
      if (!canEdit || !cabinetThemeDraft.logo) return;
      const colors = await armadaColorsFromLogo(cabinetThemeDraft.logo, 3);
      if (colors[0]) {
        cabinetThemeDraft.accent = colors[0];
        if ($('cabinet-theme-accent')) $('cabinet-theme-accent').value = colors[0];
        refreshPreview();
      }
    };
  }

  const saveBtn = $('cabinet-theme-save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!canEdit) return;
      readDraftFromForm();
      const sid = cabinetThemeSpaceId();
      if (!sid) return;
      const idx = (state.spaces || []).findIndex((s) => s && s.id === sid);
      if (idx < 0) return;
      const norm = normalizeSpaceThemeConfig(cabinetThemeDraft);
      state.spaces[idx] = { ...state.spaces[idx], theme: norm };
      cabinetThemeSaved = cloneThemeDraft(norm);
      if (typeof persist === 'function') persist();
      if (typeof armadaSyncEntryBranding === 'function') armadaSyncEntryBranding();
      const st = $('cabinet-theme-status');
      if (st) st.textContent = 'Сохранено. Обновите вход водителя или портал, если они уже открыты.';
    };
  }
  const cancelBtn = $('cabinet-theme-cancel');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      cabinetThemeDraft = cloneThemeDraft(cabinetThemeSaved || defaultSpaceThemeConfig());
      openCabinetSettings('theme');
      if (typeof armadaSyncEntryBranding === 'function') armadaSyncEntryBranding();
    };
  }
  const resetBtn = $('cabinet-theme-reset');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (!canEdit) return;
      const sid = cabinetThemeSpaceId();
      const idx = (state.spaces || []).findIndex((s) => s && s.id === sid);
      if (idx < 0) return;
      const next = { ...state.spaces[idx] };
      delete next.theme;
      state.spaces[idx] = next;
      cabinetThemeSaved = null;
      cabinetThemeDraft = cloneThemeDraft(defaultSpaceThemeConfig());
      if (typeof persist === 'function') persist();
      if (typeof armadaSyncEntryBranding === 'function') armadaSyncEntryBranding();
      openCabinetSettings('theme');
    };
  }

  refreshPreview();
}

function openCabinetThemeFromOwner() {
  if (typeof ownerDriverShowView === 'function') {
    ownerDriverShowView('theme');
  }
}

function renderOwnerDriverTheme() {
  const el = $('owner-driver-view');
  if (!el) return;
  el.classList.remove('owner-driver-narrow');
  el.classList.add('owner-driver-theme-wide');
  el.innerHTML = `<h2 class="owner-driver-h2">Оформление</h2><div id="owner-driver-theme-form" class="cabinet-theme-form"></div>`;
  const form = $('owner-driver-theme-form');
  if (form && typeof renderCabinetSettingsTheme === 'function') renderCabinetSettingsTheme(form);
}
