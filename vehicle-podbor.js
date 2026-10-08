/* Подбор ТС: тоннаж, сортировка — общая логика (браузер + node-тесты). */
(function (g) {
  function orderCargoItemsTotalKg(o) {
    if (!o || !Array.isArray(o.cargoItems) || !o.cargoItems.length) return 0;
    let totalKg = 0;
    o.cargoItems.forEach((it) => {
      if (!it) return;
      const w = +(it.weightValue != null ? it.weightValue : it.weight);
      if (!(w > 0)) return;
      const unit = String(it.weightUnit || 'kg').trim();
      totalKg += unit === 'kg' ? w : w * 1000;
    });
    return totalKg;
  }

  function orderEffectivePayloadTons(o) {
    if (!o) return null;
    const tons = +o.reqPayloadTons;
    if (tons > 0) return tons;
    const kg = +o.cargoWeightKg;
    if (kg > 0) return kg / 1000;
    const fromItems = orderCargoItemsTotalKg(o);
    if (fromItems > 0) return fromItems / 1000;
    return null;
  }

  function orderVehicleWeightUnknown(o) {
    return !(orderEffectivePayloadTons(o) > 0);
  }

  function orderForVehicleFitCheck(o) {
    if (!o) return o;
    const eff = orderEffectivePayloadTons(o);
    if (!(eff > 0)) return o;
    if (+(o.reqPayloadTons) > 0) return o;
    return Object.assign({}, o, { reqPayloadTons: eff });
  }

  function vehicleFitsOrderCore(v, o, hooks) {
    hooks = hooks || {};
    if (!v || !o) return false;
    if (hooks.missingBlock && hooks.missingBlock(v).length) return false;
    if (hooks.bodyMatch && !hooks.bodyMatch(v, o)) return false;
    const fitO = orderForVehicleFitCheck(o);
    const pairs = [
      ['reqPayloadTons', 'payloadTons'],
      ['reqLengthM', 'bodyLengthM'],
      ['reqWidthM', 'bodyWidthM'],
      ['reqHeightM', 'bodyHeightM']
    ];
    for (let i = 0; i < pairs.length; i++) {
      const need = +fitO[pairs[i][0]];
      if (!(need > 0)) continue;
      const have = +v[pairs[i][1]];
      if (!(have > 0)) return false;
      if (have + 1e-9 < need) return false;
    }
    return true;
  }

  function sortFleetVehiclesByClosestPayload(vehicles) {
    return (vehicles || []).slice().sort((a, b) => {
      const pa = +(a.payloadTons) || 0;
      const pb = +(b.payloadTons) || 0;
      if (pa !== pb) {
        if (!(pa > 0)) return 1;
        if (!(pb > 0)) return -1;
        return pa - pb;
      }
      return String(a.plate || '').localeCompare(String(b.plate || ''), 'ru');
    });
  }

  function fleetVehiclesMatchingOrder(vehicles, order, hooks) {
    const fitO = orderForVehicleFitCheck(order);
    const ok = (vehicles || []).filter((v) => vehicleFitsOrderCore(v, fitO, hooks));
    return sortFleetVehiclesByClosestPayload(ok);
  }

  function parsePublicCargoWeightKg(raw) {
    const s = String(raw != null ? raw : '').trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return null;
    const n = parseFloat(s);
    if (!(n > 0) || Number.isNaN(n)) return null;
    return Math.round(n * 1000);
  }

  const api = {
    orderCargoItemsTotalKg,
    orderEffectivePayloadTons,
    orderVehicleWeightUnknown,
    orderForVehicleFitCheck,
    vehicleFitsOrderCore,
    sortFleetVehiclesByClosestPayload,
    fleetVehiclesMatchingOrder,
    parsePublicCargoWeightKg
  };
  g.armadaVehiclePodbor = api;
  if (typeof globalThis !== 'undefined') globalThis.armadaVehiclePodbor = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
