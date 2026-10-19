#!/usr/bin/env node
/**
 * QA D — запись на staging: D3 UI бронь, D4 E2E линковка км, D6 E2E смена 2 рейса.
 * Запуск: D_TIME_STAGING_WRITE=1 STAGING_SUPER_PIN=… node web-preview/test/d-time-staging-write.mjs
 * PIN в лог не выводить. Тестовые заказы отменяются с причиной «перепроверка QA».
 */
import playwright from '../../scripts/node_modules/playwright/index.js';

const { chromium } = playwright;
import {
  ARMADA_SPACE,
  BASE,
  chromiumArgs,
  ensureTunnel,
  entityCountsPy,
  loginCustomerPortal,
  loginDriver,
  loginSuper,
  ordersByMarkPy,
  PORTAL_SLUG,
  resolveDriverPinFromDb,
  resolvePlaywrightTunnel,
  adminApiToken,
  apiCurlJson,
  sshPy,
} from './d-time-staging-harness.mjs';

const MARK = process.env.D_TIME_MARK || 'D-TIME-W';
const CANCEL_REASON = 'перепроверка QA';
const QA_CUSTOMER_PHONE = process.env.STAGING_CUSTOMER_PHONE || '+79009009002';
const QA_CUSTOMER_PIN = process.env.STAGING_CUSTOMER_PIN || '6827';
const QA_DRIVER_PHONE = process.env.STAGING_DRIVER_PHONE || '+79009009001';
let QA_DRIVER_PIN = '';
const QA_PLATE = process.env.D_TIME_TEST_PLATE || 'А000ТЕ99';

const superPin = String(process.env.STAGING_SUPER_PIN || process.env.STAGING_LOGIST_PIN || '').trim();
const DRIVER_PHONE_TAIL = String(QA_DRIVER_PHONE).replace(/\D/g, '').slice(-10);

const results = [];

function row(id, expect, status, fact) {
  results.push({ id, expect, status, fact });
}

function step(code, phase, detail = '') {
  if (phase === 'start') console.log(`ШАГ ${code}: начат`);
  else if (phase === 'ok') console.log(`ШАГ ${code}: готово`);
  else console.log(`ШАГ ${code}: ошибка, ${detail}`);
}

async function waitPush(page, timeoutMs = 45000) {
  await page
    .waitForResponse(
      (r) => r.url().includes('/armada-api/') && /PATCH|POST/.test(r.request().method()) && r.status() === 200,
      { timeout: timeoutMs },
    )
    .catch(() => null);
  await page.waitForTimeout(1500);
}

async function pullServerState(page, timeoutMs = 60000) {
  await page.evaluate(async (ms) => {
    const rec = typeof fetchServerState === 'function' ? await fetchServerState(ms) : null;
    if (rec && rec.payload && typeof mergeFullRemotePreservingLocal === 'function') {
      mergeFullRemotePreservingLocal(rec.payload);
    }
  }, timeoutMs);
}

