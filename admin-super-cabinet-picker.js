/* Супер-админ: один выбор кабинета (поиск, скрытие тестовых) вместо «стены» кнопок */
const SUPER_CABINET_LAST_KEY = 'armada_super_cabinet_last';
const SUPER_CABINET_SHOW_TEST_KEY = 'armada_super_show_test_spaces';

function superAdminPickerShowTest() {
  try {
    return localStorage.getItem(SUPER_CABINET_SHOW_TEST_KEY) === '1';
  } catch (_) {
    return false;
  }
}
function setSuperAdminPickerShowTest(on) {
  try {
    localStorage.setItem(SUPER_CABINET_SHOW_TEST_KEY, on ? '1' : '0');
  } catch (_) {}
}

function rememberSuperCabinetPick(spaceId) {
  const id = String(spaceId || '').trim();
  if (!id || id === 'all' || id === '_none') return;
  try {
    localStorage.setItem(SUPER_CABINET_LAST_KEY, id);
  } catch (_) {}
}
function lastSuperCabinetPick() {
  try {
    return localStorage.getItem(SUPER_CABINET_LAST_KEY) || '';
  } catch (_) {
    return '';
  }
}

function findArmadaSpaceForPicker() {
  const spaces = state.spaces || [];
  let hit = spaces.find(
    (s) => /армада/i.test(String(s.name || '')) && !isTestSpaceForSuperAdmin(s)
  );
  if (hit) return hit;
  if (typeof findArmadaLogistCompany === 'function') {
    const co = findArmadaLogistCompany();
    if (co && co.spaceId) hit = spaces.find((s) => s.id === co.spaceId);
  }
  return hit || null;
}

/** spaceId для хаба «Настройки кабинета» — всегда конкретный кабинет */
function cabinetSettingsEffectiveSpaceId() {
  if (typeof isSuperAdmin !== 'function' || !isSuperAdmin()) {
    return typeof currentSpaceId === 'function' ? currentSpaceId() : null;
  }
  const f = state.adminOwnerFilter || 'all';
  if (f && f !== 'all' && f !== '_none') return f;
  const last = lastSuperCabinetPick();
  if (last && typeof findSpaceById === 'function' && findSpaceById(last)) return last;
  const arm = findArmadaSpaceForPicker();
  if (arm && arm.id) return arm.id;
  return typeof currentSpaceId === 'function' ? currentSpaceId() : null;
}

