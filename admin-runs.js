/** Ход работы (супер-админ): GET /runs/status.json, только чтение. */
let adminRunsPollTimer = null;
let adminRunsLastRuns = [];
let adminRunsFullRuns = [];
let adminRunsForceVisibleRunId = null;
let adminRunsLongPressTimer = null;
let adminRunsLongPressTarget = null;
let adminRunsLongPressStart = null;

const ADMIN_RUNS_MSK = 'Europe/Moscow';
const ADMIN_RUNS_LONG_PRESS_MS = 600;
const ADMIN_RUNS_LONG_PRESS_MOVE_PX = 10;
const ADMIN_RUNS_FILTER_KEY = 'adminRunsFilter';
const ADMIN_RUNS_TASKS_FILTER_KEY = 'adminRunsTasksFilter';
const ADMIN_RUNS_STALE_MS = 10 * 60 * 1000;
const ADMIN_RUNS_COLLAPSE_INTERRUPTED_KEY = 'adminRunsCollapseInterrupted';
const ADMIN_RUNS_NOW_FRESH_MS = 10 * 60 * 1000;
const ADMIN_RUNS_LIST_LIMIT = 50;

function adminRunsStepIcon(status) {
  if (status === 'ok') return '✅';
  if (status === 'fail') return '❌';
  if (status === 'warn') return '⚠️';
  if (status === 'running') return '⏳';
  return '○';
}

function adminRunsRunIcon(status) {
  if (status === 'ok') return '✅';
  if (status === 'fail') return '❌';
  if (status === 'warn') return '⚠️';
  if (status === 'interrupted') return '⏹';
  if (status === 'rechecked') return '↪';
  return '⏳';
}

function adminRunsStatusLabel(status, statusNote, run) {
  if (status === 'running' && run && run.recheckInProgress) {
    return 'Перепроверка';
  }
  if (status === 'rechecked') {
    const n = run && run.recheckedByRunNo != null ? run.recheckedByRunNo : null;
    if (n != null) return `Перепроверен (прогон №${n})`;
    const note = (statusNote || '').trim();
    return note || 'Перепроверен';
  }
  if (status === 'ok') return 'Готово';
  if (status === 'fail') return 'Ошибка';
  if (status === 'warn') {
    const note = (statusNote || '').trim();
    if (note) return note;
    return 'Замечания';
  }
  if (status === 'running') return 'В работе';
  if (status === 'interrupted') {
    const note = (statusNote || '').trim();
    return note || 'Прервано';
  }
  return 'Ожидание';
}

function adminRunsDeployPillClass(label) {
  const lb = String(label || 'unknown').toLowerCase();
  if (lb === 'staging') return 'admin-runs-pill--deploy-staging';
  if (lb === 'develop') return 'admin-runs-pill--deploy-develop';
  if (lb === 'main') return 'admin-runs-pill--deploy-main';
  if (lb === 'branch') return 'admin-runs-pill--deploy-branch';
  return 'admin-runs-pill--deploy-unknown';
}

function adminRunsDeployLabelHtml(item) {
  if (!item || !item.deployLabel) return '';
  const text = (item.deployLabelText || item.deployLabel || '').trim();
  if (!text) return '';
  const cls = adminRunsDeployPillClass(item.deployLabel);
  return `<span class="admin-runs-pill ${cls}" title="${esc(text)}">${esc(text)}</span>`;
}

function adminRunsStagingDeployBannerHtml(stagingDeploy) {
  const sd = stagingDeploy && typeof stagingDeploy === 'object' ? stagingDeploy : null;
  if (!sd || !sd.commit) return '';
  const build = (sd.build || '—').trim() || '—';
  const short = String(sd.commit).slice(0, 7);
  const when = adminRunsFormatWhen(sd.at);
  return `<p class="admin-runs-staging-now" role="status">На staging сейчас: сборка ${esc(build)}, коммит ${esc(short)}, выкачено ${esc(when)}</p>`;
}

function adminRunsFormatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: ADMIN_RUNS_MSK,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
    return `${get('day')}.${get('month')} ${get('hour')}:${get('minute')} МСК`;
  } catch (_) {
    return '—';
  }
}