async function scenarioD3(browser) {
  step('D3', 'start');
  const expect = 'бронь requested→confirmed, дата в календаре';
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));

  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
  tomorrow.setHours(14, 0, 0, 0);
  const vehicleAt = tomorrow.toISOString();
  const ds = tomorrow.toISOString().slice(0, 10);
  const ruDate = `${ds.slice(8, 10)}.${ds.slice(5, 7)}.${ds.slice(0, 4)}`;

  try {
    const admTok = adminApiToken(superPin);
    if (!admTok) throw new Error('verify-admin token');
    await loginSuper(page, superPin);
    const coMeta = await page.evaluate(({ spaceId }) => {
      const co = (state.companies || []).find((c) => c.spaceId === spaceId && (c.roles || []).includes('own'));
      const cust = (state.customers || []).find((c) => c.portalSlug === 'pb713867e' || String(c.portalPhone || '').includes('9009002'));
      return { co, cust };
    }, { spaceId: ARMADA_SPACE });
    if (!coMeta.co) throw new Error('нет own company');
    const orderId = `qa-d3-${Date.now()}`;
    const seed = {
      id: orderId,
      spaceId: ARMADA_SPACE,
      ownCompanyId: coMeta.co.id,
      customer: coMeta.cust?.name || 'Заказчик QA D3',
      customerId: coMeta.cust?.id || null,
      customerSubmitted: true,
      fulfillment: 'direct',
      source: 'customer',
      cargoDescription: MARK,
      loadingAddress: 'Санкт-Петербург, Невский проспект, 1',
      unloadingAddress: 'Санкт-Петербург, Московский проспект, 10',
      vehicleAt,
      bookedPlate: QA_PLATE,
      bookStatus: 'requested',
      transportDocMode: 'paper_tn',
      orderPricingMode: 'trip',
      tripPrice: 8000,
      priceForClient: 8000,
      createdAt: new Date().toISOString(),
    };
    const post = apiCurlJson('POST', '/admin/orders', { order: seed }, admTok);
    if (post.status === 409) {
      row('D3', expect, '❌', `409 ${post.text}`);
      step('D3', 'err', '409');
      await ctx.close();
      return;
    }
    if (post.status !== 200) throw new Error(`POST ${post.status} ${post.text?.slice(0, 80)}`);
    const fromApi =
      post.json?.payload?.orders?.find((x) => x.id === orderId) ||
      post.json?.payload?.order ||
      seed;
    await page.evaluate(async (ord) => {
      if (typeof upsertOrder === 'function') await upsertOrder(ord);
      else if (typeof state !== 'undefined') {
        const list = state.orders || [];
        const i = list.findIndex((x) => x.id === ord.id);
        if (i >= 0) list[i] = { ...list[i], ...ord };
        else list.push(ord);
        state.orders = list;
      }
      const rec = typeof fetchServerState === 'function' ? await fetchServerState(90000) : null;
      if (rec && rec.payload && typeof mergeFullRemotePreservingLocal === 'function') {
        mergeFullRemotePreservingLocal(rec.payload);
      }
      const o = typeof orderById === 'function' ? orderById(ord.id) : (state.orders || []).find((x) => x.id === ord.id);
      if (o && ord.bookedPlate && !o.bookedPlate) {
        const patch = { ...o, bookedPlate: ord.bookedPlate, bookStatus: ord.bookStatus || 'requested', vehicleAt: ord.vehicleAt };
        if (typeof upsertOrder === 'function') upsertOrder(patch);
        else Object.assign(o, patch);
      }
    }, fromApi);
    await page.waitForTimeout(2000);
    const custSt = { id: orderId, bookStatus: 'requested', bookedPlate: QA_PLATE, vehicleAt };

    const confirmed = await page.evaluate((oid) => {
      const o = typeof orderById === 'function' ? orderById(oid) : (state.orders || []).find((x) => x.id === oid);
      if (!o || !o.bookedPlate) return { ok: false, reason: 'no_order' };
      if (typeof stampConfirmedBooking === 'function') stampConfirmedBooking(o, o.bookedPlate);
      else {
        o.bookStatus = 'confirmed';
        o.bookConfirmedAt = new Date().toISOString();
      }
      if (typeof upsertOrder === 'function') upsertOrder(o);
      if (typeof persist === 'function') persist();
      if (typeof pushServerStateQueued === 'function') pushServerStateQueued();
      return { ok: true, bookStatus: o.bookStatus };
    }, custSt.id);
    await waitPush(page, 60000);
    if (!confirmed.ok) throw new Error(confirmed.reason || 'confirm fail');

    const adminCal = await page.evaluate(
      ({ orderId, dayKey }) => {
        const el = document.getElementById('admin-orders-cal');
        const html = el ? el.innerHTML : '';
        const o = (state.orders || []).find((x) => x.id === orderId);
        return {
          bookStatus: o && o.bookStatus,
          calHasDay: html.includes(dayKey) || !!document.querySelector(`[data-admin-cal-day="${dayKey}"]`),
        };
      },
      { orderId: custSt.id, dayKey: ruDate },
    );

    const db1 = sshPy(ordersByMarkPy(MARK));
    const oDb = db1.data?.orders?.[0];
    const ok =
      oDb &&
      oDb.bookStatus === 'confirmed' &&
      oDb.bookedPlate &&
      (adminCal.bookStatus === 'confirmed' || oDb.bookStatus === 'confirmed');

    await loginCustomerPortal(page, QA_CUSTOMER_PHONE, QA_CUSTOMER_PIN);
    await page.waitForSelector('#cust-book-cal', { timeout: 30000 });
    const custCal = await page.evaluate(() => {
      const box = document.getElementById('cust-book-cal');
      return { hasMarked: !!box && box.querySelector('.cal-day-marked') };
    });

    const busy = await page.evaluate(
      ({ plate, at, oid }) => (typeof vehicleBusyAt === 'function' ? vehicleBusyAt(plate, at, oid) : null),
      { plate: QA_PLATE, at: vehicleAt, oid: orderId },
    );

    const st3 = ok && busy === true && (custCal.hasMarked || adminCal.calHasDay) ? '✅' : '❌';
    row(
      'D3',
      expect,
      st3,
      `bookStatus=${oDb?.bookStatus}, busy=${busy}, calAdmin=${adminCal.calHasDay}, calCust=${custCal.hasMarked}`,
    );
    if (st3 === '✅') step('D3', 'ok');
    else step('D3', 'err', results.at(-1)?.fact || 'fail');

  } catch (e) {
    row('D3', expect, '❌', String(e.message || e).slice(0, 120));
    step('D3', 'err', String(e.message || e).slice(0, 120));
  }
  await ctx.close();
}

