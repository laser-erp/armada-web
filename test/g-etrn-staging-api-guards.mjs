/**
 * Доп. проверки guard на staging (без браузера): T2 при T1=pending, T1 без договора / не ГО.
 * Данные QA-lc-0036 и эталонные заказы — только чтение БД через SSH mux.
 */
import { spawnSync } from 'node:child_process';

const API = 'https://staging.app.armada.sx:9443/armada-api';
const MUX = ['-S', '/tmp/armada-staging.ctl', '-o', 'BatchMode=yes', 'root@176.12.67.35'];
const QA_LC_ORDER = '7088f1c8-937e-479d-86ce-4accc264649c';
const QA_LC_TAG = 'QA-lc-0036';

const rows = [];

function log(id, ok, fact) {
  const status = ok ? '✅' : '❌';
  rows.push({ id, status, fact });
  console.log(`G-API ${id} ${status} ${fact}`);
}

function muxPython(py) {
  const inner = `timeout 45 python3 - <<'PY'\n${py}\nPY`;
  const r = spawnSync('ssh', [...MUX, inner], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) return { err: (r.stderr || r.stdout || 'ssh_fail').slice(0, 120) };
  const line = (r.stdout || '').trim();
  if (!line) return { err: 'empty' };
  try {
    return JSON.parse(line);
  } catch {
    return { err: 'parse', raw: line.slice(0, 200) };
  }
}

function curlJson(url, opts = {}) {
  const args = [
    '-sk',
    '--connect-timeout',
    '15',
    '--max-time',
    '55',
    '--resolve',
    'staging.app.armada.sx:9443:127.0.0.1',
  ];
  if (opts.method) args.push('-X', opts.method);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push('-H', `${k}: ${v}`);
  }
  if (opts.body) args.push('-d', opts.body);
  args.push(url);
  const r = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  let data = {};
  try {
    data = JSON.parse(r.stdout || '{}');
  } catch {
    data = { _raw: (r.stdout || '').slice(0, 200) };
  }
  return { http: r.status, data, stdout: r.stdout || '' };
}

function fetchOrderMeta(orderId) {
  return muxPython(`import json, sqlite3
oid=${JSON.stringify(orderId)}
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    if o.get("id")==oid:
        e=o.get("etrn") or {}
        ta=bool(o.get("transportApp",{}).get("signedAt")) or (o.get("docs",{}).get("transportApp",{}).get("status")=="signed")
        print(json.dumps({
            "id": oid,
            "cargo": (o.get("cargoDescription") or "")[:80],
            "etrn": bool(e),
            "externalId": e.get("externalId"),
            "token": e.get("shipperSignToken"),
            "tituls": e.get("tituls"),
            "transportAppSigned": ta,
        }, ensure_ascii=False))
        break
else:
    print(json.dumps({"err":"not_found"}))`);
}