function adminRunsProgress(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const total = list.length;
  if (!total) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  list.forEach((s) => {
    if (s.status === 'ok') done += 1;
  });
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

function adminRunsStepQueueHint(status, runStatus, stepIndex, steps) {
  if (status !== 'pending' || runStatus !== 'running') return '';
  const prev = steps.slice(0, stepIndex);
  const activeDone = prev.every((s) => s.status === 'ok');
  if (!activeDone) return 'в очереди';
  const hasRunning = steps.some((s) => s.status === 'running');
  if (!hasRunning && stepIndex > 0 && prev[prev.length - 1].status === 'ok') return 'в очереди';
  if (status === 'pending') return 'в очереди';
  return '';
}

function adminRunsDisplayTitle(run) {
  const title = (run.title || run.task || run.id || 'Задача').trim();
  const code = (run.taskCode || '').trim();
  if (!code) return esc(title);
  return `${esc(title)} <span class="admin-runs-task-code">${esc(code)}</span>`;
}

function adminRunsSummaryFields(run) {
  const s = run.summary && typeof run.summary === 'object' ? run.summary : {};
  const start = adminRunsFormatWhen(run.startedAt);
  const end = run.endedAt ? adminRunsFormatWhen(run.endedAt) : '…';
  const when = `${start}–${end}`;
  return {
    happened: (s.happened || '').trim(),
    why: (s.why || '').trim(),
    who: (s.who || '').trim(),
    when,
  };
}

function adminRunsRunHasQueuedSteps(run) {
  if (run.status !== 'running') return false;
  const steps = Array.isArray(run.steps) ? run.steps : [];
  if (!steps.length) return false;
  const hasRunning = steps.some((st) => st.status === 'running');
  const hasPending = steps.some((st) => st.status === 'pending');
  return hasPending && !hasRunning;
}

function adminRunsSortRank(run) {
  if (run.status === 'running') {
    return adminRunsRunHasQueuedSteps(run) ? 1 : 0;
  }
  if (run.status === 'fail') return 2;
  if (run.status === 'warn') return 3;
  if (run.status === 'ok') return 4;
  if (run.status === 'interrupted') return 6;
  if (run.status === 'rechecked') return 7;
  return 5;
}

function adminRunsSortRuns(runs) {
  return runs.slice().sort((a, b) => {
    const ra = adminRunsSortRank(a);
    const rb = adminRunsSortRank(b);
    if (ra !== rb) return ra - rb;
    const ta = String(a.startedAt || '');
    const tb = String(b.startedAt || '');
    if (tb !== ta) return tb.localeCompare(ta);
    const na = a.no != null ? a.no : 0;
    const nb = b.no != null ? b.no : 0;
    return nb - na;
  });
}

function adminRunsListPriorityStatus(status) {
  return status === 'fail' || status === 'warn' || status === 'running';
}

/** В списке всегда все fail/warn/running; остальные — не больше ADMIN_RUNS_LIST_LIMIT. */
function adminRunsLimitRunsForDisplay(sortedRuns, limit = ADMIN_RUNS_LIST_LIMIT) {
  const list = Array.isArray(sortedRuns) ? sortedRuns : [];
  let otherKept = 0;
  return list.filter((r) => {
    if (adminRunsListPriorityStatus(r.status)) return true;
    if (otherKept >= limit) return false;
    otherKept += 1;
    return true;
  });
}

function adminRunsFilterCounts(runs) {
  const list = Array.isArray(runs) ? runs : [];
  let inWork = 0;
  let errors = 0;
  let done = 0;
  let interrupted = 0;
  list.forEach((r) => {
    if (r.status === 'running') inWork += 1;
    if (r.status === 'fail' || r.status === 'warn') errors += 1;
    if (r.status === 'ok') done += 1;
    if (r.status === 'interrupted') interrupted += 1;
  });
  return { all: list.length, inWork, errors, done, interrupted };
}

function adminRunsScenarioKey(run) {
  const sid = run && run.scenarioId ? String(run.scenarioId).trim() : '';
  if (sid) return sid;
  const t = String((run && (run.task || run.id)) || '').trim();
  const m = t.match(/^(.+)\.(?:run\d+|[rw]\d+)$/i);
  return m ? m[1] : t;
}

function adminRunsHideDuringRecheck(run, allRuns) {
  if (!run || run.status !== 'rechecked') return false;
  const key = adminRunsScenarioKey(run);
  return (Array.isArray(allRuns) ? allRuns : []).some(
    (r) => adminRunsScenarioKey(r) === key && r.status === 'running',
  );
}

function adminRunsIsLatestScenarioRun(run, allRuns) {
  const key = adminRunsScenarioKey(run);
  const group = (Array.isArray(allRuns) ? allRuns : []).filter(
    (r) => adminRunsScenarioKey(r) === key,
  );
  if (!group.length) return true;
  let latest = group[0];
  group.forEach((r) => {
    const ta = String(r.startedAt || '');
    const tb = String(latest.startedAt || '');
    if (ta > tb) latest = r;
    else if (ta === tb && (r.no || 0) > (latest.no || 0)) latest = r;
  });
  return latest === run || (latest.id && latest.id === run.id);
}

function adminRunsFilterRun(run, filterId, allRuns) {
  const rid = String((run && (run.id || run.task)) || '').trim();
  if (adminRunsForceVisibleRunId && rid === adminRunsForceVisibleRunId) return true;
  if (adminRunsHideDuringRecheck(run, allRuns)) return false;
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'inWork') return run.status === 'running';
  if (filterId === 'errors') {
    return run.status === 'fail' || run.status === 'warn';
  }
  if (filterId === 'done') return run.status === 'ok';
  if (filterId === 'interrupted') return run.status === 'interrupted';
  return true;
}

function adminRunsLoadFilter() {
  try {
    const v = localStorage.getItem(ADMIN_RUNS_FILTER_KEY);
    if (v === 'inWork' || v === 'errors' || v === 'done' || v === 'interrupted' || v === 'all') return v;
  } catch (_) {
    /* ignore */
  }
  return 'all';
}

function adminRunsSaveFilter(filterId) {
  try {
    localStorage.setItem(ADMIN_RUNS_FILTER_KEY, filterId);
  } catch (_) {
    /* ignore */
  }
}

function adminRunsSummaryFieldsHtml(run) {
  const f = adminRunsSummaryFields(run);
  const rows = [];
  if (f.happened) rows.push(`<p class="admin-runs-kv"><span class="admin-runs-kv-label">Что произошло:</span> ${esc(f.happened)}</p>`);
  if (f.why) rows.push(`<p class="admin-runs-kv"><span class="admin-runs-kv-label">Зачем:</span> ${esc(f.why)}</p>`);
  if (f.when) rows.push(`<p class="admin-runs-kv"><span class="admin-runs-kv-label">Когда:</span> ${esc(f.when)}</p>`);
  if (f.who) rows.push(`<p class="admin-runs-kv"><span class="admin-runs-kv-label">Кто:</span> ${esc(f.who)}</p>`);
  if (!rows.length) return '';
  return `<div class="admin-runs-kv-block">${rows.join('')}</div>`;
}

