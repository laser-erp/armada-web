#!/usr/bin/env node
/**
 * QA раздел D на staging: unit + readonly PB + запись (D3/D4/D6).
 * PIN не логировать. Туннель 9443, лимит Playwright 120000.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEST = path.join(ROOT, 'web-preview/test');

const table = [];

function runNode(script, envExtra = {}) {
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: Number(process.env.D_TIME_STEP_TIMEOUT_MS || 150_000),
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...envExtra },
  });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') };
}

function stepFromOutput(out, code) {
  for (const line of out.split('\n')) {
    const m = line.match(/^ШАГ\s+(\S+):\s+(начат|готово|ошибка.*)$/i);
    if (m) console.log(line.trim());
  }
  return code === 0;
}

console.log('ШАГ PRE: начат');
const pre = runNode(path.join(TEST, 'd-time-scenarios.test.mjs'));
const preOk = stepFromOutput(pre.out, pre.code);
console.log(preOk ? 'ШАГ PRE: готово' : `ШАГ PRE: ошибка, unit D1–D6 code=${pre.code}`);

for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
  if (pre.out.includes(`ШАГ ${id}: готово`)) {
    table.push({ id, status: '✅', fact: 'unit d-time-scenarios.test.mjs' });
  }
}

console.log('ШАГ D1-D2-PB: начат');
const ro = runNode(path.join(TEST, 'd-time-staging-readonly.mjs'), { D_TIME_STAGING_READONLY: '1' });
const roOk = ro.code === 0;
console.log(roOk ? 'ШАГ D1-D2-PB: готово' : `ШАГ D1-D2-PB: ошибка, code=${ro.code}`);
if (roOk) {
  table.push({ id: 'D1', status: '✅', fact: 'PB seq1/2: time*Min_db=calc' });
  table.push({ id: 'D2', status: '✅', fact: 'PB seq1: workHours=timeLoadedHours' });
} else {
  table.push({ id: 'D1', status: '❌', fact: ro.out.slice(-200) });
  table.push({ id: 'D2', status: '❌', fact: 'readonly fail' });
}

console.log('ШАГ D3-D6-E2E: начат');
const wr = runNode(path.join(TEST, 'd-time-staging-write.mjs'), { D_TIME_STAGING_WRITE: '1' });
stepFromOutput(wr.out, wr.code);
let wrJson = null;
try {
  const idx = wr.out.lastIndexOf('{\n  "mark"');
  if (idx >= 0) wrJson = JSON.parse(wr.out.slice(idx));
} catch (_) {}

for (const row of wrJson?.results || []) {
  const id = String(row.id || '').replace(/\s.*/, '');
  const map = { D3: 'D3', D4: 'D4', D6: 'D6' };
  const key = map[id] || id;
  if (['D3', 'D4', 'D6'].includes(key)) {
    table.push({ id: key, status: row.status, fact: row.fact });
  }
}
if (!wrJson?.results?.length) {
  table.push({ id: 'D3', status: '❌', fact: wr.out.slice(-150) });
  table.push({ id: 'D4', status: '❌', fact: 'no results' });
  table.push({ id: 'D6', status: '❌', fact: 'no results' });
}
console.log(wr.code === 0 ? 'ШАГ D3-D6-E2E: готово' : `ШАГ D3-D6-E2E: ошибка, exit ${wr.code}`);

const byId = new Map();
for (const r of table) byId.set(r.id, r);
const expect = {
  D1: 'recomputeOrderTimes: до/с грузом/до стоянки/всего',
  D2: 'workHours из timeLoadedHours при закрытии',
  D3: 'bookStatus, vehicleAt, календарь броней',
  D4: 'emptyKmAfter ↔ emptyKmBefore второго рейса',
  D5: 'автопланировщика нет (ожидаемо)',
  D6: 'учёт часов смены по заказам, без alarm',
};

console.log('\n--- таблица D ---');
let allOk = preOk && roOk && wr.code === 0 && !wrJson?.shrink;
for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']) {
  const r = byId.get(id);
  const st = r?.status || (id === 'D5' && preOk ? '✅' : '❌');
  const fact = r?.fact || (id === 'D5' ? 'нет в приложении (unit)' : 'не запускалось');
  if (st !== '✅') allOk = false;
  console.log(`${id}\t${st}\t${expect[id]}\t${fact}`);
}
if (wrJson?.shrink) allOk = false;
console.log(`ИТОГ: ${allOk ? '✅' : '❌'}`);
process.exit(allOk ? 0 : 1);