function main() {
  const qa = fetchOrderMeta(QA_LC_ORDER);
  if (qa.err) {
    log('G-API-prep', false, `mux БД: ${qa.err}`);
    process.exit(1);
  }
  const qaOk =
    (qa.cargo || '').includes(QA_LC_TAG) && qa.etrn === false && qa.transportAppSigned === true;
  log(
    'G-API-prep',
    qaOk,
    qaOk
      ? `заказ ${QA_LC_TAG}: etrn нет, договор-заявка signed`
      : `meta ${JSON.stringify(qa).slice(0, 120)}`,
  );

  const taSignedExpr = `bool(o.get("transportApp",{}).get("signedAt")) or (o.get("docs",{}).get("transportApp",{}).get("status")=="signed")`;

  const chainOrder = muxPython(`import json, sqlite3
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
for o in p.get("orders") or []:
    e=o.get("etrn")
    if not e: continue
    t=e.get("tituls") or {}
    if t.get("t1")=="pending" and t.get("t2")=="pending" and e.get("externalId"):
        print(json.dumps({"id":o["id"],"externalId":e["externalId"],"token":e.get("shipperSignToken"),"transportAppSigned":${taSignedExpr}}, ensure_ascii=False))
        break
else:
    print(json.dumps({"err":"no_chain_order"}))`);

  const contractOrder = muxPython(`import json, sqlite3
db="/opt/pocketbase-staging/pb_data/data.db"
conn=sqlite3.connect(f"file:{db}?mode=ro", uri=True)
p=json.loads(conn.execute("SELECT payload FROM app_state WHERE key='main' LIMIT 1").fetchone()[0])
pick=None
for o in p.get("orders") or []:
    e=o.get("etrn")
    if not e or not e.get("shipperSignToken"): continue
    t=e.get("tituls") or {}
    if t.get("t1")!="pending": continue
    ta=${taSignedExpr}
    if ta: continue
    pick={"id":o["id"],"token":e.get("shipperSignToken"),"transportAppSigned":False}
    break
print(json.dumps(pick or {"err":"no_unsigned_contract_order"}))`);

  if (chainOrder.err || chainOrder.error) {
    log('G-API-T2', false, `нет заказа t1=t2=pending: ${JSON.stringify(chainOrder).slice(0, 100)}`);
  } else {
    const wh = curlJson(`${API}/epd/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: chainOrder.externalId,
        titul: 't2',
        status: 'signed',
      }),
    });
    const rejected = wh.data.ok === false && wh.data.error === 'etrn_titul_chain';
    log(
      'G-API-T2',
      rejected,
      rejected
        ? 'webhook T2 при T1=pending → etrn_titul_chain'
        : `ответ: ${JSON.stringify(wh.data).slice(0, 120)}`,
    );
  }

  const shipperNoEtrn = curlJson(`${API}/etrn/shipper-t1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: QA_LC_ORDER,
      token: 'qa-not-a-shipper-token',
    }),
  });
  const noEtrnRej =
    shipperNoEtrn.data.error === 'order_or_etrn_not_found' ||
    shipperNoEtrn.data.error === 'invalid_shipper_token';
  log(
    'G-API-T1-QA',
    noEtrnRej,
    noEtrnRej
      ? `${QA_LC_TAG}: POST shipper-t1 отклонён (${shipperNoEtrn.data.error})`
      : `ожидали отказ, got ${JSON.stringify(shipperNoEtrn.data).slice(0, 100)}`,
  );

  const t1TokenProbe = contractOrder.id && contractOrder.token ? contractOrder : chainOrder;

  if (contractOrder.id && contractOrder.token) {
    const noApp = curlJson(`${API}/etrn/shipper-t1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: contractOrder.id,
        token: contractOrder.token,
      }),
    });
    const needApp = noApp.data.error === 'etrn_t1_requires_transport_app';
    log(
      'G-API-T1-contract',
      needApp,
      needApp
        ? 'T1 без подписанного договора-заявки → etrn_t1_requires_transport_app'
        : `ожидали etrn_t1_requires_transport_app, got ${JSON.stringify(noApp.data).slice(0, 100)}`,
    );
  } else {
    log(
      'G-API-T1-contract',
      false,
      `нет заказа с ЭТрН и неподписанным договором: ${JSON.stringify(contractOrder).slice(0, 100)}`,
    );
  }

  if (t1TokenProbe.id && t1TokenProbe.token) {
    const badTok = curlJson(`${API}/etrn/shipper-t1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: t1TokenProbe.id,
        token: '00000000-0000-0000-0000-000000000099',
      }),
    });
    const badGo = badTok.data.error === 'invalid_shipper_token';
    log(
      'G-API-T1-token',
      badGo,
      badGo ? 'чужой token → invalid_shipper_token (не ГО)' : JSON.stringify(badTok.data).slice(0, 100),
    );
  }

  const failed = rows.some((r) => r.status === '❌');
  console.log('G-API ИТОГ:', failed ? '❌' : '✅');
  process.exit(failed ? 1 : 0);
}

main();