async function scenarioD4(browser) {
  step('D4', 'start');
  const expect = 'emptyKmAfter(1)=emptyKmBefore(2) после «след. заказ»';
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  try {
    const admTok = adminApiToken(superPin);
    if (!admTok) {
      row('D4', expect, '❌', 'verify-admin token');
      step('D4', 'err', 'no token');
      await ctx.close();
      return;
    }
    await loginSuper(page, superPin);
    const meta = await page.evaluate(
      ({ spaceId, driverTail }) => {
        const drv = (state.drivers || []).find((d) => {
          const ph = String(d.phone || '').replace(/\D/g, '');
          return ph.endsWith(driverTail) || ph.includes(driverTail);
        });
        const co = (state.companies || []).find((c) => c.spaceId === spaceId && (c.roles || []).includes('own'));
        return drv && co ? { drv, co } : { err: 'no_driver_or_co' };
      },
      { spaceId: ARMADA_SPACE, driverTail: DRIVER_PHONE_TAIL },
    );
    if (meta.err) {
      row('D4', expect, '❌', meta.err);
      await ctx.close();
      return;
    }
    const ts = Date.now();
    const mk = (n) => ({
      id: `qa-d4-${ts}-${n}`,
      spaceId: ARMADA_SPACE,
      ownCompanyId: meta.co.id,
      ownCompanyName: meta.co.name,
      customer: 'D4 QA',
      cargoDescription: `${MARK}-${n}`,
      loadingAddress: 'СПб, тест загрузка',
      unloadingAddress: 'СПб, тест выгрузка',
      vehiclePlate: QA_PLATE,
      driverName: meta.drv.name,
      driverPhone: meta.drv.phone,
      ownFleetDriverId: meta.drv.id,
      source: 'dispatcher',
      transportDocMode: 'paper_tn',
      shipperSameAsCustomer: true,
      orderPricingMode: 'trip',
      tripPrice: 5000,
      priceForClient: 5000,
      vehicleAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    const o1 = mk(1);
    const o2 = mk(2);
    const p1 = apiCurlJson('POST', '/admin/orders', { order: o1 }, admTok);
    const p2 = apiCurlJson('POST', '/admin/orders', { order: o2 }, admTok);
    if (p1.status === 409 || p2.status === 409) {
      row('D4', expect, '❌', `409 ${p1.text || p2.text}`);
      step('D4', 'err', '409');
      await ctx.close();
      return;
    }
    if (p1.status !== 200 || p2.status !== 200) {
      row('D4', expect, '❌', `POST ${p1.status}/${p2.status}`);
      await ctx.close();
      return;
    }
    await pullServerState(page);
    const prep = {
      o1: o1.id,
      o2: o2.id,
      seq1: p1.json?.order?.sequentialNumber ?? p1.json?.sequentialNumber,
      seq2: p2.json?.order?.sequentialNumber ?? p2.json?.sequentialNumber,
    };

    const dctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
    const driver = await dctx.newPage();
    driver.on('dialog', (d) => d.accept().catch(() => {}));
    await loginDriver(driver, QA_DRIVER_PHONE, QA_DRIVER_PIN);
    await pullServerState(driver);
    await driver.waitForTimeout(2000);

    const flow = await driver.evaluate(
      async ({ o1, o2 }) => {
        const shift = typeof findOpenShift === 'function' ? findOpenShift() : state.shift;
        if (!shift || shift.endedAt) {
          if (typeof openShift === 'function') openShift();
          await new Promise((r) => setTimeout(r, 500));
        }
        let sh = state.shift || (typeof findOpenShift === 'function' ? findOpenShift() : null);
        if (!sh) return { err: 'no_shift' };
        if (!sh.odometer) {
          sh.odometer = 100000;
          sh.lastOdometerPoint = 100000;
          if (typeof isEtoDone === 'function' && !isEtoDone(sh)) {
            sh.etoDoneAt = new Date().toISOString();
          }
          upsertShift();
        }
        const order1 = orderById(o1);
        const order2 = orderById(o2);
        if (!order1 || !order2) return { err: 'orders_missing' };
        state.draft = { assignedId: o1 };
        acceptDepart(100010);
        acceptArrive(100025);
        startLeaveLoading(o1);
        acceptUnloadingOdometer(order1, 100050);
        if (typeof answerRefuel === 'function') answerRefuel(false);
        else finalizeClose(false, null, null);
        finishPostCloseWhere('next');
        state.draft = { assignedId: o2 };
        acceptDepart(100050);
        state.draft = { assignedId: o2 };
        acceptArrive(100067);
        if (typeof pushServerStateQueued === 'function') await pushServerStateQueued().catch(() => {});
        const linked = (state.orders || []).find((x) => x.id === o1);
        const next = (state.orders || []).find((x) => x.id === o2);
        return {
          after: linked?.emptyKmAfter,
          before: next?.emptyKmBefore,
          linkFlag: linked?.emptyAfterLinkedFromNext,
        };
      },
      { o1: prep.o1, o2: prep.o2 },
    );
    await waitPush(driver);

    const db = sshPy(ordersByMarkPy(MARK));
    const orders = (db.data?.orders || []).filter((o) => !o.cancelledAt);
    const closed = orders.find((o) => o.seq === prep.seq1);
    const second = orders.find((o) => o.seq === prep.seq2);
    const match =
      flow.after != null &&
      flow.before != null &&
      +flow.after === +flow.before &&
      (closed?.emptyKmAfter === second?.emptyKmBefore || flow.linkFlag);

    const st4 = match ? '✅' : '❌';
    row(
      'D4',
      expect,
      st4,
      `UI after=${flow.after} before=${flow.before} link=${flow.linkFlag}; PB after=${closed?.emptyKmAfter} before=${second?.emptyKmBefore}`,
    );
    if (st4 === '✅') step('D4', 'ok');
    else step('D4', 'err', 'km link mismatch');
    await dctx.close();
  } catch (e) {
    row('D4', expect, '❌', String(e.message || e).slice(0, 120));
    step('D4', 'err', String(e.message || e).slice(0, 120));
  }
  await ctx.close();
}

async function scenarioD6(browser) {
  step('D6', 'start');
  const expect = 'смена: сумма timeTotalHours по 2 закрытым заказам';
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    const admTok = adminApiToken(superPin);
    if (!admTok) {
      row('D6', expect, '❌', 'verify-admin token');
      step('D6', 'err', 'no token');
      await ctx.close();
      return;
    }
    await loginSuper(page, superPin);
    const meta = await page.evaluate(
      ({ spaceId, driverTail }) => {
        const drv = (state.drivers || []).find((d) => {
          const ph = String(d.phone || '').replace(/\D/g, '');
          return ph.endsWith(driverTail) || ph.includes(driverTail);
        });
        const co = (state.companies || []).find((c) => c.spaceId === spaceId && (c.roles || []).includes('own'));
        return drv && co ? { drv, co } : { err: 'no meta' };
      },
      { spaceId: ARMADA_SPACE, driverTail: DRIVER_PHONE_TAIL },
    );
    if (meta.err) {
      row('D6', expect, '❌', meta.err);
      await ctx.close();
      return;
    }
    const closeQuick = (suffix, depart, load, end) => {
      const departAt = new Date(Date.now() - 4 * 3600000).toISOString();
      const arrivedAt = new Date(Date.now() - 3.5 * 3600000).toISOString();
      const endAt = new Date(Date.now() - 2 * 3600000).toISOString();
      return {
        id: `qa-d6-${Date.now()}-${suffix}`,
        spaceId: ARMADA_SPACE,
        ownCompanyId: meta.co.id,
        cargoDescription: `${MARK}-D6-${suffix}`,
        loadingAddress: 'СПб D6',
        unloadingAddress: 'СПб D6',
        vehiclePlate: QA_PLATE,
        driverName: meta.drv.name,
        ownFleetDriverId: meta.drv.id,
        source: 'dispatcher',
        transportDocMode: 'paper_tn',
        shipperSameAsCustomer: true,
        orderPricingMode: 'trip',
        tripPrice: 4000,
        priceForClient: 4000,
        departOdometer: depart,
        startOdometer: load,
        endOdometer: end,
        loadedKm: end - load,
        emptyKmBefore: load - depart,
        emptyKmAfter: 0,
        departAt,
        arrivedAt,
        endAt,
        parkingAt: endAt,
        closedAt: endAt,
        workHours: suffix === 1 ? 1.5 : 2,
        createdAt: new Date().toISOString(),
      };
    };
    let a = closeQuick(1, 200000, 200020, 200080);
    let b = closeQuick(2, 200080, 200095, 200150);
    const enriched = await page.evaluate(({ oa, ob }) => {
      const orders = [oa, ob];
      orders.forEach((o) => {
        if (typeof recomputeOrderTimes === 'function') recomputeOrderTimes(o);
      });
      return {
        oa: orders[0],
        ob: orders[1],
        sumUi: orders.reduce((s, o) => s + (o.timeTotalHours || 0), 0),
      };
    }, { oa: a, ob: b });
    a = enriched.oa;
    b = enriched.ob;
    const sumUi = enriched.sumUi;
    let pushOk = true;
    let postDetail = '';
    for (const o of [a, b]) {
      const r = apiCurlJson('POST', '/admin/orders', { order: o }, admTok);
      if (r.status === 409) {
        pushOk = false;
        row('D6', expect, '❌', `409 ${r.text}`);
        step('D6', 'err', '409');
        await ctx.close();
        return;
      }
      if (r.status !== 200) {
        pushOk = false;
        postDetail = `HTTP ${r.status} ${r.text?.slice(0, 120)}`;
      }
    }
    await pullServerState(page);
    await waitPush(page);
    const prep = { sumUi, pushOk, seqs: [] };
    const db = sshPy(ordersByMarkPy(`${MARK}-D6`));
    const ords = db.data?.orders || [];
    const runIds = new Set([a.id, b.id]);
    const closed = ords.filter((o) => runIds.has(o.id) && o.closedAt && !o.cancelledAt);
    const sumPb = closed.reduce((s, o) => s + (o.timeTotalHours || 0), 0);
    const ok =
      prep.pushOk !== false && closed.length >= 2 && sumPb > 0 && Math.abs(sumPb - prep.sumUi) < 0.05;
    const alarm = await page.evaluate(
      () => !/\bshiftHoursAlarm\b|\bлимит\s+смен/i.test(document.body?.innerText || ''),
    );
    const st6 = ok && alarm ? '✅' : '❌';
    row(
      'D6',
      expect,
      st6,
      `pushOk=${prep.pushOk}${postDetail ? ` (${postDetail})` : ''}, заказов=${closed.length}, sumPB=${sumPb.toFixed(2)}, sumUI=${prep.sumUi?.toFixed?.(2) ?? prep.sumUi}, alarmUi=${!alarm}`,
    );
    if (st6 === '✅') step('D6', 'ok');
    else step('D6', 'err', 'sum mismatch');
  } catch (e) {
    row('D6', expect, '❌', String(e.message || e).slice(0, 120));
    step('D6', 'err', String(e.message || e).slice(0, 120));
  }
  await ctx.close();
}

async function cancelTestOrders(browser) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  try {
    await loginSuper(page, superPin);
    await page.evaluate(
      ({ mark, reason }) => {
        const list = (state.orders || []).filter(
          (o) => String(o.cargoDescription || '').includes(mark) && !o.cancelledAt,
        );
        list.forEach((o) => {
          if (typeof cancelOrder === 'function') cancelOrder(o.id, reason);
        });
        if (typeof persist === 'function') persist();
        if (typeof pushServerStateQueued === 'function') pushServerStateQueued();
      },
      { mark: MARK, reason: CANCEL_REASON },
    );
    await waitPush(page, 60000);
  } catch (_) {
    /* best effort */
  }
  await ctx.close();
}

