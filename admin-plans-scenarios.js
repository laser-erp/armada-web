/** Сценарии тестового мира во вкладке «Планы» — цепочки и статусы из /runs/status.json */
let adminPlansScenariosCache = null;

function plansScenarioChainsUrl() {
  const build = typeof APP_BUILD === 'string' ? APP_BUILD : '';
  return '/plans/scenario-chains.json' + (build ? '?v=' + encodeURIComponent(build) : '');
}

function plansScenarioStatusUrl() {
  return '/runs/status.json?t=' + Date.now();
}

function plansScenarioRunKey(run) {
  if (typeof globalThis.__adminRunsScenarioKey === 'function') {
    return globalThis.__adminRunsScenarioKey(run);
  }
  const sid = run && run.scenarioId ? String(run.scenarioId).trim() : '';
  if (sid) return sid;
  const t = String((run && (run.task || run.id)) || '').trim();
  const m = t.match(/^(.+)\.(?:run\d+|[rw]\d+)$/i);
  return m ? m[1] : t;
}

function plansScenarioFormatWhen(iso) {
  if (typeof globalThis.adminRunsFormatWhen === 'function') {
    return globalThis.adminRunsFormatWhen(iso);
  }
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
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

function plansScenarioUiFromRunStatus(status, statusNote, waitingDecision) {
  if (waitingDecision) {
    return { key: 'waiting', label: 'ждёт решения', icon: '⏸' };
  }
  if (status === 'ok') return { key: 'passed', label: 'пройден', icon: '✅' };
  if (status === 'fail') return { key: 'fail', label: 'красный', icon: '❌' };
  if (status === 'warn') return { key: 'fail', label: 'красный', icon: '⚠️' };
  if (status === 'running') return { key: 'running', label: 'в работе', icon: '⏳' };
  if (status === 'interrupted') return { key: 'fail', label: 'красный', icon: '⏹' };
  if (status === 'rechecked') return { key: 'passed', label: 'пройден', icon: '↪' };
  if (statusNote && /заблок|блокир/i.test(statusNote)) {
    return { key: 'waiting', label: 'ждёт решения', icon: '⏸' };
  }
  return { key: 'not_run', label: 'не запускался', icon: '○' };
}

function plansScenarioLatestRuns(runs) {
  const list = Array.isArray(runs) ? runs : [];
  const byKey = new Map();
  list.forEach((run) => {
    const key = String(plansScenarioRunKey(run) || '').trim().toLowerCase();
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, run);
      return;
    }
    const ta = String(run.startedAt || '');
    const tb = String(prev.startedAt || '');
    if (ta > tb || (ta === tb && (run.no || 0) > (prev.no || 0))) {
      byKey.set(key, run);
    }
  });
  return byKey;
}

function plansScenarioMatchRunStep(run, stepDef) {
  const codes = Array.isArray(stepDef.runStepCodes) ? stepDef.runStepCodes : [];
  const steps = Array.isArray(run.steps) ? run.steps : [];
  if (!codes.length) return null;
  const norm = (c) => String(c || '').trim().toUpperCase();
  const want = new Set(codes.map(norm));
  for (const s of steps) {
    const sc = norm(s.code);
    if (want.has(sc)) return s;
    for (const w of want) {
      if (sc && (sc.startsWith(w) || w.startsWith(sc))) return s;
    }
  }
  return null;
}

function plansScenarioResolveStep(stepDef, latestByTask) {
  const waiting = !!stepDef.waitingDecision;
  const tasks = Array.isArray(stepDef.runTasks) ? stepDef.runTasks : [];
  let bestRun = null;
  let bestStep = null;
  tasks.forEach((tid) => {
    const run = latestByTask.get(String(tid).trim().toLowerCase());
    if (!run) return;
    const matched = plansScenarioMatchRunStep(run, stepDef);
    if (!bestRun) {
      bestRun = run;
      bestStep = matched;
      return;
    }
    const ta = String(run.startedAt || '');
    const tb = String(bestRun.startedAt || '');
    if (ta > tb) {
      bestRun = run;
      bestStep = matched;
    }
  });
  if (!bestRun) {
    const ui = plansScenarioUiFromRunStatus(null, null, waiting);
    return {
      ui,
      run: null,
      runStep: null,
      when: '—',
      runLabel: '',
    };
  }
  const st = bestStep ? bestStep.status : bestRun.status;
  const note = bestStep ? bestStep.statusNote : bestRun.statusNote;
  const ui = plansScenarioUiFromRunStatus(st, note, waiting && st !== 'ok');
  const when = plansScenarioFormatWhen(bestRun.endedAt || bestRun.startedAt);
  const runLabel = bestRun.no != null ? `прогон №${bestRun.no}` : (bestRun.id || '');
  return { ui, run: bestRun, runStep: bestStep, when, runLabel };
}