function adminRunsBuildCopyText(run) {
  const no = run.no != null ? run.no : '—';
  const title = (run.title || run.task || run.id || 'Задача').trim();
  const code = (run.taskCode || run.task || '').trim();
  const codePart = code ? ` (${code})` : '';
  const start = adminRunsFormatWhen(run.startedAt);
  const end = run.endedAt ? adminRunsFormatWhen(run.endedAt) : '…';
  const prog = adminRunsProgress(run.steps);
  const desc = (run.description || '').trim();
  const sum = adminRunsSummaryFields(run);
  const lines = [
    `Прогон №${no} — ${title}${codePart}`,
    `${start} → ${end}`,
  ];
  if (sum.happened) lines.push(`Что произошло: ${sum.happened}`);
  if (sum.why) lines.push(`Зачем: ${sum.why}`);
  if (sum.when) lines.push(`Когда: ${sum.when}`);
  if (sum.who) lines.push(`Кто: ${sum.who}`);
  if (desc) lines.push(desc);
  lines.push('Шаги:');
  const steps = Array.isArray(run.steps) ? run.steps : [];
  steps.forEach((s, i) => {
    const icon = adminRunsStepIcon(s.status);
    const label = (s.title || `Шаг ${i + 1}`).trim();
    lines.push(`${icon} ${i + 1}. ${label}`);
  });
  lines.push(`Итог: ${prog.done} из ${prog.total}`);
  const wrong = Array.isArray(run.whatsWrong) ? run.whatsWrong : [];
  if (wrong.length) {
    lines.push('Что не так:');
    wrong.forEach((w) => {
      const code = (w.code || '').trim();
      const title = (w.title || '').trim();
      const head = code ? `${code}${title ? ` — ${title}` : ''}` : title || 'Замечание';
      const text = (w.text || '').trim();
      lines.push(`- ${head}${text ? `: ${text}` : ''}`);
    });
  }
  return lines.join('\n');
}

