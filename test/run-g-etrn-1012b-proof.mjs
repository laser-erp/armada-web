#!/usr/bin/env node
/**
 * Полный прогон G на staging 80dde7f → единый лог-доказательство.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..', '..');
const PROOF = process.env.G_ETRN_PROOF || '/workspace/g-etrn-1012b-proof.log';
const BUILD = '80dde7f';
const FIX = '6508197';

const chunks = [];

function section(title) {
  const line = `\n=== ${title} ${new Date().toISOString()} build=${BUILD} fix=${FIX} ===\n`;
  chunks.push(line);
  process.stdout.write(line);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...opts.env },
    maxBuffer: 16 * 1024 * 1024,
    timeout: opts.timeout || 230000,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  chunks.push(out);
  process.stdout.write(out);
  if (!out.endsWith('\n')) process.stdout.write('\n');
  return r.status ?? 1;
}

function muxTituls(orderId) {
  if (!orderId) return null;
  const py = `import json, sqlite3
oid=${JSON.stringify(orderId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    if o.get("id")==oid:
        e=o.get("etrn") or {}
        print(json.dumps(e.get("tituls"), ensure_ascii=False))
        break`;
  const inner = `timeout 40 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync('ssh', ['-S', '/tmp/armada-staging.ctl', '-o', 'BatchMode=yes', 'root@176.12.67.35', inner], {
    encoding: 'utf8',
  });
  return (r.stdout || '').trim();
}

function main() {
  section('unit g-etrn-webhook.test.mjs');
  run('node', ['armada-api/test/g-etrn-webhook.test.mjs']);

  section('unit g-etrn.test.mjs');
  run('node', ['web-preview/test/g-etrn.test.mjs']);

  section('staging API guards');
  const apiExit = run('node', ['web-preview/test/g-etrn-staging-api-guards.mjs'], { timeout: 120000 });

  section('staging health');
  run('curl', [
    '-sk',
    '--resolve',
    'staging.app.armada.sx:9443:127.0.0.1',
    'https://staging.app.armada.sx:9443/armada-api/health',
  ]);

  section('E2E g-etrn-staging-write.mjs');
  const e2eExit = run('node', ['web-preview/test/g-etrn-staging-write.mjs'], {
    timeout: 600000,
    env: { G_ETRN_MARK: `G-ETRN QA ${new Date().toISOString().slice(0, 19)}` },
  });

  let orderId = null;
  try {
    const resPath = path.join(ROOT, 'web-preview/test/g-etrn-staging-write-results.json');
    const j = JSON.parse(fs.readFileSync(resPath, 'utf8'));
    orderId = j.orderId;
  } catch {
    /* */
  }

  section('DB tituls (mux readonly)');
  const titulsLine = muxTituls(orderId);
  const titulsMsg = titulsLine ? `tituls из БД (order ${orderId || '?'}): ${titulsLine}` : 'tituls: нет orderId или mux';
  chunks.push(titulsMsg + '\n');
  process.stdout.write(titulsMsg + '\n');

  const gFailed = e2eExit !== 0 || apiExit !== 0;
  const summary = gFailed
    ? '❌ провал E2E и/или API guards (см. шаги выше)'
    : '✅ G1–G6 и доп. API guards пройдены';
  chunks.push(`\nИТОГ ${summary}\n`);
  process.stdout.write(`\nИТОГ ${summary}\n`);

  fs.writeFileSync(PROOF, chunks.join(''));
  console.log('PROOF_WRITTEN', PROOF);
  process.exit(gFailed ? 1 : 0);
}

main();
