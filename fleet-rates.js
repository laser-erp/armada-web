/* Тарифы ТС, график, cut-off, расчёт цены, риски (staging + prod-safe defaults). */
(function (g) {
  const OUTSIDE_KAD_TYPES = [
    'extra_delivery_hour',
    'km_both_ways',
    'km_one_way_x2',
    'fixed_surcharge',
    'separate_delivery',
  ];

  const OUTSIDE_KAD_LABELS = {
    extra_delivery_hour: 'Добавить час подачи',
    km_both_ways: 'Километры в обе стороны',
    km_one_way_x2: 'Километры в одну сторону ×2',
    fixed_surcharge: 'Фиксированная доплата',
    separate_delivery: 'Доставка отдельно',
  };

  const DEFAULT_SPECIAL_DELIVERY_NOTE = 'Доставка от базы — по фактическому пробегу';

  let _catalogTariffRules = null;
  function setCatalogTariffRules(rows) {
    _catalogTariffRules = Array.isArray(rows) ? rows : null;
  }
  function getCatalogTariffRules() {
    return _catalogTariffRules || [];
  }

  const SHIFT_CODES = ['3+1', '4+1', '5+1', '7+1', '8+1'];
  const RATES_BY_TYPE_IDS = [
    'board',
    'tent',
    'furgon',
    'ref',
    'iso',
    'gazelle',
    'medium',
    'heavy',
    'manipulator',
    'tral',
    'avtokran',
  ];

  function shiftRow(code, workHours, deliveryHours, shift) {
    const row = { code, workHours, deliveryHours, shift: shift != null ? shift : null };
    if (shift != null && +shift > 0) row.price = +shift;
    return row;
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

  function shiftOptionAmount(row) {
    if (!row || typeof row !== 'object') return null;
    if (row.price != null && +row.price > 0) return +row.price;
    if (row.shift != null && +row.shift > 0) return +row.shift;
    return null;
  }

  function shiftOptionIsMinimum(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (raw.isMinimum === true) return true;
    if (raw.isMinimum === 1 || raw.isMinimum === '1') return true;
    return false;
  }

  function normalizeShiftOptionRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const priceVal = shiftOptionAmount(raw);
    let row;
    if (raw.code) {
      let wh = raw.workHours;
      let dh = raw.deliveryHours;
      if (wh == null || dh == null) {
        const m = String(raw.code).match(/^(\d+)\+(\d+)$/);
        if (m) {
          wh = +m[1];
          dh = +m[2];
        }
      }
      row = shiftRow(raw.code, wh, dh, priceVal);
    } else {
      const wh = +raw.workHours || 0;
      const dh = +raw.deliveryHours || 0;
      const code = wh > 0 && dh >= 0 ? wh + '+' + dh : '4+1';
      row = shiftRow(code, wh || 4, dh || 1, priceVal);
    }
    if (shiftOptionIsMinimum(raw)) row.isMinimum = true;
    return row;
  }

  function shiftOptionToCompanyFormat(raw) {
    const n = normalizeShiftOptionRow(raw);
    if (!n) return null;
    const price = shiftOptionAmount(raw);
    const out = {
      workHours: n.workHours,
      deliveryHours: n.deliveryHours,
      price: price != null && !Number.isNaN(price) ? price : null,
    };
    if (n.isMinimum) out.isMinimum = true;
    return out;
  }

  function defaultSpecialBlockForType(type, cityHourly) {
    const t = String(type || 'board').trim();
    const hourly = cityHourly != null ? +cityHourly : null;
    let deliveryNote = DEFAULT_SPECIAL_DELIVERY_NOTE;
    if (t === 'tral') deliveryNote = 'Доставка негабарита — отдельно, по факту';
    if (t === 'avtokran') deliveryNote = 'Доставка от базы — по фактическому пробегу, не более 100 км';
    return {
      hourlyRate: hourly,
      deliveryNote,
    };
  }

  function defaultRatesByTypeEntry(type) {
    const t = String(type || 'board').trim() || 'board';
    const isSpecType = ['manipulator', 'avtokran', 'tral'].includes(t);
    if (t === 'board') {
      const cityHourly = 2250;
      return {
        type: t,
        city: {
          hourlyRate: cityHourly,
          includedKm: 35,
          extraKmRate: 35,
          shiftOptions: [
            { workHours: 5, deliveryHours: 1, price: 18000 },
            { workHours: 7, deliveryHours: 1, price: 22000 },
          ],
        },
        intercity: { perKm: 87, perKmLong: 70 },
        special: defaultSpecialBlockForType(t, cityHourly),
      };
    }
    const cityHourly = isSpecType ? 3500 : 2000;
    return {
      type: t,
      city: {
        hourlyRate: cityHourly,
        includedKm: 30,
        extraKmRate: 32,
        shiftOptions: [{ workHours: 4, deliveryHours: 1, price: isSpecType ? 28000 : 16000 }],
      },
      intercity: { perKm: 80, perKmLong: 65 },
      special: defaultSpecialBlockForType(t, cityHourly),
    };
  }

  function mergeRatesByTypeEntry(base, patch) {
    if (!patch) return base;
    const out = Object.assign({}, base, { type: base.type || patch.type });
    const bc = base.city || {};
    const pc = patch.city || {};
    out.city = Object.assign({}, bc, {
      hourlyRate: pc.hourlyRate != null ? pc.hourlyRate : bc.hourlyRate,
      includedKm: pc.includedKm != null ? pc.includedKm : bc.includedKm,
      extraKmRate: pc.extraKmRate != null ? pc.extraKmRate : bc.extraKmRate,
      kmPerDeliveryHour: pc.kmPerDeliveryHour != null ? pc.kmPerDeliveryHour : bc.kmPerDeliveryHour,
      outsideKadPolicy: pc.outsideKadPolicy || bc.outsideKadPolicy,
      shiftOptions: pc.shiftOptions && pc.shiftOptions.length ? pc.shiftOptions : bc.shiftOptions,
    });
    const bi = base.intercity || {};
    const pi = patch.intercity || {};
    out.intercity = Object.assign({}, bi, {
      perKm: pi.perKm != null ? pi.perKm : bi.perKm,
      perKmLong: pi.perKmLong != null ? pi.perKmLong : bi.perKmLong,
    });
    if (patch.companyOverride) out.companyOverride = true;
    if (patch.catalogCode) out.catalogCode = patch.catalogCode;
    return out;
  }

  function catalogRecordToRatesEntry(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const d = rec.data && typeof rec.data === 'object' ? rec.data : {};
    const type = String(d.vehicleType || rec.group || '').trim();
    if (!type) return null;
    const rates = d.rates && typeof d.rates === 'object' ? d.rates : {};
    const city = rates.city && typeof rates.city === 'object' ? rates.city : {};
    const ic = rates.intercity && typeof rates.intercity === 'object' ? rates.intercity : {};
    const shiftOpts = Array.isArray(city.shiftOptions)
      ? city.shiftOptions.map(shiftOptionToCompanyFormat).filter(Boolean)
      : [];
    return normalizeRatesByTypeEntry({
      type,
      catalogCode: rec.code,
      city: {
        hourlyRate: city.hourlyRate,
        includedKm: city.includedKm,
        extraKmRate: city.extraKmRate,
        kmPerDeliveryHour: city.kmPerDeliveryHour,
        shiftOptions: shiftOpts,
        outsideKadPolicy: city.outsideKadPolicy,
      },
      intercity: ic,
    });
  }

  function globalRatesEntryForType(typeId) {
    const t = String(typeId || 'board').trim() || 'board';
    const rules = getCatalogTariffRules();
    const match = rules.find((r) => {
      const d = (r && r.data) || {};
      return String(d.vehicleType || r.group || '').trim() === t;
    });
    if (match) {
      const e = catalogRecordToRatesEntry(match);
      if (e) return Object.assign(e, { inheritedFromCatalog: true });
    }
    return Object.assign(defaultRatesByTypeEntry(t), { inheritedFromCatalog: true });
  }

  function companyTypeOverrideEntry(company, typeId) {
    if (!company || !Array.isArray(company.ratesByType)) return null;
    const t = String(typeId || '').trim();
    const row = company.ratesByType.find((x) => x && x.type === t);
    if (!row) return null;
    if (!row.companyOverride && !company.ratesCorrectedByOwner) return null;
    const n = normalizeRatesByTypeEntry(row);
    if (n) n.companyOverride = true;
    return n;
  }

  function effectiveRatesByTypeEntry(company, typeId) {
    const base = globalRatesEntryForType(typeId);
    const ov = companyTypeOverrideEntry(company, typeId);
    if (!ov) return base;
    return mergeRatesByTypeEntry(base, ov);
  }

  function normalizeRatesByTypeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = String(raw.type || '').trim();
    if (!type) return null;
    const cityRaw = raw.city && typeof raw.city === 'object' ? raw.city : {};
    const icRaw = raw.intercity && typeof raw.intercity === 'object' ? raw.intercity : {};
    const shiftOpts = Array.isArray(cityRaw.shiftOptions)
      ? cityRaw.shiftOptions.map(shiftOptionToCompanyFormat).filter(Boolean)
      : [];
    const spRaw = raw.special && typeof raw.special === 'object' ? raw.special : {};
    const cityHourly = cityRaw.hourlyRate != null ? +cityRaw.hourlyRate : null;
    const spHourly = spRaw.hourlyRate != null ? +spRaw.hourlyRate : cityHourly;
    const spNote =
      spRaw.deliveryNote != null && String(spRaw.deliveryNote).trim()
        ? String(spRaw.deliveryNote).trim()
        : defaultSpecialBlockForType(type, spHourly).deliveryNote;
    const out = {
      type,
      city: {
        hourlyRate: cityHourly,
        includedKm: cityRaw.includedKm != null ? +cityRaw.includedKm : null,
        extraKmRate: cityRaw.extraKmRate != null ? +cityRaw.extraKmRate : null,
        kmPerDeliveryHour: cityRaw.kmPerDeliveryHour != null ? +cityRaw.kmPerDeliveryHour : null,
        outsideKadPolicy: cityRaw.outsideKadPolicy,
        shiftOptions: shiftOpts,
      },
      intercity: {
        perKm: icRaw.perKm != null ? +icRaw.perKm : null,
        perKmLong: icRaw.perKmLong != null ? +icRaw.perKmLong : null,
      },
      special: {
        hourlyRate: spHourly,
        deliveryNote: spNote,
      },
    };
    if (raw.companyOverride) out.companyOverride = true;
    if (raw.catalogCode) out.catalogCode = raw.catalogCode;
    return out;
  }

  function ratesEntryToLegacyRates(entry) {
    const e = entry || defaultRatesByTypeEntry('board');
    const city = e.city || {};
    const ic = e.intercity || {};
    const rates = defaultRates();
    rates.city.hourlyRate = city.hourlyRate;
    rates.city.includedKm = city.includedKm;
    rates.city.extraKmRate = city.extraKmRate;
    rates.city.shiftOptions = (city.shiftOptions || []).map(normalizeShiftOptionRow).filter(Boolean);
    rates.city.shiftOptions.forEach((row) => {
      const p = shiftOptionAmount(row);
      if (p != null) row.shift = p;
    });
    if (!rates.city.shiftOptions.length) rates.city.shiftOptions = defaultShiftOptions();
    rates.intercity.perKm = ic.perKm;
    rates.intercity.perKmLong = ic.perKmLong;
    const t = String(e.type || '');
    const sp = e.special && typeof e.special === 'object' ? e.special : {};
    const spHourly = sp.hourlyRate != null ? +sp.hourlyRate : city.hourlyRate;
    if (spHourly != null && !Number.isNaN(spHourly)) rates.special.hourlyRate = spHourly;
    if (sp.deliveryNote) rates.special.deliveryNote = String(sp.deliveryNote);
    else if (!rates.special.deliveryNote) {
      rates.special.deliveryNote = defaultSpecialBlockForType(t, spHourly).deliveryNote;
    }
    if (['manipulator', 'avtokran', 'tral'].includes(t)) {
      if (rates.special.hourlyRate == null) rates.special.hourlyRate = city.hourlyRate;
      rates.special.shiftOptions = rates.city.shiftOptions.slice();
    }
    return rates;
  }

  function legacyVehicleRatesToByTypeEntry(type, legacy) {
    const r = legacy || defaultRates();
    return normalizeRatesByTypeEntry({
      type,
      city: {
        hourlyRate: r.city.hourlyRate,
        includedKm: r.city.includedKm,
        extraKmRate: r.city.extraKmRate,
        shiftOptions: (r.city.shiftOptions || []).map(shiftOptionToCompanyFormat).filter(Boolean),
      },
      intercity: {
        perKm: r.intercity.perKm,
        perKmLong: r.intercity.perKmLong,
      },
      special: {
        hourlyRate: r.special && r.special.hourlyRate,
        deliveryNote: r.special && r.special.deliveryNote,
      },
    });
  }

  /** Первая машина каждого типа с own rates → companies[].ratesByType (без затирания уже заданных типов). */
  function buildCompanyRatesByTypeFromVehicles(company, vehicles) {
    if (!company || !company.id) return false;
    const cid = String(company.id);
    let list = Array.isArray(company.ratesByType) ? company.ratesByType.slice() : [];
    const have = new Set(list.map((x) => x && x.type).filter(Boolean));
    let changed = false;
    const byTypeFirst = {};
    (vehicles || []).forEach((v) => {
      if (!v || String(v.companyId) !== cid) return;
      const t = String(v.bodyTypeId || v.vehicleClass || '').trim();
      if (!t || byTypeFirst[t]) return;
      if (v.rates == null || typeof v.rates !== 'object') return;
      byTypeFirst[t] = v;
    });
    Object.keys(byTypeFirst).forEach((t) => {
      if (have.has(t)) return;
      const entry = legacyVehicleRatesToByTypeEntry(t, normalizeVehicleRates(byTypeFirst[t]));
      if (entry) {
        list.push(entry);
        have.add(t);
        changed = true;
      }
    });
    if (changed) company.ratesByType = list;
    return changed;
  }

  function normalizeCompanyRatesByType(company, opts) {
    if (!company || typeof company !== 'object') return false;
    const fillAll = opts && opts.fillAllDefaults;
    let list = Array.isArray(company.ratesByType) ? company.ratesByType : [];
    let changed = false;
    const normalized = list
      .map((raw) => {
        const n = normalizeRatesByTypeEntry(raw);
        if (!n) {
          changed = true;
          return null;
        }
        if (raw.companyOverride) n.companyOverride = true;
        return n;
      })
      .filter(Boolean);
    if (normalized.length !== list.length) changed = true;
    list = normalized;
    if (fillAll && (company.roles || []).some((r) => r === 'own' || r === 'carrier')) {
      const seen = new Set(list.map((x) => x.type));
      RATES_BY_TYPE_IDS.forEach((id) => {
        if (!seen.has(id)) {
          list.push(defaultRatesByTypeEntry(id));
          changed = true;
        }
      });
    }
    company.ratesByType = list;
    return changed;
  }

  function companyRatesEntry(company, typeId) {
    if (!company || !Array.isArray(company.ratesByType)) return null;
    const t = String(typeId || '').trim();
    return company.ratesByType.find((x) => x && x.type === t) || null;
  }

  function resolveRatesForVehicle(vehicle, company) {
    if (vehicle && vehicle.rates && typeof vehicle.rates === 'object') {
      const r = normalizeVehicleRates(vehicle);
      if (vehicle.correctedByOwner) r.correctedByOwner = true;
      r._vehicleOverride = !!(
        vehicle.correctedByOwner ||
        (vehicle.rates && vehicle.rates.correctedByOwner) ||
        r.correctedByOwner
      );
      return r;
    }
    const typeId = String((vehicle && (vehicle.bodyTypeId || vehicle.vehicleClass)) || 'board').trim();
    const entry = company ? effectiveRatesByTypeEntry(company, typeId) : globalRatesEntryForType(typeId);
    const legacy = ratesEntryToLegacyRates(entry);
    legacy._inheritedFromCompany = !entry.companyOverride;
    legacy._inheritedFromCatalog = !entry.companyOverride && entry.inheritedFromCatalog;
    return legacy;
  }

  function vehicleForOrderPricing(order, companyId) {
    const vehicles =
      typeof state !== 'undefined' && state && Array.isArray(state.vehicles) ? state.vehicles : [];
    const cid = companyId || (order && order.ownCompanyId) || (order && order.carrierCompanyId);
    const typeIds = (order && order.vehicleTypeIds) || [];
    const typeId = typeIds[0] || (order && order.reqBodyType) || 'board';
    const plate = order && order.vehiclePlate;
    if (plate) {
      const byPlate = vehicles.find((v) => v && v.plate === plate && (!cid || v.companyId === cid));
      if (byPlate) return byPlate;
    }
    return (
      vehicles.find(
        (v) =>
          v &&
          (!cid || v.companyId === cid) &&
          (v.bodyTypeId === typeId || v.vehicleClass === typeId)
      ) || { bodyTypeId: typeId, vehicleClass: typeId, rates: null }
    );
  }

  function carrierBaseForOrder(order, company) {
    if (!order) return null;
    const co = company || null;
    const veh = vehicleForOrderPricing(order, co && co.id);
    const rates = resolveRatesForVehicle(veh, co);
    const vStub = Object.assign({}, veh, { rates });
    const dist = +(order.routeKm || order.routeDistanceKm || order.estimateKm) || 0;
    const trip = order.tripMode === 'intercity' || dist > 80 ? 'intercity' : 'city';
    const draft = Object.assign({}, order, { tripMode: trip, routeDistanceKm: dist || null });
    const base = basePriceFromRates(vStub, draft, dist);
    return base > 0 ? Math.round(base) : null;
  }

  function hourlyMinimumConfiguredForOrder(order, company) {
    if (!order || orderPricingMode(order) !== 'hourly') return true;
    const co = company || null;
    const veh = vehicleForOrderPricing(order, co && co.id);
    const rates = resolveRatesForVehicle(veh, co);
    const vStub = Object.assign({}, veh, { rates });
    const profile = vehicleRateProfile(vStub);
    const block = profile === 'special' ? rates.special : rates.city;
    return hourlyMinimumConfigured(block);
  }

  function normalizeVehicleFleetMeta(v) {
    if (!v) return v;
    if (v.rates === null) {
      v.rates = null;
    } else {
      v.rates = normalizeVehicleRates(v);
    }
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

  function urgencyReferenceDate(order, now) {
    if (now instanceof Date && !isNaN(now.getTime())) return now;
    const raw = order && (order.vehicleAt || order.createdAt);
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return now instanceof Date ? now : new Date();
  }

  function urgencyTagsForOrder(order, company, now) {
    const tags = [];
    const n = urgencyReferenceDate(order, now);
    const rules = (company && company.acceptanceRules) || defaultAcceptanceRules();
    if (order && order.pricingUrgency === 'urgent') tags.push('urgent');
    if (order && order.pricingUrgency === 'very_urgent') tags.push('very_urgent');
    if (order && order.pricingUrgency === 'night' && !tags.includes('night')) tags.push('night');
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

  /** Код пакета смены из заказа (город / биржа): cityShiftCode и синонимы. */
  function orderCityShiftCode(order) {
    if (!order || typeof order !== 'object') return '';
    const raw =
      order.cityShiftCode ??
      order.carrierShiftCode ??
      order.shiftPackageCode ??
      order.shiftOptionCode ??
      '';
    return String(raw || '').trim();
  }

  function shiftRowForPricing(block, code) {
    const opts = (block && block.shiftOptions) || [];
    const want = String(code || '7+1').trim() || '7+1';
    const hit = opts.find((r) => r && r.code === want);
    if (hit) return hit;
    const m = want.match(/^(\d+)\+(\d+)$/);
    if (m) return normalizeShiftOptionRow({ code: want, workHours: +m[1], deliveryHours: +m[2] });
    return normalizeShiftOptionRow({ code: '7+1', workHours: 7, deliveryHours: 1 });
  }

  function shiftPackageHours(row) {
    if (!row) return 0;
    let wh = +(row.workHours || 0);
    let dh = +(row.deliveryHours || 0);
    if (!(wh + dh > 0) && row.code) {
      const m = String(row.code).match(/^(\d+)\+(\d+)$/);
      if (m) {
        wh = +m[1];
        dh = +m[2];
      }
    }
    return Math.max(0, wh) + Math.max(0, dh);
  }

  const ORDER_PRICING_MODES = ['trip', 'hourly', 'shift'];

  /** Фиксированная цена рейса в заявке (не в тарифе shiftOptions.price). */
  function orderTripPrice(order) {
    if (!order || typeof order !== 'object') return null;
    const raw = order.tripPrice ?? order.fixedTripPrice ?? order.pricePerTrip ?? null;
    const n = raw != null ? +raw : NaN;
    return n > 0 ? Math.round(n) : null;
  }

  /** Вид оплаты в заявке: рейс / почасовая / смена (пакет из тарифа). */
  function orderPricingMode(order) {
    if (!order || typeof order !== 'object') return 'shift';
    const raw = String(order.orderPricingMode || order.pricingMode || '').trim().toLowerCase();
    if (ORDER_PRICING_MODES.includes(raw)) return raw;
    if (orderTripPrice(order) != null) return 'trip';
    return 'shift';
  }

  /** Часы минимального пакета (работа+подача) — только строка shiftOptions с isMinimum. */
  function minimumPackageHoursFromBlock(block) {
    const opts = (block && block.shiftOptions) || [];
    const marked = opts.filter((row) => shiftOptionIsMinimum(row));
    if (!marked.length) return null;
    const row = marked[0];
    const h = shiftPackageHours(row);
    return h > 0 ? h : null;
  }

  function hourlyMinimumConfigured(block) {
    return minimumPackageHoursFromBlock(block) != null;
  }

  /** Почасовая: max(факт, минималка пакета) × ставка; без isMinimum — только факт. */
  function cityHourlyPriceFromRates(block, order) {
    const hourly = +(block && block.hourlyRate) || 0;
    if (!(hourly > 0)) return 0;
    const fact =
      +(order && (order.workHours ?? order.estimateWorkHours ?? order.timeLoadedHours)) || 0;
    const minH = minimumPackageHoursFromBlock(block);
    const charged = minH != null && minH > 0 ? Math.max(fact, minH) : fact;
    return Math.round(hourly * charged);
  }

  /** База смены по тарифу: (работа+подача пакета)×hourlyRate; price в shiftOptions не используем. */
  function cityBasePriceFromHourlyAndShift(block, order) {
    const hourly = +(block && block.hourlyRate) || 0;
    if (!(hourly > 0)) return 0;
    const code = orderCityShiftCode(order) || '7+1';
    const row = shiftRowForPricing(block, code);
    const hours = shiftPackageHours(row) || 8;
    return hourly * hours;
  }

  /**
   * ₽/ч для отображения почасового пакета.
   * При цене за рейс в заявке — 0 (часовую ставку не выводим).
   */
  function shiftEffectiveHourlyRate(block, order) {
    if (orderPricingMode(order) === 'trip') return 0;
    return +(block && block.hourlyRate) || 0;
  }

  function cityBaseForOrderPricing(block, order, mode) {
    const m = mode || orderPricingMode(order);
    if (m === 'hourly') return cityHourlyPriceFromRates(block, order);
    return cityBasePriceFromHourlyAndShift(block, order);
  }

  /** Превышение лимитов рейса (только подсветка, без доплаты). */
  function tripLimitWarnings(order) {
    if (!order || orderPricingMode(order) !== 'trip') return [];
    const out = [];
    const kmLim = +(order.tripKmLimit || order.tripPackageKmLimit) || 0;
    const loadLim = +(order.tripLoadingMinutesLimit || order.loadingMinutesLimit) || 0;
    const unloadLim = +(order.tripUnloadingMinutesLimit || order.unloadingMinutesLimit) || 0;
    const kmFact =
      +(order.packageKm || order.routeKm || order.estimateKm || order.loadedKm) || 0;
    if (kmLim > 0 && kmFact > kmLim) {
      out.push({ id: 'km', label: `Км ${kmFact} > лимита ${kmLim}` });
    }
    const loadMin = +(order.timeLoadingMinutes || order.loadingMinutes) || 0;
    const unloadMin = +(order.timeUnloadingMinutes || order.unloadingMinutes) || 0;
    if (loadLim > 0 && loadMin > loadLim) {
      out.push({ id: 'load', label: `Погрузка ${loadMin} мин > лимита ${loadLim} мин` });
    }
    if (unloadLim > 0 && unloadMin > unloadLim) {
      out.push({ id: 'unload', label: `Выгрузка ${unloadMin} мин > лимита ${unloadLim} мин` });
    }
    return out;
  }

  function basePriceFromRates(vehicle, order, distanceKm, company) {
    const mode = orderPricingMode(order);
    if (mode === 'trip') {
      const tripFixed = orderTripPrice(order);
      if (tripFixed != null) return tripFixed;
    }
    const v = vehicle && vehicle.rates === null ? Object.assign({}, vehicle) : normalizeVehicleFleetMeta(vehicle);
    const co =
      company ||
      (typeof findCompanyById === 'function' && v.companyId ? findCompanyById(v.companyId) : null);
    const rates =
      v.rates && typeof v.rates === 'object' ? v.rates : resolveRatesForVehicle(v, co);
    const dist = +(distanceKm || order && order.routeDistanceKm) || 0;
    const profile = vehicleRateProfile(v);
    if (profile === 'special') {
      const s = rates.special;
      const base = cityBaseForOrderPricing(s, order, mode);
      if (base > 0) return base;
      const hourly = +(s.hourlyRate) || 0;
      return hourly > 0 ? hourly * 5 : 0;
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
    const base = cityBaseForOrderPricing(c, order, mode);
    return base > 0 ? base : 0;
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
    const mode = orderPricingMode(order);
    if (mode === 'trip') {
      const tripFixed = orderTripPrice(order);
      if (tripFixed != null) {
        const limits = tripLimitWarnings(order);
        return {
          total: tripFixed,
          base: tripFixed,
          multiplier: 1,
          tags: [],
          surchargeLabels: [],
          lines: [{ label: 'Цена за рейс', amount: tripFixed }],
          tripLimitWarnings: limits,
          currency: 'RUB',
        };
      }
    }
    if (mode === 'hourly') {
      const v0 =
        vehicle && vehicle.rates === null ? Object.assign({}, vehicle) : normalizeVehicleFleetMeta(vehicle);
      const rates0 = resolveRatesForVehicle(v0, company);
      const block = vehicleRateProfile(v0) === 'special' ? rates0.special : rates0.city;
      const base = cityHourlyPriceFromRates(block, order);
      if (base > 0) {
        const fact =
          +(order && (order.workHours ?? order.estimateWorkHours ?? order.timeLoadedHours)) || 0;
        const minH = minimumPackageHoursFromBlock(block);
        const charged = minH != null && minH > 0 ? Math.max(fact, minH) : fact;
        const hourly = +(block && block.hourlyRate) || 0;
        const minMissing = minH == null;
        const lineLabel = minMissing
          ? `Почасовая ${charged} ч × ${hourly} ₽ (минималка не задана в тарифе)`
          : `Почасовая ${charged} ч × ${hourly} ₽`;
        return {
          total: base,
          base,
          multiplier: 1,
          tags: [],
          surchargeLabels: [],
          lines: [{ label: lineLabel, amount: base }],
          hourlyMinimumMissing: minMissing,
          currency: 'RUB',
        };
      }
    }
    const v = vehicle && vehicle.rates === null ? Object.assign({}, vehicle) : normalizeVehicleFleetMeta(vehicle);
    const rates = resolveRatesForVehicle(v, company);
    const distanceKm = (ctx && ctx.distanceKm) || (order && order.routeDistanceKm) || 0;
    let base = basePriceFromRates(v, order, distanceKm, company);
    const tags = urgencyTagsForOrder(order, company, ctx && ctx.now);
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

  function normVehiclePlate(p) {
    const s = String(p || '').trim();
    if (!s || s === '—' || s === '-' || s === 'Биржа' || s === 'Диспетчер') return '';
    return s;
  }

  function orderOpenForVehicleSchedule(o) {
    if (!o || o.cancelledAt || o.cancelled) return false;
    if (o.closedAt && o.cancelReason) return false;
    if (typeof looksClosedOrder === 'function' && looksClosedOrder(o)) return false;
    if (o.closedAt) return false;
    if (o.bookStatus === 'cancelled' || o.bookStatus === 'rejected') return false;
    return true;
  }

  function orderVehiclePlateOnOrder(o) {
    const fromOrder = normVehiclePlate(o.vehiclePlate);
    if (fromOrder) return fromOrder;
    const app = o.transportApp;
    if (app && app.vehiclePlate) return normVehiclePlate(app.vehiclePlate);
    if (o.bookStatus !== 'rejected') return normVehiclePlate(o.bookedPlate);
    return '';
  }

  function orderVehicleIdOnOrder(o) {
    const id = o.vehicleId || o.carrierVehicleId || (o.transportApp && o.transportApp.vehicleId);
    return id ? String(id).trim() : '';
  }

  function sameVehicleOnOrder(o, vehicle) {
    if (!o || !vehicle) return false;
    const wantPlate = normVehiclePlate(vehicle.plate);
    const wantId = vehicle.id ? String(vehicle.id).trim() : '';
    const op = orderVehiclePlateOnOrder(o);
    if (wantPlate && op && op === wantPlate) return true;
    const oid = orderVehicleIdOnOrder(o);
    if (wantId && oid && oid === wantId) return true;
    return false;
  }

  function orderScheduleStartMs(o) {
    const at = (o && (o.vehicleAt || (o.transportApp && o.transportApp.signedAt) || o.createdAt)) || '';
    const t = Date.parse(at);
    return Number.isFinite(t) ? t : NaN;
  }

  function orderScheduleEndMs(o) {
    if (!o) return NaN;
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
    if (Number.isFinite(start)) return start + 4 * 3600 * 1000;
    return NaN;
  }

  function scheduleIntervalsOverlap(aStart, aEnd, bStart, bEnd) {
    if (!Number.isFinite(aStart) || !Number.isFinite(bStart)) return false;
    const ae = Number.isFinite(aEnd) ? aEnd : aStart + 3600000;
    const be = Number.isFinite(bEnd) ? bEnd : bStart + 3600000;
    return aStart < be && bStart < ae;
  }

  function findVehicleScheduleConflicts(vehicle, order) {
    const exceptId = order && order.id;
    const list = typeof state !== 'undefined' && state && state.orders ? state.orders : [];
    const aStart = orderScheduleStartMs(order);
    const aEnd = orderScheduleEndMs(order);
    const hits = [];
    list.forEach((o) => {
      if (!o || (exceptId && o.id === exceptId)) return;
      if (!orderOpenForVehicleSchedule(o)) return;
      if (!sameVehicleOnOrder(o, vehicle)) return;
      const bStart = orderScheduleStartMs(o);
      const bEnd = orderScheduleEndMs(o);
      if (scheduleIntervalsOverlap(aStart, aEnd, bStart, bEnd)) hits.push(o);
    });
    return hits;
  }

  function exchangeConflictMessage(conflicting) {
    const nums = (conflicting || [])
      .map((o) => o.sequentialNumber || o.id)
      .filter(Boolean)
      .join(', ');
    if (nums) {
      return (
        'На это авто уже есть заказ на пересекающееся время (№' +
        nums +
        '). Выберите другое время или другую машину.'
      );
    }
    return 'На это авто уже есть заказ на пересекающееся время. Выберите другое время или другую машину.';
  }

  function checkExchangeConflict(vehicle, order) {
    if (!vehicle || !order) {
      return { conflict: false, conflicting: [], signed: [], message: '', urgent: false };
    }
    const plate = normVehiclePlate(vehicle.plate);
    const vehId = vehicle.id ? String(vehicle.id).trim() : '';
    if (!plate && !vehId) {
      return { conflict: false, conflicting: [], signed: [], message: '', urgent: false };
    }
    const conflicting = findVehicleScheduleConflicts(vehicle, order);
    const conflict = conflicting.length > 0;
    const signed = conflicting.filter((o) => o.transportApp && o.transportApp.signedAt);
    const urgent =
      order.pricingUrgency === 'urgent' ||
      order.pricingUrgency === 'very_urgent' ||
      order.fulfillment === 'logist';
    return {
      conflict,
      conflicting,
      signed,
      message: conflict ? exchangeConflictMessage(conflicting) : '',
      urgent,
    };
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

  const MARKET_SHIFT_KEYS = {
    cityShift3: { block: 'city', code: '3+1' },
    cityShift4: { block: 'city', code: '4+1' },
    cityShift5: { block: 'city', code: '5+1' },
    cityShift7: { block: 'city', code: '7+1' },
    shift3: { block: 'special', code: '3+1' },
    shift4: { block: 'special', code: '4+1' },
    shift5: { block: 'special', code: '5+1' },
    shift7: { block: 'special', code: '7+1' },
    shift8: { block: 'special', code: '8+1' },
  };

  function ensureShiftRow(block, code) {
    if (!block.shiftOptions) block.shiftOptions = [];
    let row = block.shiftOptions.find((r) => r && r.code === code);
    if (!row) {
      const m = String(code).match(/^(\d+)\+(\d+)$/);
      row = shiftRow(code, m ? +m[1] : 4, m ? +m[2] : 1, null);
      block.shiftOptions.push(row);
    }
    return row;
  }

  function patchRatesFromMarketData(rates, data) {
    if (!rates || !data || typeof data !== 'object') return;
    const d = data;
    if (d.hourly != null && +d.hourly > 0) {
      rates.city.hourlyRate = +d.hourly;
      if (!(rates.special.hourlyRate > 0)) rates.special.hourlyRate = +d.hourly;
    }
    if (d.perKm != null && +d.perKm > 0) rates.intercity.perKm = +d.perKm;
    if (d.minimum != null && +d.minimum > 0) rates.intercity.minimum = +d.minimum;
    if (d.deliveryNote) rates.special.deliveryNote = String(d.deliveryNote);
    Object.keys(MARKET_SHIFT_KEYS).forEach((key) => {
      if (d[key] == null || !(+d[key] > 0)) return;
      const meta = MARKET_SHIFT_KEYS[key];
      const block = meta.block === 'special' ? rates.special : rates.city;
      const row = ensureShiftRow(block, meta.code);
      row.shift = +d[key];
      row.price = +d[key];
    });
  }

  function marketRatesForBodyType(catalogs, bodyTypeId) {
    const t = String(bodyTypeId || 'board').trim();
    return (catalogs || []).filter((c) => {
      if (!c || c.type !== 'marketRates') return false;
      const g = String(c.group || (c.data && c.data.class) || '').trim();
      return g === t;
    });
  }

  function applyMarketRatesFromCatalog(vehicle, catalogs) {
    const typeId = String((vehicle && (vehicle.bodyTypeId || vehicle.vehicleClass)) || 'board').trim();
    const rows = marketRatesForBodyType(catalogs, typeId);
    if (!rows.length) return { ok: false, reason: 'no_rows', typeId };
    const rates =
      vehicle && vehicle.rates && typeof vehicle.rates === 'object'
        ? normalizeVehicleRates(vehicle)
        : defaultRates();
    const codes = [];
    rows.forEach((row) => {
      if (!row || !row.data) return;
      patchRatesFromMarketData(rates, row.data);
      if (row.code) codes.push(row.code);
    });
    if (codes.length) rates.marketRateCode = codes[codes.length - 1];
    rates.correctedByOwner = false;
    return { ok: true, rates, codes, typeId };
  }

  function outsideKadLabel(code) {
    return OUTSIDE_KAD_LABELS[code] || code;
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
    OUTSIDE_KAD_LABELS,
    outsideKadLabel,
    setCatalogTariffRules,
    getCatalogTariffRules,
    catalogRecordToRatesEntry,
    globalRatesEntryForType,
    effectiveRatesByTypeEntry,
    companyTypeOverrideEntry,
    mergeRatesByTypeEntry,
    SHIFT_CODES,
    RATES_BY_TYPE_IDS,
    defaultRatesByTypeEntry,
    normalizeRatesByTypeEntry,
    normalizeCompanyRatesByType,
    buildCompanyRatesByTypeFromVehicles,
    shiftOptionAmount,
    shiftOptionIsMinimum,
    shiftOptionToCompanyFormat,
    orderCityShiftCode,
    shiftPackageHours,
    ORDER_PRICING_MODES,
    orderTripPrice,
    orderPricingMode,
    minimumPackageHoursFromBlock,
    hourlyMinimumConfigured,
    hourlyMinimumConfiguredForOrder,
    cityHourlyPriceFromRates,
    cityBaseForOrderPricing,
    tripLimitWarnings,
    shiftEffectiveHourlyRate,
    cityBasePriceFromHourlyAndShift,
    companyRatesEntry,
    resolveRatesForVehicle,
    ratesEntryToLegacyRates,
    carrierBaseForOrder,
    vehicleForOrderPricing,
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
    findVehicleScheduleConflicts,
    sameVehicleOnOrder,
    orderScheduleStartMs,
    orderScheduleEndMs,
    scheduleIntervalsOverlap,
    promptExchangeConflict,
    cancellationPenaltyAmount,
    isAfterCutOff,
    urgencyTagsForOrder,
    surchargeLabelsFromTags,
    URGENCY_TAG_LABELS,
    marketRatesForBodyType,
    applyMarketRatesFromCatalog,
    patchRatesFromMarketData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