async function adminRunsCopyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    /* fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

function adminRunsShowCopiedToast() {
  let el = document.getElementById('admin-runs-copied-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-runs-copied-toast';
    el.className = 'admin-runs-copied-toast';
    el.textContent = 'Скопировано';
    document.body.appendChild(el);
  }
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function adminRunsCopyRun(run) {
  const text = adminRunsBuildCopyText(run);
  return adminRunsCopyText(text).then((ok) => {
    if (ok) adminRunsShowCopiedToast();
    return ok;
  });
}

function adminRunsClearLongPress() {
  if (adminRunsLongPressTimer) {
    clearTimeout(adminRunsLongPressTimer);
    adminRunsLongPressTimer = null;
  }
  adminRunsLongPressTarget = null;
  adminRunsLongPressStart = null;
}

function adminRunsBindLongPress(cardEl, run) {
  if (!cardEl || cardEl._runsLpBound) return;
  cardEl._runsLpBound = true;
  const start = (clientX, clientY) => {
    adminRunsClearLongPress();
    adminRunsLongPressTarget = run;
    adminRunsLongPressStart = { x: clientX, y: clientY };
    adminRunsLongPressTimer = setTimeout(() => {
      adminRunsCopyRun(run);
      adminRunsClearLongPress();
    }, ADMIN_RUNS_LONG_PRESS_MS);
  };
  const move = (clientX, clientY) => {
    if (!adminRunsLongPressStart) return;
    const dx = clientX - adminRunsLongPressStart.x;
    const dy = clientY - adminRunsLongPressStart.y;
    if (Math.hypot(dx, dy) > ADMIN_RUNS_LONG_PRESS_MOVE_PX) adminRunsClearLongPress();
  };
  cardEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.admin-runs-copy-btn')) return;
    start(e.clientX, e.clientY);
  });
  cardEl.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  cardEl.addEventListener('pointerup', () => adminRunsClearLongPress());
  cardEl.addEventListener('pointercancel', () => adminRunsClearLongPress());
  cardEl.addEventListener('pointerleave', () => adminRunsClearLongPress());
}

function adminRunsRecheckPrevHtml(run) {
  if (!run || !run.recheckInProgress) return '';
  const no = run.recheckPreviousRunNo;
  const prevId = (run.recheckPreviousRunId || '').trim();
  if (no == null && !prevId) return '';
  const label = no != null ? `прогон №${no}` : 'предыдущий запуск';
  return `<p class="hint admin-runs-recheck-prev">Перепроверка после ошибки: <button type="button" class="linkish admin-runs-show-prev" data-prev-run-id="${esc(prevId)}">${esc(label)}</button></p>`;
}

function adminRunsLinkHtml(run) {
  const commit = (run.commit || '').trim();
  if (commit) {
    const url = `https://github.com/laser-erp/armada-perevozki/commit/${encodeURIComponent(commit)}`;
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="admin-runs-commit">${esc(commit.slice(0, 12))}</a>`;
  }
  const report = (run.report || '').trim();
  if (report && report.startsWith('http')) {
    return `<a href="${esc(report)}" target="_blank" rel="noopener">Ссылка на отчёт</a>`;
  }
  return '';
}

function adminRunsWhatsWrongHtml(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const rows = list
    .map((w) => {
      const code = (w.code || '').trim();
      const title = (w.title || '').trim();
      const text = (w.text || '').trim();
      const head = code
        ? `<span class="admin-runs-wrong-code">${esc(code)}</span>${title ? ` ${esc(title)}` : ''}`
        : esc(title || 'Замечание');
      return `<li class="admin-runs-wrong-item">
        <div class="admin-runs-wrong-head">${head}</div>
        ${text ? `<p class="admin-runs-wrong-text">${esc(text)}</p>` : ''}
      </li>`;
    })
    .join('');
  return `<section class="admin-runs-wrong" aria-label="Что не так">
    <h4 class="admin-runs-wrong-title">Что не так</h4>
    <ul class="admin-runs-wrong-list">${rows}</ul>
  </section>`;
}

function adminRunsStepsHtml(steps, runStatus) {
  const list = Array.isArray(steps) ? steps : [];
  if (!list.length) {
    return '<p class="hint admin-runs-steps-empty">Шаги пока не зафиксированы</p>';
  }
  return `<ol class="admin-runs-steps">${list
    .map((s, i) => {
      const note = (s.note || '').trim();
      const when = s.at ? adminRunsFormatWhen(s.at) : '';
      const queue = adminRunsStepQueueHint(s.status, runStatus, i, list);
      const expected = Array.isArray(s.expectedArtifacts) ? s.expectedArtifacts : [];
      const waiting = Array.isArray(s.waitingArtifacts) ? s.waitingArtifacts : [];
      const artHint = expected.length
        ? `артефакты: ${expected.join(', ')}`
        : '';
      const waitHint = waiting.length ? `ожидает: ${waiting.join(', ')}` : '';
      const metaParts = [when, queue, waitHint, artHint, note].filter(Boolean);
      const meta = metaParts.join(' · ');
      const num = i + 1;
      const code = (s.code || '').trim();
      const title = (s.title || 'Шаг').trim();
      const titleHtml = code
        ? `<span class="admin-runs-step-code">${esc(code)}</span> ${esc(title)}`
        : esc(title);
      return `<li class="admin-runs-step admin-runs-step--${esc(s.status || 'pending')}">
        <span class="admin-runs-step-icon" aria-hidden="true">${adminRunsStepIcon(s.status)}</span>
        <span class="admin-runs-step-body">
          <span class="admin-runs-step-title">${num}. ${titleHtml}</span>
          ${meta ? `<span class="hint admin-runs-step-meta">${esc(meta)}</span>` : ''}
        </span>
      </li>`;
    })
    .join('')}</ol>`;
}

function adminRunsCardHtml(run) {
  const no = run.no != null ? run.no : '—';
  const desc = (run.description || '').trim();
  const prog = adminRunsProgress(run.steps);
  const barPct = prog.total ? Math.max(prog.pct, run.status === 'running' ? 8 : 0) : 0;
  const openAttr =
    run.status === 'running' ||
    (run.status === 'interrupted' && !adminRunsCollapseInterruptedDefault())
      ? ' open'
      : '';
  const link = adminRunsLinkHtml(run);
  const lastEv = (run.lastEvent || '').trim();
  const idx = run._listIndex != null ? run._listIndex : 0;
  const isRechecked = run.status === 'rechecked';
  const showWrong = (run.status === 'fail' || run.status === 'warn') && !isRechecked;
  const wrongHtml = showWrong ? adminRunsWhatsWrongHtml(run.whatsWrong) : '';
  const statusNote = (run.statusNote || '').trim();
  const kvHtml = isRechecked ? '' : adminRunsSummaryFieldsHtml(run);
  const recheckedClass = isRechecked ? ' admin-runs-card--rechecked' : '';
  const recheckPrevHtml = adminRunsRecheckPrevHtml(run);
  const runDomId = (run.id || run.task || '').trim();

  return `<details class="admin-runs-card${recheckedClass}" data-run-index="${esc(String(idx))}" data-run-id="${esc(runDomId)}"${openAttr}>
    <summary class="admin-runs-summary">
      <button type="button" class="admin-runs-copy-btn" title="Копировать" aria-label="Копировать прогон">⎘</button>
      <div class="admin-runs-summary-main">
        <span class="admin-runs-run-icon" aria-hidden="true">${adminRunsRunIcon(run.status)}</span>
        <div>
          <div class="admin-runs-card-title">Прогон №${esc(String(no))} · ${adminRunsDisplayTitle(run)}</div>
          ${desc && !isRechecked ? `<div class="hint admin-runs-card-desc">${esc(desc)}</div>` : ''}
          ${recheckPrevHtml}
          ${kvHtml}
          ${isRechecked ? '' : `<div class="admin-runs-summary-steps">${adminRunsStepsHtml(run.steps, run.status)}</div>`}
          ${wrongHtml}
        </div>
      </div>
      <div class="admin-runs-summary-meta">
        <span class="admin-runs-pill admin-runs-pill--${esc(run.status || 'running')}">${esc(adminRunsStatusLabel(run.status, statusNote, run))}</span>
        <span class="hint">${esc(adminRunsFormatWhen(run.startedAt))}${run.endedAt ? ` → ${esc(adminRunsFormatWhen(run.endedAt))}` : ''}</span>
      </div>
    </summary>
    <div class="admin-runs-card-body">
      ${
        prog.total
          ? `<div class="admin-runs-progress-wrap">
        <div class="hint admin-runs-progress-label">${esc(String(prog.done))} из ${esc(String(prog.total))}</div>
        <div class="admin-runs-progress" role="progressbar" aria-valuenow="${esc(String(barPct))}" aria-valuemin="0" aria-valuemax="100">
          <div class="admin-runs-progress-bar" style="width:${esc(String(barPct))}%"></div>
        </div>
      </div>`
          : ''
      }
      ${lastEv ? `<p class="hint admin-runs-last-event">Последнее событие: ${esc(lastEv)}</p>` : ''}
      ${link ? `<p class="hint">Коммит: ${link}</p>` : ''}
    </div>
  </details>`;
}

function adminRunsParseRunFromCard(cardEl) {
  if (!cardEl) return null;
  const idx = parseInt(cardEl.getAttribute('data-run-index') || '', 10);
  if (Number.isNaN(idx) || idx < 0 || idx >= adminRunsLastRuns.length) return null;
  return adminRunsLastRuns[idx];
}

function adminRunsRevealPreviousRun(prevRunId) {
  const id = (prevRunId || '').trim();
  if (!id) return;
  adminRunsForceVisibleRunId = id;
  adminRunsSaveFilter('all');
  const form = $('runs-form');
  const data = { runs: adminRunsFullRuns };
  renderAdminRunsList(data);
  const card = form && form.querySelector(`.admin-runs-card[data-run-id="${CSS.escape(id)}"]`);
  if (card) {
    card.open = true;
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    card.classList.add('admin-runs-card--highlight');
    setTimeout(() => card.classList.remove('admin-runs-card--highlight'), 2400);
  }
}

function adminRunsBindListInteractions(form) {
  if (!form) return;
  form.querySelectorAll('.admin-runs-show-prev').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      adminRunsRevealPreviousRun(btn.getAttribute('data-prev-run-id'));
    };
  });
  form.querySelectorAll('.admin-runs-card').forEach((card) => {
    const run = adminRunsParseRunFromCard(card);
    if (run) adminRunsBindLongPress(card, run);
    const btn = card.querySelector('.admin-runs-copy-btn');
    if (btn && run) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        adminRunsCopyRun(run);
      };
    }
  });
}

function stopAdminRunsPoll() {
  if (adminRunsPollTimer) {
    clearInterval(adminRunsPollTimer);
    adminRunsPollTimer = null;
  }
}

function startAdminRunsPoll() {
  stopAdminRunsPoll();
  adminRunsPollTimer = setInterval(() => {
    if (typeof renderAdminRuns === 'function') renderAdminRuns(false);
  }, 30000);
}

async function fetchAdminRunsStatus() {
  const url = `/runs/status.json?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`код ${res.status}`);
  return res.json();
}

function adminRunsCollapseInterruptedDefault() {
  try {
    const v = localStorage.getItem(ADMIN_RUNS_COLLAPSE_INTERRUPTED_KEY);
    if (v === '0') return false;
  } catch (_) {
    /* ignore */
  }
  return true;
}