function plansScenarioResolveChain(chain, latestByTask) {
  const steps = Array.isArray(chain.steps) ? chain.steps : [];
  const resolved = steps.map((s) => ({
    def: s,
    status: plansScenarioResolveStep(s, latestByTask),
  }));
  const rank = { fail: 4, waiting: 3, running: 2, not_run: 1, passed: 0 };
  let chainUi = { key: 'not_run', label: 'не запускался', icon: '○' };
  let chainWhen = '—';
  let chainRunLabel = '';
  resolved.forEach(({ status }) => {
    const r = rank[status.ui.key] ?? 0;
    const cr = rank[chainUi.key] ?? 0;
    if (r > cr) {
      chainUi = status.ui;
      chainWhen = status.when;
      chainRunLabel = status.runLabel;
    } else if (r === cr && status.when > chainWhen) {
      chainWhen = status.when;
      chainRunLabel = status.runLabel || chainRunLabel;
    }
  });
  if (resolved.length && resolved.every((x) => x.status.ui.key === 'passed')) {
    chainUi = { key: 'passed', label: 'пройден', icon: '✅' };
    const last = resolved[resolved.length - 1].status;
    chainWhen = last.when;
    chainRunLabel = last.runLabel;
  }
  return { steps: resolved, chainUi, chainWhen, chainRunLabel };
}

function plansScenarioCountByParticipant(chains) {
  const out = {};
  (chains || []).forEach((ch) => {
    (ch.participants || []).forEach((p) => {
      out[p] = (out[p] || 0) + 1;
    });
  });
  return out;
}

function plansScenarioChecksHtml(checks) {
  const list = Array.isArray(checks) ? checks : [];
  if (!list.length) return '';
  return (
    '<span class="plans-sc-checks">' +
    list.map((c) => '<code class="plans-sc-check">' + esc(c) + '</code>').join(' ') +
    '</span>'
  );
}