function superCabinetPickerSpaces(opts) {
  const showTest = !!(opts && opts.showTest);
  const allowAll = !(opts && opts.allowAll === false);
  const allowNone = !(opts && opts.allowNone === false);
  const q = String((opts && opts.query) || '')
    .trim()
    .toLowerCase();
  const all = (state.spaces || []).filter(Boolean);
  const arm = findArmadaSpaceForPicker();
  const real = [];
  const test = [];
  all.forEach((sp) => {
    (isTestSpaceForSuperAdmin(sp) ? test : real).push(sp);
  });
  const sortRu = (a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  real.sort(sortRu);
  test.sort(sortRu);
  let list = showTest ? real.concat(test) : real.slice();
  if (arm && !showTest) {
    list = list.filter((s) => s.id !== arm.id);
    list.unshift(arm);
  } else if (arm && showTest) {
    list = list.filter((s) => s.id !== arm.id);
    const rest = list.filter((s) => !isTestSpaceForSuperAdmin(s));
    const tst = list.filter((s) => isTestSpaceForSuperAdmin(s));
    rest.sort(sortRu);
    tst.sort(sortRu);
    list = [arm].concat(rest, tst);
  }
  if (q) {
    list = list.filter((sp) => {
      const name = String(sp.name || '').toLowerCase();
      const inn = String(sp.inn || '').replace(/\D/g, '');
      const qInn = q.replace(/\D/g, '');
      if (name.includes(q)) return true;
      if (qInn && inn.includes(qInn)) return true;
      return String(sp.id || '').toLowerCase().includes(q);
    });
  }
  const out = [];
  if (allowAll) out.push({ id: 'all', name: 'Все кабинеты', inn: '' });
  list.forEach((sp) => out.push({ id: sp.id, name: sp.name || sp.id, inn: sp.inn || '' }));
  if (allowNone) out.push({ id: '_none', name: 'Без кабинета', inn: '' });
  return out;
}

function superCabinetPickerLabel(row) {
  if (!row) return '';
  if (row.id === 'all') return 'Все кабинеты';
  if (row.id === '_none') return 'Без кабинета';
  const inn = row.inn ? ` · ИНН ${row.inn}` : '';
  return `${row.name || row.id}${inn}`;
}

function applySuperAdminOwnerFilter(value, onPick) {
  const v = value || 'all';
  state.adminOwnerFilter = v;
  if (v !== 'all' && v !== '_none') rememberSuperCabinetPick(v);
  if (typeof onSuperCabinetFilterPicked === 'function') onSuperCabinetFilterPicked();
  if (typeof paintAdminOwnerFilters === 'function') paintAdminOwnerFilters();
  if (typeof paintCatalogOwnerFilters === 'function') paintCatalogOwnerFilters();
  if (typeof onPick === 'function') onPick();
}

function paintSuperCabinetPicker(box, opts) {
  if (!box) return;
  const onPick = opts && opts.onPick;
  const allowAll = !(opts && opts.allowAll === false);
  const allowNone = !(opts && opts.allowNone === false);
  const variant =
    opts && opts.variant === 'sidebar' ? 'sidebar' : 'inline';
  if (typeof isSuperAdmin !== 'function' || !isSuperAdmin()) {
    box.classList.remove('show');
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.classList.add('show');
  const inst = box.id || 'picker';
  const cur = state.adminOwnerFilter || 'all';
  const showTest = superAdminPickerShowTest();
  const rows = superCabinetPickerSpaces({ showTest, allowAll, allowNone, query: '' });
  const optsHtml = rows
    .map((r) => {
      const sel = r.id === cur ? ' selected' : '';
      return `<option value="${esc(r.id)}"${sel}>${esc(superCabinetPickerLabel(r))}</option>`;
    })
    .join('');
  const hint =
    variant === 'sidebar'
      ? 'Справочник и заказы выбранного кабинета.'
      : 'Кабинет справочника и парка. «ИП Нечаев», «МБН» — другие перевозчики, не контрагенты Армады.';
  const labelRow =
    variant === 'sidebar'
      ? `<span class="super-cabinet-picker-label super-cabinet-picker-label--sr">Кабинет</span>`
      : `<label class="super-cabinet-picker-label" for="super-cabinet-q-${esc(inst)}">Кабинет перевозчика</label>`;
  const morePanel = `<details class="super-cabinet-picker-more">
      <summary class="super-cabinet-picker-more-btn" aria-label="Дополнительно">⋯</summary>
      <div class="super-cabinet-picker-more-panel">
        <label class="check super-cabinet-picker-test-wrap"><input type="checkbox" class="super-cabinet-picker-test" ${showTest ? 'checked' : ''}/> Показать тестовые</label>
        <p class="hint super-cabinet-picker-hint">${hint}</p>
      </div>
    </details>`;
  box.innerHTML = `<div class="super-cabinet-picker super-cabinet-picker--${variant}" data-inst="${esc(inst)}">
    ${labelRow}
    <div class="super-cabinet-picker-row">
      <input type="search" id="super-cabinet-q-${esc(inst)}" class="super-cabinet-picker-q" placeholder="Поиск: название или ИНН" autocomplete="off" enterkeyhint="search" />
      <select id="super-cabinet-sel-${esc(inst)}" class="super-cabinet-picker-sel" size="1" aria-label="Кабинет перевозчика">${optsHtml}</select>
      ${morePanel}
    </div>
  </div>`;
  const root = box.querySelector('.super-cabinet-picker');
  const qEl = box.querySelector('.super-cabinet-picker-q');
  const sel = box.querySelector('.super-cabinet-picker-sel');
  const testCb = box.querySelector('.super-cabinet-picker-test');
  if (!root || !sel) return;

  const refill = (query) => {
    const list = superCabinetPickerSpaces({
      showTest: superAdminPickerShowTest(),
      allowAll,
      allowNone,
      query,
    });
    const c = state.adminOwnerFilter || 'all';
    sel.innerHTML = list
      .map((r) => {
        const on = r.id === c ? ' selected' : '';
        return `<option value="${esc(r.id)}"${on}>${esc(superCabinetPickerLabel(r))}</option>`;
      })
      .join('');
    sel.value = c;
    sel.size = 1;
  };

  refill('');
  sel.value = cur;

  if (!box.dataset.pickerWired) {
    box.dataset.pickerWired = '1';
    box.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('super-cabinet-picker-test')) {
        setSuperAdminPickerShowTest(!!t.checked);
        const qv = qEl ? qEl.value : '';
        refill(qv);
        return;
      }
      if (t && t.classList && t.classList.contains('super-cabinet-picker-sel')) {
        applySuperAdminOwnerFilter(t.value, onPick);
        if (typeof updateAdminChrome === 'function') updateAdminChrome();
        if (typeof renderAdmin === 'function') renderAdmin();
      }
    });
    box.addEventListener('input', (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('super-cabinet-picker-q')) {
        refill(t.value);
      }
    });
  } else if (qEl) {
    qEl.value = '';
  }
}