function adminRunsDataIsStale(updatedAtIso) {
  if (!updatedAtIso) return true;
  try {
    const d = new Date(updatedAtIso);
    if (Number.isNaN(d.getTime())) return true;
    return Date.now() - d.getTime() > ADMIN_RUNS_STALE_MS;
  } catch (_) {
    return true;
  }
}

function adminRunsFormatDateShort(isoOrDate) {
  const s = String(isoOrDate || '').trim();
  if (!s) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const p = s.split('-');
    return `${p[2]}.${p[1]}.${p[0]}`;
  }
  return adminRunsFormatWhen(s);
}

function adminRunsTaskIsDone(status) {
  const s = String(status || '').toLowerCase();
  return /готов|закрыт|сделан|выполнен|done|ok на/.test(s);
}

function adminRunsTaskIsInWork(status) {
  if (!String(status || '').trim()) return true;
  return !adminRunsTaskIsDone(status);
}

function adminRunsChecklistStepIcon(state) {
  if (state === 'done') return '✓';
  if (state === 'active') return '▶';
  return '○';
}

function adminRunsFormatRelativeRu(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 0) return 'только что';
    if (sec < 45) return 'только что';
    if (sec < 90) return '1 мин назад';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} мин назад`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч назад`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} дн назад`;
    return adminRunsFormatDateShort(iso);
  } catch (_) {
    return '';
  }
}

function adminRunsTaskChecklistProgressHtml(prog) {
  const total = prog && prog.total != null ? Number(prog.total) : 0;
  if (!total) return '';
  const done = prog && prog.done != null ? Number(prog.done) : 0;
  const label = (prog && prog.progressText) || `${done} из ${total}`;
  const barPct = Math.min(100, Math.round((done / total) * 100));
  return `<div class="admin-runs-progress-wrap admin-runs-task-progress">
    <div class="hint admin-runs-progress-label">${esc(String(label))}</div>
    <div class="admin-runs-progress" role="progressbar" aria-valuenow="${esc(String(barPct))}" aria-valuemin="0" aria-valuemax="100">
      <div class="admin-runs-progress-bar" style="width:${esc(String(barPct))}%"></div>
    </div>
  </div>`;
}

function adminRunsTaskChecklistStepsHtml(steps) {
  const list = Array.isArray(steps) ? steps : [];
  if (!list.length) return '';
  const rows = list
    .map((s) => {
      const st = (s.state || 'pending').trim();
      const text = (s.text || '').trim();
      return `<li class="admin-runs-step admin-runs-task-step admin-runs-task-step--${esc(st)}">
        <span class="admin-runs-step-icon" aria-hidden="true">${adminRunsChecklistStepIcon(st)}</span>
        <span class="admin-runs-step-title">${esc(text)}</span>
      </li>`;
    })
    .join('');
  return `<ol class="admin-runs-steps admin-runs-task-steps">${rows}</ol>`;
}

function adminRunsCursorAgentStatusLabel(status, data, agent) {
  const st = String(status || '').toUpperCase();
  const stale = !!(data && data.agentsLiveStale);
  const atIso = (data && (data.agentsLiveAt || data.agentsLiveCheckedAt)) || '';
  const atWhen = adminRunsFormatWhen(atIso);
  if (stale && (st === 'RUNNING' || st === 'CREATING')) {
    return atWhen ? `работал на ${atWhen}` : 'работал ранее';
  }
  if (st === 'RUNNING' || st === 'CREATING') return 'работает';
  if (st === 'FINISHED') return 'закончил';
  if (st === 'ERROR' || st === 'FAILED') return 'ошибка';
  return st ? st.toLowerCase() : '—';
}

function adminRunsCursorAgentsUpdatedHintHtml(data) {
  const atIso = (data && (data.agentsLiveAt || data.agentsLiveCheckedAt)) || '';
  const rel = adminRunsFormatRelativeRu(atIso);
  if (!rel) return '';
  const stale = !!(data && data.agentsLiveStale);
  const staleNote = (data && data.agentsLiveStaleNote) || '';
  if (stale) {
    const when = staleNote.replace(/^данные на\s*/i, '').trim() || adminRunsFormatWhen(atIso);
    return `<p class="hint admin-runs-agents-stale" role="status">данные на ${esc(when)}</p>`;
  }
  return `<p class="hint admin-runs-agents-updated">обновлено ${esc(rel)}</p>`;
}

function adminRunsNowIsFresh(iso) {
  if (!iso) return false;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return Date.now() - d.getTime() <= ADMIN_RUNS_NOW_FRESH_MS;
  } catch (_) {
    return false;
  }
}

function adminRunsTaskProgressShort(task) {
  const p = task && task.checklistProgress;
  if (!p || p.total == null) return '';
  const total = Number(p.total) || 0;
  if (!total) return '';
  const done = p.done != null ? Number(p.done) : 0;
  return `${done} из ${total}`;
}

function adminRunsTasksWorkingNowHtml(tasks) {
  const list = (Array.isArray(tasks) ? tasks : []).filter(
    (t) => t && t.now && !adminRunsTaskIsDone(t.status),
  );
  if (!list.length) {
    return '<p class="hint admin-runs-empty-section">Сейчас никто не отчитывается по строке «Сейчас» в ТЗ.</p>';
  }
  list.sort((a, b) => String(b.nowAt || '').localeCompare(String(a.nowAt || '')));
  const rows = list
    .map((t) => {
      const title = (t.title || t.id || 'Задача').trim();
      const nowText = String(t.now || '').trim();
      const fresh = adminRunsNowIsFresh(t.nowAt);
      const rel = adminRunsFormatRelativeRu(t.nowAt);
      const msk = (t.nowMsk || '').trim();
      const when = msk || adminRunsFormatWhen(t.nowAt);
      const timeLine = fresh
        ? (rel ? `обновлено ${rel}` : 'обновлено недавно')
        : `давно не отчитывался (${when})`;
      const prog = adminRunsTaskProgressShort(t);
      const progHtml = prog
        ? `<span class="admin-runs-meta-chip admin-runs-now-progress">${esc(prog)}</span>`
        : '';
      const url = (t.agentUrl || '').trim();
      const chat = url
        ? `<a class="admin-runs-agent-chat" href="${esc(url)}" target="_blank" rel="noopener noreferrer">чат агента</a>`
        : '';
      const rowCls = fresh ? 'admin-runs-now-row' : 'admin-runs-now-row admin-runs-now-row--stale';
      return `<article class="${rowCls}">
        <div class="admin-runs-now-title">${esc(title)}</div>
        <p class="admin-runs-now-text">Сейчас: ${esc(nowText)}</p>
        <div class="admin-runs-now-meta">
          <span class="hint admin-runs-now-time">${esc(timeLine)}</span>
          ${progHtml}
          ${chat}
        </div>
      </article>`;
    })
    .join('');
  return `<div class="admin-runs-now-list">${rows}</div>`;
}

function adminRunsCursorAgentsSectionHtml(data) {
  if (!data || !data.agentsLiveLive) return '';
  return `<section class="admin-runs-section" aria-labelledby="admin-runs-cursor-agents-heading">
      <h2 class="admin-runs-section-title" id="admin-runs-cursor-agents-heading">Агенты Cursor</h2>
      <p class="cat-panel-hint">Дополнительно из agents-live.json (если файл свежий).</p>
      ${adminRunsCursorAgentsBlockHtml(data)}
    </section>`;
}

function adminRunsCursorAgentsBlockHtml(data) {
  const agents = data && Array.isArray(data.agentsLive) ? data.agentsLive : [];
  if (!agents.length) {
    return '<p class="hint admin-runs-empty-section">Агенты Cursor: список пуст.</p>';
  }
  const updatedHint = adminRunsCursorAgentsUpdatedHintHtml(data);
  const stale = !!(data && data.agentsLiveStale);
  const rows = agents
    .map((a) => {
      const name = (a.name || a.id || 'Агент').trim();
      const status = adminRunsCursorAgentStatusLabel(a.status, data, a);
      const branch = (a.branch || '—').trim();
      const rel = adminRunsFormatRelativeRu(a.createdAt);
      const ago = rel ? `${rel}` : '—';
      const url = (a.url || '').trim();
      const chat = url
        ? `<a class="admin-runs-agent-chat" href="${esc(url)}" target="_blank" rel="noopener noreferrer">открыть чат</a>`
        : '<span class="hint">нет ссылки</span>';
      const st = String(a.status || '').toUpperCase();
      const showMsg = !stale && (st === 'RUNNING' || st === 'CREATING');
      const lastMsg = showMsg && a.lastMessage ? String(a.lastMessage).trim() : '';
      const msgHtml = lastMsg
        ? `<p class="hint admin-runs-agent-lastmsg">${esc(lastMsg)}</p>`
        : '';
      return `<article class="admin-runs-agent-row">
        <div class="admin-runs-agent-title">${esc(name)}</div>
        <div class="admin-runs-agent-meta">
          <span class="admin-runs-pill admin-runs-pill--agent">${esc(status)}</span>
          <span class="admin-runs-meta-chip">${esc(branch)}</span>
          <span class="hint">начат ${esc(ago)}</span>
          ${chat}
        </div>
        ${msgHtml}
      </article>`;
    })
    .join('');
  return `${updatedHint}<div class="admin-runs-agents-list">${rows}</div>`;
}

function adminRunsTaskBranchOnlyBadgeHtml(task) {
  if (!task || !task.inBranchOnly) return '';
  const src = task.checklistSource && typeof task.checklistSource === 'object' ? task.checklistSource : null;
  const branch = ((src && src.branch) || '').trim();
  const atIso = (src && src.at) || task.checklistUpdatedAt || '';
  const rel = adminRunsFormatRelativeRu(atIso);
  const branchLabel = branch || 'ветка';
  const timeHint = rel ? ` · ${rel}` : '';
  return `<span class="admin-runs-pill admin-runs-pill--branch-only" title="Чек-лист из ветки агента, ещё не в cursor/develop на staging">в ветке ${esc(branchLabel)}, ещё не на staging${esc(timeHint)}</span>`;
}

function adminRunsTaskChecklistBlockHtml(task) {
  const steps = Array.isArray(task.checklistSteps) ? task.checklistSteps : [];
  if (!steps.length) return '';
  const prog = task.checklistProgress || {};
  const progressHtml = adminRunsTaskChecklistProgressHtml(prog);
  const stepsHtml = adminRunsTaskChecklistStepsHtml(steps);
  const src = task.checklistSource && typeof task.checklistSource === 'object' ? task.checklistSource : null;
  const updatedIso =
    task.inBranchOnly && src && src.at ? src.at : task.checklistUpdatedAt;
  const rel = adminRunsFormatRelativeRu(updatedIso);
  const updatedHtml = rel
    ? `<p class="hint admin-runs-checklist-updated">обновлено ${esc(rel)}</p>`
    : '';
  const inWork = adminRunsTaskIsInWork(task.status);
  const openAttr = inWork ? ' open' : '';
  const summaryLabel = (prog.progressText && String(prog.progressText).trim()) || 'Шаги';
  return `${progressHtml}
    <details class="admin-runs-task-checklist"${openAttr}>
      <summary class="admin-runs-task-checklist-summary">Чек-лист: ${esc(summaryLabel)}</summary>
      <div class="admin-runs-task-checklist-body">
        ${stepsHtml}
        ${updatedHtml}
      </div>
    </details>`;
}

function adminRunsLoadTasksFilter() {
  try {
    const v = localStorage.getItem(ADMIN_RUNS_TASKS_FILTER_KEY);
    if (v === 'inWork' || v === 'done') return v;
  } catch (_) {
    /* ignore */
  }
  return 'inWork';
}

function adminRunsSaveTasksFilter(filterId) {
  try {
    localStorage.setItem(ADMIN_RUNS_TASKS_FILTER_KEY, filterId);
  } catch (_) {
    /* ignore */
  }
}

function adminRunsTasksFilterHtml(tasks, activeFilter) {
  const list = Array.isArray(tasks) ? tasks : [];
  let inWork = 0;
  let done = 0;
  list.forEach((t) => {
    if (adminRunsTaskIsDone(t.status)) done += 1;
    else inWork += 1;
  });
  const tabs = [
    { id: 'inWork', label: 'В работе', n: inWork },
    { id: 'done', label: 'Готово', n: done },
  ];
  const btns = tabs
    .map((t) => {
      const on = t.id === activeFilter ? ' admin-runs-filter-btn--active' : '';
      return `<button type="button" class="admin-runs-filter-btn${on}" data-tasks-filter="${esc(t.id)}">${esc(t.label)} (${esc(String(t.n))})</button>`;
    })
    .join('');
  return `<div class="admin-runs-filters" role="tablist" aria-label="Фильтр задач">${btns}</div>`;
}

function adminRunsTasksListHtml(tasks, activeFilter) {
  const list = (Array.isArray(tasks) ? tasks : []).filter((t) => {
    if (activeFilter === 'done') return adminRunsTaskIsDone(t.status);
    return adminRunsTaskIsInWork(t.status);
  });
  if (!list.length) {
    return '<p class="hint admin-runs-empty-section">По этому фильтру задач нет.</p>';
  }
  const rows = list
    .map((t) => {
      const title = (t.title || t.id || 'Задача').trim();
      const status = (t.status || '—').trim();
      const executor = (t.executor || '').trim();
      const date = adminRunsFormatDateShort(t.date);
      const execHtml = executor
        ? `<span class="admin-runs-meta-chip">${esc(executor)}</span>`
        : '';
      const deployHtml = adminRunsDeployLabelHtml(t);
      const branchOnlyHtml = adminRunsTaskBranchOnlyBadgeHtml(t);
      const agentUrl = (t.agentUrl || '').trim();
      const agentChatHtml = agentUrl
        ? `<a class="admin-runs-task-agent-chat" href="${esc(agentUrl)}" target="_blank" rel="noopener noreferrer">чат агента</a>`
        : '';
      const checklistHtml = adminRunsTaskChecklistBlockHtml(t);
      return `<article class="admin-runs-doc-row">
        <div class="admin-runs-doc-title">${esc(title)}</div>
        <div class="admin-runs-doc-meta">
          <span class="admin-runs-pill admin-runs-pill--doc">${esc(status)}</span>
          ${branchOnlyHtml}
          ${deployHtml}
          ${execHtml}
          <span class="hint admin-runs-doc-date">${esc(date)}</span>
          ${agentChatHtml}
        </div>
        ${checklistHtml}
      </article>`;
    })
    .join('');
  return `<div class="admin-runs-doc-list">${rows}</div>`;
}

function adminRunsBugsListHtml(bugs, openCount) {
  const list = Array.isArray(bugs) ? bugs : [];
  const head = `<p class="admin-runs-bugs-open">Открытых багов: <strong>${esc(String(openCount != null ? openCount : 0))}</strong></p>`;
  if (!list.length) {
    return `${head}<p class="hint admin-runs-empty-section">Записей в docs/bugs пока нет.</p>`;
  }
  const rows = list
    .map((b) => {
      const title = (b.title || b.id || 'Баг').trim();
      const status = (b.status || '—').trim();
      const date = adminRunsFormatDateShort(b.date);
      const link = (b.link || '').trim();
      const titleHtml = link
        ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="admin-runs-doc-link">${esc(title)}</a>`
        : esc(title);
      const deployHtml = adminRunsDeployLabelHtml(b);
      return `<article class="admin-runs-doc-row">
        <div class="admin-runs-doc-title">${titleHtml}</div>
        <div class="admin-runs-doc-meta">
          <span class="admin-runs-pill admin-runs-pill--doc">${esc(status)}</span>
          ${deployHtml}
          <span class="hint admin-runs-doc-date">${esc(date)}</span>
        </div>
      </article>`;
    })
    .join('');
  return `${head}<div class="admin-runs-doc-list">${rows}</div>`;
}