function plansScenarioRenderChainsHtml(catalog, statusPayload, filterParticipant) {
  const chains = Array.isArray(catalog && catalog.chains) ? catalog.chains : [];
  const runs = statusPayload && Array.isArray(statusPayload.runs) ? statusPayload.runs : [];
  const latestByTask = plansScenarioLatestRuns(runs);
  const updatedAt =
    statusPayload && statusPayload.updatedAt
      ? plansScenarioFormatWhen(statusPayload.updatedAt)
      : '—';

  const filtered = filterParticipant
    ? chains.filter((ch) => (ch.participants || []).includes(filterParticipant))
    : chains;

  let html =
    '<div class="plans-sc-meta">' +
    '<p class="hint">Цепочки сквозных сценариев. Статусы из «Хода прогонов» (обновлено ' +
    esc(updatedAt) +
    '). ✅ пройден · ❌ красный · ○ не запускался · ⏸ ждёт решения</p>' +
    '<p class="plans-sc-count hint">Всего цепочек: <strong>' +
    esc(String(chains.length)) +
    '</strong></p></div>';

  filtered.forEach((ch) => {
    const resolved = plansScenarioResolveChain(ch, latestByTask);
    const parts = (ch.participantLabels || ch.participants || []).map((p) => esc(p)).join(', ');
    html +=
      '<section class="plans-sc-chain" data-chain="' +
      esc(ch.code) +
      '">' +
      '<header class="plans-sc-chain-head">' +
      '<span class="plans-sc-chain-icon">' +
      resolved.chainUi.icon +
      '</span>' +
      '<div class="plans-sc-chain-titles">' +
      '<h2 class="plans-sc-chain-code">' +
      esc(ch.code) +
      '</h2>' +
      '<h3 class="plans-sc-chain-title">' +
      esc(ch.title) +
      '</h3>' +
      '<p class="plans-sc-chain-participants">' +
      esc(parts) +
      '</p>' +
      '<p class="plans-sc-chain-status">' +
      esc(resolved.chainUi.label) +
      (resolved.chainRunLabel ? ' · ' + esc(resolved.chainRunLabel) : '') +
      (resolved.chainWhen !== '—' ? ' · ' + esc(resolved.chainWhen) : '') +
      '</p>' +
      '</div></header>';
    if (ch.description) {
      html += '<p class="plans-sc-chain-desc">' + esc(ch.description) + '</p>';
    }
    html += '<ol class="plans-sc-steps">';
    resolved.steps.forEach(({ def, status }) => {
      const roles = (def.roles || [])
        .map((r) => {
          const labels = { customer: 'заказчик', shipper: 'ГО', logist: 'логист', carrier: 'перевозчик', driver: 'водитель', consignee: 'ГП' };
          return labels[r] || r;
        })
        .join(', ');
      html +=
        '<li class="plans-sc-step plans-sc-step--' +
        esc(status.ui.key) +
        '">' +
        '<span class="plans-sc-step-icon">' +
        status.ui.icon +
        '</span>' +
        '<div class="plans-sc-step-body">' +
        '<div class="plans-sc-step-line">' +
        '<strong class="plans-sc-step-code">' +
        esc(def.code) +
        '</strong> ' +
        esc(def.title) +
        '</div>' +
        (roles ? '<div class="plans-sc-step-roles hint">' + esc(roles) + '</div>' : '') +
        plansScenarioChecksHtml(def.checks) +
        '<div class="plans-sc-step-status hint">' +
        esc(status.ui.label) +
        (status.runLabel ? ' · ' + esc(status.runLabel) : '') +
        (status.when !== '—' ? ' · ' + esc(status.when) : '') +
        (status.run && status.run.id
          ? ' · <button type="button" class="plans-sc-goto-run" data-run-id="' +
            esc(status.run.id) +
            '">ход прогонов</button>'
          : '') +
        '</div></div></li>';
    });
    html += '</ol></section>';
  });

  return { html, chainCount: chains.length, summaryByParticipant: plansScenarioCountByParticipant(chains) };
}

async function fetchAdminPlansScenariosCatalog() {
  if (adminPlansScenariosCache) return adminPlansScenariosCache;
  const res = await fetch(plansScenarioChainsUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  adminPlansScenariosCache = await res.json();
  return adminPlansScenariosCache;
}

async function fetchAdminPlansScenariosStatus() {
  const res = await fetch(plansScenarioStatusUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function bindPlansScenarioRunLinks(root) {
  if (!root) return;
  root.querySelectorAll('.plans-sc-goto-run').forEach((btn) => {
    btn.onclick = () => {
      const rid = btn.getAttribute('data-run-id');
      if (!rid || typeof openAdminRuns !== 'function') return;
      openAdminRuns();
      if (typeof adminRunsRevealPreviousRun === 'function') {
        setTimeout(() => adminRunsRevealPreviousRun(rid), 400);
      }
    };
  });
}

async function loadAdminPlansScenariosContent() {
  const body = $('plans-body');
  if (!body) return;
  body.innerHTML = '<p class="hint">Загрузка сценариев…</p>';
  try {
    const [catalog, statusPayload] = await Promise.all([
      fetchAdminPlansScenariosCatalog(),
      fetchAdminPlansScenariosStatus(),
    ]);
    const { html } = plansScenarioRenderChainsHtml(catalog, statusPayload, null);
    body.innerHTML = '<article class="plan-article plans-sc-root">' + html + '</article>';
    bindPlansScenarioRunLinks(body);
    body.scrollTop = 0;
    const scroll = $('plans-scroll');
    if (scroll) scroll.scrollTop = 0;
  } catch (err) {
    body.innerHTML =
      '<p class="hint">Не удалось загрузить сценарии. ' + esc(String(err && err.message || err)) + '</p>';
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__plansScenarioRenderChainsHtml = plansScenarioRenderChainsHtml;
  globalThis.__plansScenarioResolveStep = plansScenarioResolveStep;
  globalThis.__plansScenarioLatestRuns = plansScenarioLatestRuns;
  globalThis.__plansScenarioCountByParticipant = plansScenarioCountByParticipant;
  globalThis.__plansScenarioUiFromRunStatus = plansScenarioUiFromRunStatus;
}