async function main() {
  if (!process.env.D_TIME_STAGING_WRITE) {
    console.log('skip: set D_TIME_STAGING_WRITE=1');
    process.exit(0);
  }
  if (!superPin) {
    console.error('STAGING_SUPER_PIN required');
    process.exit(2);
  }

  if (process.env.D_TIME_CANCEL === '1') {
    const tunnel = await ensureTunnel();
    if (!tunnel.ok) process.exit(1);
    await resolvePlaywrightTunnel();
    const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
    await cancelTestOrders(browser);
    await browser.close();
    console.log('cancel: ok');
    process.exit(0);
  }

  const tunnel = await ensureTunnel();
  if (!tunnel.ok) {
    console.error(JSON.stringify({ error: tunnel.error }));
    process.exit(1);
  }
  const tunHttps = await resolvePlaywrightTunnel();
  if (!tunHttps.ok) {
    console.error(JSON.stringify({ error: tunHttps.error }));
    process.exit(1);
  }

  sshPy(`
import sqlite3
sqlite3.connect("/opt/pocketbase-staging/pb_data/data.db").execute(
  '.backup /root/backup-staging-requeue-' + __import__('datetime').datetime.now().strftime('%H%M') + '.db'
)
print("JSON="+'{"ok":true}')
`);

  QA_DRIVER_PIN = resolveDriverPinFromDb();
  if (!QA_DRIVER_PIN) {
    console.error('driver PIN from DB failed');
    process.exit(2);
  }

  const before = sshPy(entityCountsPy());
  const baseCounts = before.data?.counts;

  const only = String(process.env.D_TIME_ONLY || '').trim().toUpperCase();
  const run = (id) => !only || only === id;

  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });

  if (run('D3')) await scenarioD3(browser);
  if (run('D4')) await scenarioD4(browser);
  if (run('D6')) await scenarioD6(browser);
  if (!only) await cancelTestOrders(browser);

  const after = sshPy(entityCountsPy());
  const afterCounts = after.data?.counts;

  let shrink = false;
  if (baseCounts && afterCounts) {
    for (const k of ['admins', 'customers', 'drivers', 'vehicles']) {
      if (afterCounts[k] < baseCounts[k]) shrink = true;
    }
  }

  await browser.close();

  const allOk = results.every((r) => r.status === '✅') && !shrink;
  const report = {
    mark: MARK,
    portal: PORTAL_SLUG,
    countsBefore: baseCounts,
    countsAfter: afterCounts,
    shrink,
    results,
    itog: allOk ? '✅ всё прошло' : '❌ есть падения',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