function adminRunsFilterToolbarHtml(counts, activeFilter) {
  const tabs = [
    { id: 'all', label: 'Все', n: counts.all },
    { id: 'inWork', label: 'В работе', n: counts.inWork },
    { id: 'errors', label: 'С ошибками', n: counts.errors },
    { id: 'done', label: 'Завершённые', n: counts.done },
    { id: 'interrupted', label: 'Прерванные', n: counts.interrupted },
  ];
  const btns = tabs
    .map((t) => {
      const on = t.id === activeFilter ? ' admin-runs-filter-btn--active' : '';
      return `<button type="button" class="admin-runs-filter-btn${on}" data-runs-filter="${esc(t.id)}">${esc(t.label)} (${esc(String(t.n))})</button>`;
    })
    .join('');
  return `<div class="admin-runs-filters" role="tablist" aria-label="Фильтр прогонов">${btns}</div>`;
}

function renderAdminRunsList(data) {
  const form = $('runs-form');
  if (!form) return;
  const scrollY = window.scrollY;
  const rawRuns = data && Array.isArray(data.runs) ? data.runs : [];
  const tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
  const bugs = data && Array.isArray(data.bugs) ? data.bugs : [];
  const bugsOpen =
    data && data.bugsOpenCount != null ? data.bugsOpenCount : bugs.filter((b) => {
      const s = String(b.status || '').toLowerCase();
      if (s.includes('исправлен') || s.includes('не баг')) return false;
      return s.includes('открыт') || s.includes('в работе');
    }).length;
  adminRunsFullRuns = rawRuns;
  const sortedRuns = adminRunsSortRuns(rawRuns);
  const allRuns = adminRunsLimitRunsForDisplay(sortedRuns);
  const activeFilter = adminRunsLoadFilter();
  const tasksFilter = adminRunsLoadTasksFilter();
  const counts = adminRunsFilterCounts(rawRuns);
  const runs = allRuns.filter((r) => adminRunsFilterRun(r, activeFilter, allRuns));
  const updatedIso = data && data.updatedAt ? data.updatedAt : '';
  const updated = updatedIso ? adminRunsFormatWhen(updatedIso) : '—';
  const stale = adminRunsDataIsStale(updatedIso);
  const staleBanner = stale
    ? '<div class="admin-runs-stale-banner" role="status">Данные устарели</div>'
    : '';
  const stagingBanner = adminRunsStagingDeployBannerHtml(data && data.stagingDeploy);
  const autoLoop = (data && data.autoLoopLastLine) ? String(data.autoLoopLastLine).trim() : '';
  runs.forEach((run, i) => {
    run._listIndex = i;
  });
  adminRunsLastRuns = runs;
  const rows = runs.length
    ? runs.map((run) => adminRunsCardHtml(run)).join('')
    : '<div class="empty">По этому фильтру прогонов нет. Выберите «Все» или обновите список.</div>';
  form.innerHTML = `
    <div class="admin-runs-updated-block">
      ${staleBanner}
      ${stagingBanner}
      <p class="admin-runs-updated-large" id="runs-updated-at">Обновлено: ${esc(updated)}</p>
      <div class="row admin-runs-toolbar-row">
        <button type="button" class="secondary" id="runs-refresh">Обновить</button>
        <span class="hint">Автообновление каждые 30 с · прогоны на сервере ~раз в минуту</span>
      </div>
    </div>
    <section class="admin-runs-section" aria-labelledby="admin-runs-working-now-heading">
      <h2 class="admin-runs-section-title" id="admin-runs-working-now-heading">Сейчас работают</h2>
      <p class="cat-panel-hint">По строке «Сейчас» в docs/tasks (обновление раз в 1–2 мин).</p>
      ${adminRunsTasksWorkingNowHtml(tasks)}
    </section>
    <section class="admin-runs-section" aria-labelledby="admin-runs-tasks-heading">
      <h2 class="admin-runs-section-title" id="admin-runs-tasks-heading">Задачи</h2>
      <p class="cat-panel-hint">Из docs/tasks — статус по строке «Статус» в файле.</p>
      ${adminRunsTasksFilterHtml(tasks, tasksFilter)}
      ${adminRunsTasksListHtml(tasks, tasksFilter)}
    </section>
    <section class="admin-runs-section" aria-labelledby="admin-runs-runs-heading">
      <h2 class="admin-runs-section-title" id="admin-runs-runs-heading">Прогоны и сценарии</h2>
      <p class="hint admin-runs-longpress-hint">Долгое нажатие на прогон — копировать</p>
      ${adminRunsFilterToolbarHtml(counts, activeFilter)}
      ${autoLoop ? `<p class="hint admin-runs-autoloop">Автоцикл: ${esc(autoLoop)}</p>` : ''}
      <div class="admin-runs-list">${rows}</div>
    </section>
    <section class="admin-runs-section" aria-labelledby="admin-runs-bugs-heading">
      <h2 class="admin-runs-section-title" id="admin-runs-bugs-heading">Баги</h2>
      ${adminRunsBugsListHtml(bugs, bugsOpen)}
    </section>
    ${adminRunsCursorAgentsSectionHtml(data)}`;
  adminRunsBindListInteractions(form);
  window.scrollTo(0, scrollY);
  form.querySelectorAll('[data-runs-filter]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-runs-filter') || 'all';
      adminRunsSaveFilter(id);
      renderAdminRunsList(data);
    };
  });
  form.querySelectorAll('[data-tasks-filter]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-tasks-filter') || 'inWork';
      adminRunsSaveTasksFilter(id);
      renderAdminRunsList(data);
    };
  });
  const refreshBtn = $('runs-refresh');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      if (typeof renderAdminRuns === 'function') renderAdminRuns(true);
    };
  }
}

