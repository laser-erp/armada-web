/**
 * QA G (повторный прогон): только чтение staging — SSH + sqlite app_state, health API.
 * Запуск: node web-preview/test/g-etrn-staging-ro.test.mjs
 * env: SSH_KEY (default ~/.ssh/armada_staging), SSH_HOST (default 176.12.67.35)
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SSH_HOST = process.env.SSH_HOST || '176.12.67.35';
const SSH_KEY =
  process.env.SSH_KEY || path.join(os.homedir(), '.ssh', 'armada_staging');
const ARMADA_SPACE = 'b713867e-1c60-4391-bf27-8262c1206e11';

const PY_SNAPSHOT = `
import json, sqlite3, collections
db = "/opt/pocketbase-staging/pb_data/data.db"
conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
raw = conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0]
p = json.loads(raw)
companies = p.get("companies") or []
inn_to = collections.defaultdict(list)
for c in companies:
    inn = (c.get("inn") or "").strip()
    if inn:
        inn_to[inn].append(c.get("id"))
dup = {k: v for k, v in inn_to.items() if len(v) > 1}
orders = p.get("orders") or []
etrn_armada = []
go_ne_customer = []
for o in orders:
    if o.get("spaceId") != "${ARMADA_SPACE}":
        continue
    e = o.get("etrn")
    if e:
        etrn_armada.append({
            "seq": o.get("sequentialNumber"),
            "closed": bool(o.get("closedAt")),
            "shipperSame": o.get("shipperSameAsCustomer"),
            "tituls": (e.get("tituls") or {}),
            "sandbox": e.get("sandbox"),
        })
    if o.get("shipperSameAsCustomer") is False and e:
        go_ne_customer.append(o.get("sequentialNumber"))
counts = {k: len(p.get(k) or []) for k in ("admins", "customers", "drivers", "vehicles")}
print("JSON=" + json.dumps({
    "payload_bytes": len(raw),
    "dup_inn_count": len(dup),
    "entity_counts": counts,
    "armada_etrn_count": len(etrn_armada),
    "go_ne_customer_with_etrn": go_ne_customer,
    "etrn_armada": etrn_armada[:12],
}, ensure_ascii=False))
`;

function sshJson(pythonBody) {
  if (!fs.existsSync(SSH_KEY)) {
    return { skip: true, reason: `нет ключа ${SSH_KEY}` };
  }
  const inner = `timeout 50 python3 - <<'PY'\n${pythonBody}\nPY`;
  const r = spawnSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=15',
      '-i',
      SSH_KEY,
      `root@${SSH_HOST}`,
      inner,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    return { error: (r.stderr || r.stdout || 'ssh failed').trim().slice(0, 400) };
  }
  const line = (r.stdout || '')
    .split('\n')
    .filter((l) => l.startsWith('JSON='))
    .pop();
  if (!line) return { error: 'no JSON= line', raw: (r.stdout || '').slice(0, 300) };
  return { data: JSON.parse(line.slice(5)) };
}

function sshHealth() {
  if (!fs.existsSync(SSH_KEY)) return { skip: true };
  const r = spawnSync(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=15',
      '-i',
      SSH_KEY,
      `root@${SSH_HOST}`,
      'curl -sk --connect-timeout 5 http://127.0.0.1:8094/health',
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return { error: 'health curl failed' };
  try {
    return { data: JSON.parse((r.stdout || '').trim()) };
  } catch {
    return { error: 'health json parse' };
  }
}

const results = [];

// G5 / инфра: epd на staging
{
  const h = sshHealth();
  if (h.skip) {
    results.push({ id: 'G5-staging', status: '⏭', fact: h.reason || 'нет SSH' });
  } else if (h.error) {
    results.push({ id: 'G5-staging', status: '❌', fact: h.error });
    assert.fail(h.error);
  } else {
    assert.equal(h.data.ok, true);
    assert.equal(h.data.epd?.configured, false);
    assert.equal(h.data.epd?.sandbox, true);
    results.push({
      id: 'G5-staging',
      status: '✅',
      fact: `8094/health epd.configured=false operator=${h.data.epd?.operator}`,
    });
  }
}

// Правило Евгения: один ИНН — одна фирма (companies[] в state)
{
  const snap = sshJson(PY_SNAPSHOT);
  if (snap.skip) {
    results.push({ id: 'INN', status: '⏭', fact: snap.reason });
  } else if (snap.error) {
    results.push({ id: 'INN', status: '❌', fact: snap.error });
    assert.fail(snap.error);
  } else {
    assert.equal(snap.data.dup_inn_count, 0, JSON.stringify(snap.data));
    results.push({
      id: 'INN',
      status: '✅',
      fact: `dup_inn_count=0 среди ${snap.data.payload_bytes} байт state`,
    });
    if (snap.data.entity_counts) {
      const c = snap.data.entity_counts;
      results.push({
        id: 'entities-ro',
        status: '✅',
        fact: `admins=${c.admins} customers=${c.customers} drivers=${c.drivers} vehicles=${c.vehicles} (только чтение, без сравнения с прошлым прогоном)`,
      });
    }
    results.push({
      id: 'G1-staging-data',
      status: snap.data.armada_etrn_count > 0 ? '✅ (частично)' : 'в очередь',
      fact: `в space Армада etrn-заказов: ${snap.data.armada_etrn_count}; полный E2E T1–T4 — в очередь (запись)`,
    });
    results.push({
      id: 'G4-staging-data',
      status: snap.data.go_ne_customer_with_etrn.length ? '✅ (есть кейс)' : 'в очередь',
      fact:
        snap.data.go_ne_customer_with_etrn.length
          ? `ГО≠заказчик с etrn: №${snap.data.go_ne_customer_with_etrn.join(',')}`
          : 'нет заказа ГО≠заказчик с etrn для UI /z (нужен E2E или тестовый заказ)',
    });
  }
}

console.log('g-etrn-staging-ro.test.mjs: ok');
console.log(JSON.stringify(results, null, 2));
