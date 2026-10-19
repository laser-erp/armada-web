/**
 * QA D — сверка полей времени на staging (только чтение SQLite).
 * Запуск: D_TIME_STAGING_READONLY=1 node web-preview/test/d-time-staging-readonly.mjs
 * Нужен SSH-ключ ~/.ssh/armada_staging (или FVDS_SSH_PASSWORD + sshpass).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!process.env.D_TIME_STAGING_READONLY) {
  console.log('d-time-staging-readonly.mjs: skip (set D_TIME_STAGING_READONLY=1)');
  process.exit(0);
}

const py = `
import json, sqlite3
from datetime import datetime, timezone

def minutes_between(a, b):
    if not a or not b: return None
    ta = datetime.fromisoformat(a.replace("Z", "+00:00"))
    tb = datetime.fromisoformat(b.replace("Z", "+00:00"))
    if tb < ta: return None
    return round((tb - ta).total_seconds() / 60)

db = sqlite3.connect("file:/opt/pocketbase-staging/pb_data/data.db?mode=ro", uri=True)
p = json.loads(db.execute('select payload from app_state where key="main" limit 1').fetchone()[0])
orders = p.get("orders") or []
companies = p.get("companies") or []

def by_seq(n):
    for o in orders:
        if o and o.get("sequentialNumber") == n:
            return o
    return None

inn_seen = {}
dup = 0
for c in companies:
    inn = str(c.get("inn") or "").strip()
    if not inn: continue
    if inn in inn_seen and inn_seen[inn] != c.get("spaceId"):
        dup += 1
    inn_seen[inn] = c.get("spaceId")

out = {
    "admins": len(p.get("admins") or []),
    "customers": len(p.get("customers") or []),
    "drivers": len(p.get("drivers") or []),
    "vehicles": len(p.get("vehicles") or []),
    "dup_inn": dup,
    "linkEmptyAfterToNext": sum(1 for o in orders if o.get("linkEmptyAfterToNext")),
    "emptyAfterLinkedFromNext": sum(1 for o in orders if o.get("emptyAfterLinkedFromNext")),
    "seq": {},
}
for sn in (1, 2, 9):
    o = by_seq(sn)
    if not o:
        out["seq"][str(sn)] = None
        continue
    out["seq"][str(sn)] = {
        "timeToOrderMin_db": o.get("timeToOrderMin"),
        "timeToOrderMin_calc": minutes_between(o.get("departAt"), o.get("arrivedAt")),
        "timeLoadedMin_db": o.get("timeLoadedMin"),
        "timeLoadedMin_calc": minutes_between(o.get("arrivedAt"), o.get("endAt")),
        "timeTotalMin_db": o.get("timeTotalMin"),
        "workHours": o.get("workHours"),
        "timeLoadedHours": o.get("timeLoadedHours"),
    }
print(json.dumps(out))
`;

function runRemotePython(script) {
  const sshArgs = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20'];
  const remote = ['root@176.12.67.35', 'python3'];
  const opts = { encoding: 'utf8', timeout: 120000, input: script };
  const key = `${process.env.HOME}/.ssh/armada_staging`;
  if (existsSync(key)) {
    return spawnSync('ssh', [...sshArgs, '-i', key, ...remote], opts);
  }
  if (process.env.FVDS_SSH_PASSWORD) {
    return spawnSync(
      'sshpass',
      ['-p', process.env.FVDS_SSH_PASSWORD, 'ssh', ...sshArgs, ...remote],
      opts,
    );
  }
  return spawnSync('ssh', [...sshArgs, ...remote], opts);
}

const r = runRemotePython(py);
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
const raw = r.stdout;

const data = JSON.parse(raw.trim());
assert.equal(data.dup_inn, 0, 'один ИНН — один space');
assert.ok(data.admins >= 4 && data.customers >= 1 && data.drivers >= 1 && data.vehicles >= 1, 'counts baseline');

const s1 = data.seq['1'];
assert.ok(s1);
assert.equal(s1.timeToOrderMin_db, s1.timeToOrderMin_calc);
assert.equal(s1.timeLoadedMin_db, s1.timeLoadedMin_calc);
assert.equal(s1.workHours, s1.timeLoadedHours);

const s2 = data.seq['2'];
assert.ok(s2);
assert.equal(s2.timeToOrderMin_db, s2.timeToOrderMin_calc);
assert.equal(s2.timeLoadedMin_db, s2.timeLoadedMin_calc);

const s9 = data.seq['9'];
assert.ok(s9);
assert.equal(s9.timeToOrderMin_db, 22855, 'seq9: битые даты в данных, не расхождение формулы');
assert.equal(s9.timeToOrderMin_db, s9.timeToOrderMin_calc);

console.log(
  'd-time-staging-readonly.mjs: ok',
  `link=${data.linkEmptyAfterToNext}/${data.emptyAfterLinkedFromNext}`,
);