async function renderAdminRuns(showLoading) {
  const form = $('runs-form');
  if (!form) return;
  if (showLoading) {
    form.innerHTML = '<p class="cat-panel-hint">Загрузка…</p>';
  }
  try {
    const data = await fetchAdminRunsStatus();
    if (!data) {
      renderAdminRunsList({ runs: [] });
      return;
    }
    renderAdminRunsList(data);
  } catch (e) {
    const msg = e && e.message ? e.message : 'неизвестная ошибка';
    form.innerHTML = `<div class="empty">Не удалось загрузить данные прогонов</div>
      <p class="meta">${esc(msg)}</p>
      <button type="button" class="secondary" id="runs-refresh">Обновить</button>`;
    const refreshBtn = $('runs-refresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        if (typeof renderAdminRuns === 'function') renderAdminRuns(true);
      };
    }
  }
}

function openAdminRuns() {
  if (typeof isSuperAdmin !== 'function' || !isSuperAdmin()) {
    alert('Доступно только суперадмину');
    return;
  }
  stopAdminRunsPoll();
  renderAdminRuns(true);
  startAdminRunsPoll();
  show('admin-runs-screen');
  const back = $('runs-back');
  if (back) {
    back.onclick = () => {
      stopAdminRunsPoll();
      show('admin');
      if (typeof renderAdmin === 'function') renderAdmin();
    };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__adminRunsBuildCopyText = adminRunsBuildCopyText;
  globalThis.__adminRunsProgress = adminRunsProgress;
  globalThis.__adminRunsSortRuns = adminRunsSortRuns;
  globalThis.__adminRunsLimitRunsForDisplay = adminRunsLimitRunsForDisplay;
  globalThis.__adminRunsFilterCounts = adminRunsFilterCounts;
  globalThis.__adminRunsFilterRun = adminRunsFilterRun;
  globalThis.__adminRunsHideDuringRecheck = adminRunsHideDuringRecheck;
  globalThis.__adminRunsScenarioKey = adminRunsScenarioKey;
  globalThis.__adminRunsStepsHtml = adminRunsStepsHtml;
}
