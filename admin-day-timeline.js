/* Логист · Парк — вид «Лента дня» (/a). */
(function (g) {
  const DAY_START_H = 6;
  const DAY_END_H = 22;
  const ADMIN_DAY_TIMELINE_FALLBACK_HOURS = 3;
  const STORAGE_KEY = 'armada_admin_day_timeline_ymd_v1';

  function fr() {
    return g.armadaFleetRates || {};
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ymdFromDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function adminDayTimelineSelectedYmd() {
    if (state.adminDayTimelineYmd) return state.adminDayTimelineYmd;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        state.adminDayTimelineYmd = v;
        return v;
      }
    } catch (_) {}
    const today = ymdFromDate(new Date());
    state.adminDayTimelineYmd = today;
    return today;
  }

  function setAdminDayTimelineYmd(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    state.adminDayTimelineYmd = ymd;
    try {
      localStorage.setItem(STORAGE_KEY, ymd);
    } catch (_) {}
  }

  function ymdFromOrderIso(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return ymdFromDate(d);
  }

  function dayWindowMs(ymd) {
    const p = ymd.split('-').map(Number);
    const start = new Date(p[0], p[1] - 1, p[2], DAY_START_H, 0, 0, 0).getTime();
    const end = new Date(p[0], p[1] - 1, p[2], DAY_END_H, 0, 0, 0).getTime();
    return { start, end, span: end - start };
  }

  function msToTimelineLeftPct(ms, ymd) {
    const w = dayWindowMs(ymd);
    if (!Number.isFinite(ms)) return 0;
    const rel = ((ms - w.start) / w.span) * 100;
    return Math.max(0, Math.min(100, rel));
  }

  function msToTimelineWidthPct(startMs, endMs, ymd) {
    const w = dayWindowMs(ymd);
    const a = Math.max(w.start, startMs);
    const b = Math.min(w.end, endMs);
    if (b <= a) return 0;
    return ((b - a) / w.span) * 100;
  }

  function formatHmFromMs(ms) {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function orderScheduleStartMs(o) {
    const fn = fr().orderScheduleStartMs;
    return typeof fn === 'function' ? fn(o) : Date.parse(o.vehicleAt || 0);
  }

  function orderScheduleEndMs(o) {
    const fn = fr().orderScheduleEndMs;
    if (typeof fn === 'function') return fn(o);
    return Date.parse(o.vehicleAt || 0) + 4 * 3600000;
  }

  /** Конец полосы на ленте (не меняет биржевые пересечения). */
  function adminDayTimelineBarEndMs(o) {
    if (!o) return NaN;
    if (typeof looksClosedOrder === 'function' && looksClosedOrder(o)) {
      const closed = o.closedAt || o.parkingAt || o.endAt;
      const tc = Date.parse(closed || '');
      if (Number.isFinite(tc)) return tc;
    }
    if (o.freeAt) {
      const t = Date.parse(o.freeAt);
      if (Number.isFinite(t)) return t;
    }
    if (typeof computeFreeAt === 'function' && o.vehicleAt) {
      const fin = typeof financeForOrder === 'function' ? financeForOrder(o) : null;
      const iso = computeFreeAt(o.vehicleAt, o, fin);
      const t = Date.parse(iso);
      if (Number.isFinite(t)) return t;
    }
    const start = orderScheduleStartMs(o);
    if (!Number.isFinite(start)) return NaN;
    return start + ADMIN_DAY_TIMELINE_FALLBACK_HOURS * 3600 * 1000;
  }

  function scheduleOverlapMinutes(aStart, aEnd, bStart, bEnd) {
    const overlap = fr().scheduleIntervalsOverlap;
    if (typeof overlap !== 'function' || !overlap(aStart, aEnd, bStart, bEnd)) return 0;
    const ae = Number.isFinite(aEnd) ? aEnd : aStart + 3600000;
    const be = Number.isFinite(bEnd) ? bEnd : bStart + 3600000;
    const from = Math.max(aStart, bStart);
    const to = Math.min(ae, be);
    return Math.max(0, Math.round((to - from) / 60000));
  }

  function adminDayTimelineOrdersPool(ymd) {
    ymd = ymd || adminDayTimelineSelectedYmd();
    if (typeof canAdminSeeOrder !== 'function' || typeof matchesOwnerFilter !== 'function') return [];
    return (state.orders || []).filter((o) => {
      if (!o || o.cancelledAt || (o.closedAt && o.cancelReason)) return false;
      if (!canAdminSeeOrder(o) || !matchesOwnerFilter(o)) return false;
      const at = o.vehicleAt || o.createdAt;
      if (ymdFromOrderIso(at) !== ymd) return false;
      return true;
    });
  }

  function vehicleRowLabel(v) {
    const drv =
      typeof primaryDriverForVehicle === 'function' ? primaryDriverForVehicle(v) : null;
    const drvName = drv && drv.name ? drv.name : '—';
    let type = '';
    if (v.bodyType && typeof bodyTypeLabel === 'function') type = bodyTypeLabel(v.bodyType);
    else if (v.vehicleTypeId && typeof mapVtypeToBodyType === 'function') {
      type = bodyTypeLabel(mapVtypeToBodyType(v.vehicleTypeId)) || '';
    }
    const bits = [drvName, v.plate || '—'];
    if (type) bits.push(type);
    return bits.join(' · ');
  }

  function shortRouteLabel(o) {
    let t = typeof routeText === 'function' ? String(routeText(o) || '') : '';
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length > 32) return t.slice(0, 30) + '…';
    return t;
  }

  function ordersOnVehicle(orders, vehicle) {
    const list = orders || [];
    const frMod = fr();
    return list.filter((o) => {
      if (o.executorType === 'partner' || (o.onExchange && o.startOdometer == null)) return false;
      if (typeof frMod.sameVehicleOnOrder === 'function') {
        return frMod.sameVehicleOnOrder(o, vehicle);
      }
      const plate = String(vehicle.plate || '').trim();
      const used = String(o.vehiclePlate || o.bookedPlate || '').trim();
      return plate && used === plate;
    });
  }

  function partnerOrdersOnDay(orders) {
    return (orders || []).filter((o) => {
      if (!o) return false;
      const ps = String(o.partnerSpaceId || '').trim();
      return !!ps;
    });
  }

  function driverNameForVehicle(v) {
    const drv = typeof primaryDriverForVehicle === 'function' ? primaryDriverForVehicle(v) : null;
    return drv && drv.name ? drv.name : v.plate || '—';
  }

  function intervalsOverlapMs(aStart, aEnd, bStart, bEnd) {
    const fn = fr().scheduleIntervalsOverlap;
    if (typeof fn === 'function') return fn(aStart, aEnd, bStart, bEnd);
    return false;
  }

  function orderFitsOnVehicleAt(vehicle, order, dayOrders, atMs) {
    if (!vehicle || !order || !Number.isFinite(atMs)) return false;
    const draft = Object.assign({}, order, { vehicleAt: new Date(atMs).toISOString() });
    const aStart = orderScheduleStartMs(draft);
    const aEnd = adminDayTimelineBarEndMs(draft);
    if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) return false;
    const onVeh = ordersOnVehicle(dayOrders, vehicle).filter((o) => o.id !== order.id);
    for (let i = 0; i < onVeh.length; i++) {
      const o = onVeh[i];
      const bStart = orderScheduleStartMs(o);
      const bEnd = orderScheduleEndMs(o);
      if (intervalsOverlapMs(aStart, aEnd, bStart, bEnd)) return false;
    }
    return true;
  }

  function vehicleEarliestFreeFromMs(vehicle, order, dayOrders, fromMs) {
    if (!Number.isFinite(fromMs)) return null;
    let candidate = fromMs;
    for (let step = 0; step < 24; step++) {
      if (orderFitsOnVehicleAt(vehicle, order, dayOrders, candidate)) return candidate;
      const draft = Object.assign({}, order, { vehicleAt: new Date(candidate).toISOString() });
      const aStart = orderScheduleStartMs(draft);
      const aEnd = adminDayTimelineBarEndMs(draft);
      let bump = null;
      ordersOnVehicle(dayOrders, vehicle)
        .filter((o) => o.id !== order.id)
        .forEach((o) => {
          const bStart = orderScheduleStartMs(o);
          const bEnd = orderScheduleEndMs(o);
          if (intervalsOverlapMs(aStart, aEnd, bStart, bEnd) && Number.isFinite(bEnd) && bEnd > candidate) {
            bump = bump == null ? bEnd : Math.max(bump, bEnd);
          }
        });
      if (bump == null || bump <= candidate) break;
      candidate = bump;
    }
    return null;
  }

  function adminDayTimelineVehicleFreeFromMs(vehicle, vehOrders, ymd) {
    const w = dayWindowMs(ymd);
    let freeFrom = w.start;
    (vehOrders || []).forEach((o) => {
      const end = adminDayTimelineBarEndMs(o);
      if (Number.isFinite(end) && end > freeFrom) freeFrom = end;
    });
    return freeFrom;
  }

  function adminDayTimelineFreeLabel(vehicle, vehOrders, ymd) {
    if (!vehOrders || !vehOrders.length) return 'свободна весь день';
    const w = dayWindowMs(ymd);
    const freeFrom = adminDayTimelineVehicleFreeFromMs(vehicle, vehOrders, ymd);
    if (freeFrom >= w.end - 60000) return '';
    return `свободна с ${formatHmFromMs(freeFrom)}`;
  }

  function adminDayTimelineOverlapSegments(vehicle, vehOrders) {
    const find = fr().findVehicleScheduleConflicts;
    if (typeof find !== 'function' || !vehicle) return [];
    const segs = [];
    const seen = new Set();
    (vehOrders || []).forEach((order) => {
      const conflicting = find(vehicle, order) || [];
      conflicting.forEach((other) => {
        if (!other || other.id === order.id) return;
        const key = [order.id, other.id].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const aStart = orderScheduleStartMs(order);
        const aEnd = orderScheduleEndMs(order);
        const bStart = orderScheduleStartMs(other);
        const bEnd = orderScheduleEndMs(other);
        const mins = scheduleOverlapMinutes(aStart, aEnd, bStart, bEnd);
        if (mins <= 0) return;
        const from = Math.max(aStart, bStart);
        const ae = Number.isFinite(aEnd) ? aEnd : aStart + 3600000;
        const be = Number.isFinite(bEnd) ? bEnd : bStart + 3600000;
        const to = Math.min(ae, be);
        segs.push({ from, to, mins });
      });
    });
    return segs;
  }

  function adminDayTimelineFitsHint(order) {
    const firmId =
      typeof adminFleetCompanyId === 'function'
        ? adminFleetCompanyId(order)
        : (typeof currentOwnCompany === 'function' && currentOwnCompany() || {}).id;
    if (!firmId || !order.vehicleAt) return '';
    const at = Date.parse(order.vehicleAt);
    if (!Number.isFinite(at)) return '';
    const atLabel = formatHmFromMs(at);
    const vehicles =
      typeof fleetVehiclesForCompany === 'function' ? fleetVehiclesForCompany(firmId) : [];
    let fit =
      typeof fleetVehiclesMatchingOrder === 'function'
        ? fleetVehiclesMatchingOrder(vehicles, order)
        : vehicles;
    fit = fit || [];
    const ymd = ymdFromOrderIso(order.vehicleAt);
    const dayOrders = adminDayTimelineOrdersPool(ymd);
    for (let i = 0; i < fit.length; i++) {
      const v = fit[i];
      if (orderFitsOnVehicleAt(v, order, dayOrders, at)) {
        return `успевает: ${driverNameForVehicle(v)} с ${atLabel}`;
      }
    }
    let nearest = null;
    for (let j = 0; j < fit.length; j++) {
      const v = fit[j];
      const freeFrom = vehicleEarliestFreeFromMs(v, order, dayOrders, at);
      if (freeFrom == null || !Number.isFinite(freeFrom)) continue;
      if (!nearest || freeFrom < nearest.ms) {
        nearest = { ms: freeFrom, name: driverNameForVehicle(v) };
      }
    }
    if (nearest) {
      return `свободных машин к ${atLabel} нет · ближайшая: ${nearest.name} с ${formatHmFromMs(nearest.ms)}`;
    }
    return `свободных машин к ${atLabel} нет`;
  }

  function adminDayTimelineHourLabels() {
    const out = [];
    for (let h = DAY_START_H; h <= DAY_END_H; h++) out.push(`${pad2(h)}:00`);
    return out;
  }

  function adminDayTimelineNowPct(ymd) {
    if (ymd !== ymdFromDate(new Date())) return null;
    return msToTimelineLeftPct(Date.now(), ymd);
  }

  function dayTimelineBarHtml(o, ymd) {
    const start = orderScheduleStartMs(o);
    const end = adminDayTimelineBarEndMs(o);
    const left = msToTimelineLeftPct(start, ymd);
    const width = msToTimelineWidthPct(start, end, ymd);
    if (width <= 0) return '';
    const stCls = (typeof orderStatusClass === 'function' ? orderStatusClass(o) : '') || 'assigned';
    const num = o.sequentialNumber || '—';
    const route = shortRouteLabel(o);
    return `<button type="button" class="day-tl-bar order-status ${esc(stCls)}" data-day-tl-order="${esc(o.id)}" style="left:${left}%;width:${width}%" title="№ ${esc(num)} · ${esc(route)}">
      <span class="day-tl-bar-num">№${esc(num)}</span>
      ${route ? `<span class="day-tl-bar-route">${esc(route)}</span>` : ''}
    </button>`;
  }

  function renderAdminDayTimelineBoard() {
    const ymd = adminDayTimelineSelectedYmd();
    const orders = adminDayTimelineOrdersPool(ymd);
    const co = typeof currentOwnCompany === 'function' ? currentOwnCompany() : null;
    const firmId = co && co.id;
    const vehicles = firmId && typeof fleetVehiclesForCompany === 'function'
      ? fleetVehiclesForCompany(firmId)
      : typeof myCatalogVehicles === 'function'
        ? myCatalogVehicles()
        : [];
    const hours = adminDayTimelineHourLabels();
    const nowPct = adminDayTimelineNowPct(ymd);
    const headCells = hours.map((h) => `<div class="day-tl-hour">${esc(h)}</div>`).join('');

    const bodyRows = vehicles.map((v) => {
      const vehOrders = ordersOnVehicle(orders, v);
      vehOrders.sort((a, b) => orderScheduleStartMs(a) - orderScheduleStartMs(b));
      const overlaps = adminDayTimelineOverlapSegments(v, vehOrders);
      const freeLbl = adminDayTimelineFreeLabel(v, vehOrders, ymd);
      const bars = vehOrders.map((o) => dayTimelineBarHtml(o, ymd)).join('');
      const overlapHtml = overlaps
        .map((seg) => {
          const left = msToTimelineLeftPct(seg.from, ymd);
          const width = msToTimelineWidthPct(seg.from, seg.to, ymd);
          if (width <= 0) return '';
          return `<div class="day-tl-overlap" style="left:${left}%;width:${width}%"><span class="day-tl-overlap-label">пересечение ${seg.mins} мин</span></div>`;
        })
        .join('');
      const freeHtml = freeLbl ? `<span class="day-tl-free">${esc(freeLbl)}</span>` : '';
      return `<div class="day-tl-row" data-vehicle-id="${esc(v.id || '')}">
        <div class="day-tl-veh"><span class="day-tl-veh-text">${esc(vehicleRowLabel(v))}</span>${freeHtml}</div>
        <div class="day-tl-track">
          ${nowPct != null ? `<div class="day-tl-now" style="left:${nowPct}%"></div>` : ''}
          ${bars}
          ${overlapHtml}
        </div>
      </div>`;
    });

    const partner = partnerOrdersOnDay(orders);
    const partnerBars = partner.length ? partner.map((o) => dayTimelineBarHtml(o, ymd)).join('') : '';
    bodyRows.push(`<div class="day-tl-row day-tl-row--partner">
        <div class="day-tl-veh"><span class="day-tl-veh-text">Партнёры с биржи</span></div>
        <div class="day-tl-track">${partnerBars || '<span class="day-tl-partner-empty">нет</span>'}</div>
      </div>`);

    const unassigned = orders.filter((o) => {
      if (o.executorType === 'partner') return false;
      if (typeof isLogistInboxOrder === 'function' && isLogistInboxOrder(o)) return true;
      if (typeof orderHasDriverVehicleAssigned === 'function' && !orderHasDriverVehicleAssigned(o)) {
        return true;
      }
      return false;
    });

    const unassignedHtml = unassigned.length
      ? `<section class="day-tl-unassigned">
        <h3>Не распределены</h3>
        <ul>${unassigned
          .map((o) => {
            const hint = adminDayTimelineFitsHint(o);
            const when =
              o.vehicleAt && typeof formatRuDateTimeAt === 'function'
                ? formatRuDateTimeAt(o.vehicleAt)
                : '';
            const fitsCls = hint.indexOf('успевает:') === 0 ? 'day-tl-fits' : 'day-tl-fits day-tl-fits--warn';
            return `<li><button type="button" class="day-tl-unassigned-item" data-day-tl-order="${esc(o.id)}">№ ${esc(o.sequentialNumber || '—')} · ${esc(routeText(o))}${when ? ` · ${esc(when)}` : ''}</button><span class="${fitsCls}">${esc(hint)}</span></li>`;
          })
          .join('')}</ul>
      </section>`
      : '';

    const dp = ymd.split('-').map(Number);
    const d = new Date(dp[0], dp[1] - 1, dp[2]);
    const title = Number.isNaN(d.getTime())
      ? ymd
      : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

    const todayYmd = ymdFromDate(new Date());
    const navOn = (shift) => {
      if (shift === 0) return ymd === todayYmd;
      if (shift === -1) return ymd === shiftYmd(todayYmd, -1);
      if (shift === 1) return ymd === shiftYmd(todayYmd, 1);
      return false;
    };
    const navCls = (shift) => (navOn(shift) ? ' on' : '');

    return `<div class="day-tl-wrap">
      <div class="day-tl-toolbar">
        <div class="day-tl-day-nav admin-view-toggle" role="group" aria-label="День ленты">
          <button type="button" data-day-tl-shift="-1" class="${navCls(-1).trim()}">вчера</button>
          <button type="button" data-day-tl-shift="0" class="${navCls(0).trim()}">сегодня</button>
          <button type="button" data-day-tl-shift="1" class="${navCls(1).trim()}">завтра</button>
          <label class="day-tl-cal-embed"><input type="date" id="day-tl-date" value="${esc(ymd)}" aria-label="Календарь" /></label>
        </div>
        <p class="day-tl-day-title">${esc(title)} · ${DAY_START_H}:00–${DAY_END_H}:00</p>
      </div>
      <div class="day-tl-scroll">
        <div class="day-tl-head">
          <div class="day-tl-veh day-tl-veh--head">Машина</div>
          <div class="day-tl-track day-tl-track--head">
            <div class="day-tl-grid">${headCells}</div>
          </div>
        </div>
        <div class="day-tl-body">${bodyRows.join('') || '<p class="empty">Нет машин в парке</p>'}</div>
      </div>
      ${unassignedHtml}
    </div>`;
  }

  function shiftYmd(ymd, deltaDays) {
    const p = ymd.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + deltaDays);
    return ymdFromDate(d);
  }

  function wireAdminDayTimeline() {
    const root = $('admin-list');
    if (!root) return;
    root.querySelectorAll('[data-day-tl-shift]').forEach((btn) => {
      btn.onclick = () => {
        const shift = +btn.dataset.dayTlShift;
        let ymd = adminDayTimelineSelectedYmd();
        if (shift === 0) ymd = ymdFromDate(new Date());
        else ymd = shiftYmd(ymd, shift);
        setAdminDayTimelineYmd(ymd);
        renderAdmin();
      };
    });
    const cal = root.querySelector('#day-tl-date');
    if (cal) {
      cal.onchange = () => {
        setAdminDayTimelineYmd(cal.value);
        renderAdmin();
      };
    }
    root.querySelectorAll('[data-day-tl-order]').forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        if (typeof openDetail === 'function') openDetail(el.dataset.dayTlOrder);
      };
    });
  }

  g.adminDayTimelineSelectedYmd = adminDayTimelineSelectedYmd;
  g.setAdminDayTimelineYmd = setAdminDayTimelineYmd;
  g.adminDayTimelineOrdersPool = adminDayTimelineOrdersPool;
  g.adminDayTimelineBarEndMs = adminDayTimelineBarEndMs;
  g.renderAdminDayTimelineBoard = renderAdminDayTimelineBoard;
  g.wireAdminDayTimeline = wireAdminDayTimeline;
  g.adminDayTimelineVehicleFreeFromMs = adminDayTimelineVehicleFreeFromMs;
  g.adminDayTimelineFreeLabel = adminDayTimelineFreeLabel;
  g.adminDayTimelineOverlapSegments = adminDayTimelineOverlapSegments;
  g.adminDayTimelineFitsHint = adminDayTimelineFitsHint;
  g.ADMIN_DAY_TIMELINE_FALLBACK_HOURS = ADMIN_DAY_TIMELINE_FALLBACK_HOURS;
  g._adminDayTimelineDayStartH = DAY_START_H;
  g._adminDayTimelineDayEndH = DAY_END_H;
})(typeof window !== 'undefined' ? window : globalThis);
