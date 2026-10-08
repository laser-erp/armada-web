/* Тарифы ТС, график, cut-off, расчёт цены, риски (staging + prod-safe defaults). */
(function (g) {
  const OUTSIDE_KAD_TYPES = [
    'extra_delivery_hour',
    'km_both_ways',
    'km_one_way_x2',
    'fixed_surcharge',
    'separate_delivery',
  ];

  const SHIFT_CODES = ['3+1', '4+1', '5+1', '7+1', '8+1'];

  function shiftRow(code, workHours, deliveryHours, shift) {
    return { code, workHours, deliveryHours, shift: shift != null ? shift : null };
  }

  function defaultShiftOptions() {
    return [
      shiftRow('3+1', 3, 1, null),
      shiftRow('4+1', 4, 1, null),
      shiftRow('5+1', 5, 1, null),
      shiftRow('7+1', 7, 1, null),
    ];
  }

  function defaultCityBlock() {
    return {
      hourlyRate: null,
      kmPerDeliveryHour: null,
      includedKm: null,
      extraKmRate: null,
      shiftOptions: defaultShiftOptions().map((r) => Object.assign({}, r)),
      outsideKadPolicy: { type: null, description: null, extraHours: null, fixedAmount: null },
      minimumPolicy: { type: null, hours: null, amount: null },
    };
  }

  function defaultRates() {
    return {
      city: defaultCityBlock(),
      intercity: {
        perKm: null,
        perKmLong: null,
        minimum: null,
        distanceCalculation: 'one_way_x2',
        loadingIncluded: false,
        extraConditions: null,
      },
      special: {
        hourlyRate: null,
        kmPerDeliveryHour: null,
        includedKm: null,
        extraKmRate: null,
        shiftOptions: defaultShiftOptions().map((r) => Object.assign({}, r)),
        outsideKadPolicy: { type: null, description: null, extraHours: null, fixedAmount: null },
        deliveryNote: null,
      },
      urgencyMultipliers: {
        standard: 1.0,
        urgent: 1.3,
        very_urgent: 1.5,
        night: 1.4,
        weekend: 1.25,
        holiday: 1.75,
      },
      minSurcharge: 3000,
      correctedByOwner: false,
      marketRateCode: null,
    };
  }

  function defaultSchedule() {
    const day = (start, end) => ({ start, end });
    return {
      template: {
        monday: day('08:00', '20:00'),
        tuesday: day('08:00', '20:00'),
        wednesday: day('08:00', '20:00'),
        thursday: day('08:00', '20:00'),
        friday: day('08:00', '20:00'),
        saturday: day('10:00', '16:00'),
        sunday: null,
      },
      exceptions: [],
    };
  }

  function defaultLocation() {
    return {
      lat: 59.9343,
      lng: 30.3351,
      updatedAt: new Date().toISOString(),
      source: 'base_address',
    };
  }

  function defaultRating(seed) {
    const s = seed || {};
    return {
      score: s.score != null ? s.score : 4.5,
      totalOrders: s.totalOrders != null ? s.totalOrders : 0,
      completedOnTime: s.completedOnTime != null ? s.completedOnTime : 0,
      cancellations: s.cancellations != null ? s.cancellations : 0,
      cancellationRate: s.cancellationRate != null ? s.cancellationRate : 0,
      lastCancellation: s.lastCancellation || null,
    };
  }

  function defaultAcceptanceRules() {
    return {
      cutOffTime: '16:00',
      appliesTo: 'next_day',
      urgentSurcharge: 1.3,
      allowAfterCutOff: true,
      maxDaysAhead: 30,
      minLeadTime: 2,
      cutOffByDay: { next_day: '16:00', day_after: '18:00', week: null },
    };
  }

  function defaultCancellationPolicy() {
    return {
      freeCancellationHours: 24,
      penaltyTiers: [
        { hoursBefore: 24, penaltyPercent: 0 },
        { hoursBefore: 12, penaltyPercent: 10 },
        { hoursBefore: 4, penaltyPercent: 30 },
        { hoursBefore: 2, penaltyPercent: 50 },
        { hoursBefore: 0, penaltyPercent: 100 },
      ],
      minPenalty: 1000,
      maxPenalty: 50000,
    };
  }

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(patch).forEach((k) => {
      const pv = patch[k];
      if (pv && typeof pv === 'object' && !Array.isArray(pv) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], pv);
      } else out[k] = pv;
    });
    return out;
  }

  function normalizeVehicleRates(v) {
    const rates = deepMerge(defaultRates(), v && v.rates ? v.rates : {});
    if (!Array.isArray(rates.city.shiftOptions) || !rates.city.shiftOptions.length) {
      rates.city.shiftOptions = defaultShiftOptions();
    }
    if (!Array.isArray(rates.special.shiftOptions) || !rates.special.shiftOptions.length) {
      rates.special.shiftOptions = defaultShiftOptions();
    }
    return rates;
  }

  function normalizeVehicleFleetMeta(v) {
    if (!v) return v;
    v.rates = normalizeVehicleRates(v);
    v.schedule = deepMerge(defaultSchedule(), v.schedule || {});
    if (!v.location) v.location = defaultLocation();
    if (!v.rating) v.rating = defaultRating();
    return v;
  }

  function normalizeCompanyPolicies(c) {
    if (!c) return c;
    if (!c.acceptanceRules) c.acceptanceRules = defaultAcceptanceRules();
    else c.acceptanceRules = deepMerge(defaultAcceptanceRules(), c.acceptanceRules);
    if (!c.cancellationPolicy) c.cancellationPolicy = defaultCancellationPolicy();
    else c.cancellationPolicy = deepMerge(defaultCancellationPolicy(), c.cancellationPolicy);
    if (!c.rating) c.rating = defaultRating({ score: 4.5, totalOrders: 100 });
    return c;
  }

  function vehicleRateProfile(v) {
    const body = String((v && v.bodyTypeId) || '').trim();
    const cls = String((v && v.vehicleClass) || body).trim();
    if (['manipulator', 'avtokran', 'tral'].includes(body) || ['manipulator', 'avtokran', 'tral'].includes(cls)) {
      return 'special';
    }
    return 'city';
  }

  function setShiftPrices(block, map) {
    (block.shiftOptions || []).forEach((row) => {
      if (map[row.code] != null) row.shift = map[row.code];
    });
  }

  function parseTimeHM(s) {
    const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return +m[1] * 60 + +m[2];
  }

  function isAfterCutOff(now, cutOffTime) {
    const n = now instanceof Date ? now : new Date();
    const c = parseTimeHM(cutOffTime);
    if (c == null) return false;
    const cur = n.getHours() * 60 + n.getMinutes();
    return cur > c;
  }

  function urgencyTagsForOrder(order, company, now) {
    const tags = [];
    const n = now || new Date();
    const rules = (company && company.acceptanceRules) || defaultAcceptanceRules();
    if (order && order.pricingUrgency === 'urgent') tags.push('urgent');
    if (order && order.pricingUrgency === 'very_urgent') tags.push('very_urgent');
    if (isAfterCutOff(n, rules.cutOffTime) && rules.allowAfterCutOff) tags.push('urgent');
    const h = n.getHours();
    if (h >= 22 || h < 6) tags.push('night');
    const dow = n.getDay();
    if (dow === 0 || dow === 6) tags.push('weekend');
    return tags;
  }

  /** Сложение надбавок (k−1), итог min(1+Σ, 2.0) — см. ПРАВИЛА продукта / ТЗ. */
  function combinedUrgencyMultiplier(rates, tags, company) {
    const u = (rates && rates.urgencyMultipliers) || defaultRates().urgencyMultipliers;
    const rules = (company && company.acceptanceRules) || defaultAcceptanceRules();
    let delta = 0;
    const seen = new Set();
    (tags || []).forEach((t) => {
      if (!t || seen.has(t)) return;
      seen.add(t);
      if (t === 'urgent' && rules.urgentSurcharge > 1) {
        delta += +rules.urgentSurcharge - 1;
        return;
      }
      const k = u[t];
      if (k > 1) delta += k - 1;
    });
    return Math.min(1 + delta, 2);
  }

  function basePriceFromRates(vehicle, order, distanceKm) {
    const v = normalizeVehicleFleetMeta(vehicle);
    const rates = v.rates;
    const dist = +(distanceKm || order && order.routeDistanceKm) || 0;
    const profile = vehicleRateProfile(v);
    if (profile === 'special') {
      const s = rates.special;
      const hourly = +(s.hourlyRate) || 0;
      const delH = 1;
      const workH = 4;
      let base = hourly * (workH + delH);
      const shift = (s.shiftOptions || []).find((r) => r.code === '4+1' && r.shift);
      if (shift && shift.shift) base = shift.shift;
      return base;
    }
    if (dist > 80 && rates.intercity && rates.intercity.perKm) {
      const ic = rates.intercity;
      const km = ic.distanceCalculation === 'one_way_x2' ? dist * 2 : dist;
      const rate = km > 200 && ic.perKmLong ? ic.perKmLong : ic.perKm;
      let base = km * rate;
      if (ic.minimum && base < ic.minimum) base = ic.minimum;
      return base;
    }
    const c = rates.city;
    const shift = (c.shiftOptions || []).find((r) => r.code === '7+1' && r.shift);
    if (shift && shift.shift) return shift.shift;
    const hourly = +(c.hourlyRate) || 0;
    return hourly * 8;
  }

  const URGENCY_TAG_LABELS = {
    urgent: 'Поздняя заявка (+30%)',
    very_urgent: 'Срочный заказ (+30%)',
    night: 'Ночная работа (+40%)',
    weekend: 'Работа в выходной (+25%)',
    holiday: 'Праздничный день (+75%)',
  };

  function surchargeLabelsFromTags(tags) {
    return (tags || []).map((t) => URGENCY_TAG_LABELS[t] || t).filter(Boolean);
  }

  function calculateOrderPrice(vehicle, company, order, ctx) {
    const v = normalizeVehicleFleetMeta(vehicle);
    const rates = v.rates;
    const distanceKm = (ctx && ctx.distanceKm) || (order && order.routeDistanceKm) || 0;
    let base = basePriceFromRates(v, order, distanceKm);
    const tags = urgencyTagsForOrder(order, company, (ctx && ctx.now) || new Date());
    const mult = combinedUrgencyMultiplier(rates, tags, company);
    let afterUrgency = Math.round(base * mult);
    const minSur = +(rates.minSurcharge) || 0;
    let total = afterUrgency;
    if (minSur > 0 && total - base < minSur) total = Math.round(base + minSur);
    const lines = [{ label: 'База', amount: Math.round(base) }];
    const u = rates.urgencyMultipliers || defaultRates().urgencyMultipliers;
    const rules = (company && company.acceptanceRules) || defaultAcceptanceRules();
    const seen = new Set();
    let surSum = 0;
    (tags || []).forEach((t) => {
      if (!t || seen.has(t)) return;
      seen.add(t);
      const label = URGENCY_TAG_LABELS[t] || t;
      let k = u[t] || 1;
      if (t === 'urgent' && rules.urgentSurcharge > 1) k = +rules.urgentSurcharge;
      if (k <= 1) return;
      const part = Math.round(base * (k - 1));
      surSum += part;
      lines.push({ label, amount: part });
    });
    if (surSum > 0 && Math.abs(surSum - (afterUrgency - Math.round(base))) > 2) {
      lines.push({ label: 'Срочность (итого)', amount: afterUrgency - Math.round(base) });
    }
    if (total > afterUrgency) lines.push({ label: 'Мин. доплата', amount: total - afterUrgency });
    return {
      total,
      base: Math.round(base),
      multiplier: mult,
      tags,
      surchargeLabels: surchargeLabelsFromTags(tags),
      lines,
      currency: 'RUB',
    };
  }

  function trafficFactor(now) {
    const n = now || new Date();
    const h = n.getHours();
    const dow = n.getDay();
    if (dow === 0 || dow === 6) return 0.8;
    if (h >= 7 && h <= 10) return 1.5;
    if (h >= 17 && h <= 20) return 1.5;
    if (h >= 22 || h < 6) return 1.2;
    return 1.0;
  }

  function calculateDeliveryTime(vehicle, orderAddress, ctx) {
    const v = vehicle || {};
    const loc = v.location || defaultLocation();
    const km = (ctx && ctx.distanceKm) || 12;
    const factor = trafficFactor((ctx && ctx.now) || new Date());
    const speedKmh = 35 / factor;
    const minutes = Math.max(15, Math.round((km / speedKmh) * 60));
    return {
      minutes,
      source: (ctx && ctx.etaSource) || 'estimate',
      confidence: (ctx && ctx.etaSource) === 'maps' ? 0.9 : 0.6,
    };
  }

  const RISK_LABELS = {
    low_rating: 'Низкий рейтинг',
    new_carrier: 'Новый перевозчик',
    few_orders: 'Мало заказов',
    long_delivery: 'Долгая подача',
    price_above_market: 'Цена выше рынка',
    cancellation_risk: 'Риск отмены',
    prepayment: 'Требуется предоплата',
  };

  function assessCarrierRisks(vehicle, company, order, quote) {
    const risks = [];
    const rating = (company && company.rating) || (vehicle && vehicle.rating) || {};
    if (+(rating.score) > 0 && rating.score < 4) risks.push('low_rating');
    if (+(rating.totalOrders) >= 0 && rating.totalOrders < 20) risks.push('few_orders');
    if (+(rating.cancellationRate) > 0.05) risks.push('cancellation_risk');
    const eta = calculateDeliveryTime(vehicle, order && order.loadingAddress, quote || {});
    if (eta.minutes > 90) risks.push('long_delivery');
    if (quote && quote.marketAvg && quote.total > quote.marketAvg * 1.2) risks.push('price_above_market');
    return risks.map((id) => ({ id, label: RISK_LABELS[id] || id }));
  }

  function buildCustomerQuoteVariants(vehicles, company, order, ctx) {
    const list = (vehicles || []).slice(0, 20);
    const priced = list.map((veh) => {
      const price = calculateOrderPrice(veh, company, order, ctx);
      const eta = calculateDeliveryTime(veh, order && order.loadingAddress, ctx);
      const risks = assessCarrierRisks(veh, company, order, { total: price.total });
      return { vehicle: veh, price, eta, risks };
    });
    if (!priced.length) return [];
    priced.sort((a, b) => a.price.total - b.price.total);
    const cheap = priced[0];
    const fast = priced.slice().sort((a, b) => a.eta.minutes - b.eta.minutes)[0];
    const reliable = priced.slice().sort((a, b) => {
      const ra = (a.vehicle.rating && a.vehicle.rating.score) || 0;
      const rb = (b.vehicle.rating && b.vehicle.rating.score) || 0;
      return rb - ra;
    })[0];
    return [
      { key: 'cheap', title: 'Дешёвый', pick: cheap },
      { key: 'fast', title: 'Быстрый', pick: fast },
      { key: 'reliable', title: 'Надёжный', pick: reliable },
    ];
  }

  function signedAppsForVehicle(plate, companyId, fromDate, toDate) {
    const out = [];
    const orders = typeof state !== 'undefined' && state && state.orders ? state.orders : [];
    orders.forEach((o) => {
      if (!o || !o.transportApp || !o.transportApp.signedAt) return;
      if (o.transportApp.vehiclePlate !== plate) return;
      if (companyId && o.carrierCompanyId !== companyId && o.transportApp.carrierCompanyId !== companyId) return;
      const at = o.vehicleAt || o.transportApp.signedAt;
      const t = new Date(at).getTime();
      if (fromDate && t < fromDate.getTime()) return;
      if (toDate && t > toDate.getTime()) return;
      out.push(o);
    });
    return out;
  }

  function checkExchangeConflict(vehicle, order) {
    const plate = vehicle && vehicle.plate;
    if (!plate || !order) return { conflict: false, signed: [] };
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const signed = signedAppsForVehicle(plate, vehicle.companyId, tomorrow, dayAfter);
    const urgent =
      order.pricingUrgency === 'urgent' ||
      order.pricingUrgency === 'very_urgent' ||
      order.fulfillment === 'logist';
    return { conflict: urgent && signed.length > 0, signed, urgent };
  }

  function cancellationPenaltyAmount(company, hoursBefore) {
    const pol = (company && company.cancellationPolicy) || defaultCancellationPolicy();
    const tiers = (pol.penaltyTiers || []).slice().sort((a, b) => b.hoursBefore - a.hoursBefore);
    let pct = 100;
    for (const t of tiers) {
      if (hoursBefore >= t.hoursBefore) {
        pct = t.penaltyPercent;
        break;
      }
    }
    const raw = 10000 * (pct / 100);
    const min = pol.minPenalty || 0;
    const max = pol.maxPenalty || 1e9;
    return Math.min(max, Math.max(min, Math.round(raw)));
  }

  function promptExchangeConflict(conflict, company) {
    const signed = conflict.signed || [];
    const nums = signed.map((o) => o.sequentialNumber).join(', ');
    const penalty = cancellationPenaltyAmount(company, 12);
    const msg =
      'На это авто уже подписаны заявки на завтра (№' +
      nums +
      ').\n\n' +
      '1 — взять срочный, отменить завтрашний (штраф ~' +
      penalty +
      ' ₽)\n' +
      '2 — взять срочный, завтрашний на другую машину\n' +
      '3 — отказаться от срочного';
    const choice = prompt(msg, '3');
    if (choice === '1') return { action: 'cancel_signed', penalty };
    if (choice === '2') return { action: 'reassign' };
    return { action: 'abort' };
  }

  g.armadaFleetRates = {
    OUTSIDE_KAD_TYPES,
    SHIFT_CODES,
    defaultRates,
    defaultSchedule,
    defaultLocation,
    defaultRating,
    defaultAcceptanceRules,
    defaultCancellationPolicy,
    normalizeVehicleRates,
    normalizeVehicleFleetMeta,
    normalizeCompanyPolicies,
    vehicleRateProfile,
    setShiftPrices,
    calculateOrderPrice,
    calculateDeliveryTime,
    assessCarrierRisks,
    buildCustomerQuoteVariants,
    checkExchangeConflict,
    promptExchangeConflict,
    cancellationPenaltyAmount,
    isAfterCutOff,
    urgencyTagsForOrder,
    surchargeLabelsFromTags,
    URGENCY_TAG_LABELS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
