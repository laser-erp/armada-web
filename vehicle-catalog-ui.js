/* Справочник моделей PB catalogs → карточка ТС и форма «+ машина» */
(function (g) {
  const cache = {};

  const CATALOG_GROUP_BODY = {
    board: 'board',
    tent: 'tent',
    furgon: 'van',
    van: 'van',
    ref: 'reefer',
    reefer: 'reefer',
    iso: 'iso',
    gazelle: 'gazelle',
    medium: 'medium',
    heavy: 'heavy',
    manipulator: 'manipulator',
    avtokran: 'avtokran',
    tral: 'tral',
    kmu: 'manipulator',
    crane: 'avtokran',
  };

  function vehicleCatalogType(v) {
    const cls = String(v && v.vehicleClass || '').trim();
    if (cls === 'avtokran') return 'avtokranModels';
    if (cls === 'manipulator') return 'manipulatorModels';
    if (cls === 'tral') return 'tralModels';
    const body = String((v && v.bodyTypeId) || '').trim();
    if (body === 'avtokran') return 'avtokranModels';
    if (body === 'manipulator') return 'manipulatorModels';
    if (body === 'tral') return 'tralModels';
    return 'truckModels';
  }

  function catalogTypeForBodyTypeId(bodyTypeId) {
    const b = String(bodyTypeId || '').trim();
    if (b === 'avtokran') return 'avtokranModels';
    if (b === 'manipulator') return 'manipulatorModels';
    if (b === 'tral') return 'tralModels';
    return 'truckModels';
  }

  async function loadCatalogRows(type) {
    if (!type) return [];
    if (cache[type]) return cache[type];
    if (typeof ensureArmadaApiToken === 'function') {
      try {
        await ensureArmadaApiToken({ pin: 'sync', meta: { role: 'sync' } });
      } catch (_) {}
    }
    if (typeof fetchArmadaApi !== 'function' || typeof armadaApiJsonHeaders !== 'function') return [];
    const res = await fetchArmadaApi(
      '/catalogs?type=' + encodeURIComponent(type),
      { headers: armadaApiJsonHeaders() },
      60000
    );
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];
    cache[type] = rows;
    return rows;
  }

  function catalogLabel(rec) {
    const d = rec.data || {};
    return rec.name || [d.make, d.model].filter(Boolean).join(' ').trim() || rec.code;
  }

  function buildBenchmarkFromRecord(rec) {
    if (!rec) return null;
    const d = rec.data || {};
    const b = { code: rec.code, type: rec.type };
    if (rec.type === 'truckModels') {
      b.payloadTons = d.gvwTons;
      b.axles = d.axles;
      b.enginePower = d.power;
      b.bodyTypeId = CATALOG_GROUP_BODY[rec.group] || CATALOG_GROUP_BODY[d.type] || null;
    } else {
      b.bodyLengthM = d.lengthM;
      b.bodyWidthM = d.widthM;
      b.bodyHeightM = d.heightM;
      b.payloadTons = d.payloadTons != null ? d.payloadTons : d.gvwTons;
      b.bodyTypeId = CATALOG_GROUP_BODY[rec.group] || null;
      if (rec.type === 'avtokranModels' || rec.type === 'manipulatorModels') {
        b.crane = {
          maxLiftTons: d.maxLiftTons,
          maxReachM: d.maxReachM,
          liftCurve: d.liftCurve,
          hasOutriggers: d.hasOutriggers,
          outriggerConfigs: d.outriggerConfigs,
        };
        b.bodyTypeId = rec.type === 'avtokranModels' ? 'avtokran' : 'manipulator';
      }
    }
    return b;
  }

  function applyCatalogRecord(v, rec, manual) {
    if (!v || !rec) return v;
    const d = rec.data || {};
    const make = d.make || '';
    const model = d.model || '';
    v.modelId = rec.code;
    v.catalogType = rec.type;
    const bench = buildBenchmarkFromRecord(rec);
    v.catalogBenchmark = bench;
    if (!manual) {
      v.makeModel = [make, model].filter(Boolean).join(' ').trim() || v.makeModel;
      const bodyFromGroup = CATALOG_GROUP_BODY[rec.group] || CATALOG_GROUP_BODY[d.type];
      if (bodyFromGroup) v.bodyTypeId = bodyFromGroup;
      if (rec.type === 'truckModels') {
        if (d.gvwTons != null) v.payloadTons = d.gvwTons;
        if (d.axles != null) v.axles = d.axles;
        if (d.power != null) v.enginePower = d.power;
      } else {
        if (d.lengthM != null) v.bodyLengthM = d.lengthM;
        if (d.widthM != null) v.bodyWidthM = d.widthM;
        if (d.heightM != null) v.bodyHeightM = d.heightM;
        if (d.payloadTons != null && !(+v.payloadTons > 0)) v.payloadTons = d.payloadTons;
      }
      if (rec.type === 'avtokranModels' || rec.type === 'manipulatorModels') {
        v.crane = Object.assign({}, v.crane || {}, {
          modelId: rec.code,
          model: [make, model].filter(Boolean).join(' ').trim(),
          maxLiftTons: d.maxLiftTons,
          maxReachM: d.maxReachM,
          liftCurve: d.liftCurve,
          hasOutriggers: d.hasOutriggers != null ? d.hasOutriggers : !!(v.crane && v.crane.hasOutriggers),
          outriggerConfigs: d.outriggerConfigs,
          correctedByOwner: false,
        });
        if (d.outriggerConfigs && d.outriggerConfigs[0]) {
          const og = d.outriggerConfigs[0];
          v.crane.outriggerSpan = { lengthM: og.lengthM, widthM: og.widthM };
        }
        v.bodyTypeId = rec.type === 'avtokranModels' ? 'avtokran' : 'manipulator';
      }
      v.catalogCorrectedByOwner = false;
      if (v.crane) v.crane.correctedByOwner = false;
    }
    return v;
  }

  function applyBenchmarkToVehicle(v, bench, manual) {
    if (!v || !bench || manual) return v;
    if (bench.payloadTons != null) v.payloadTons = bench.payloadTons;
    if (bench.bodyLengthM != null) v.bodyLengthM = bench.bodyLengthM;
    if (bench.bodyWidthM != null) v.bodyWidthM = bench.bodyWidthM;
    if (bench.bodyHeightM != null) v.bodyHeightM = bench.bodyHeightM;
    if (bench.bodyTypeId) v.bodyTypeId = bench.bodyTypeId;
    if (bench.axles != null) v.axles = bench.axles;
    if (bench.enginePower != null) v.enginePower = bench.enginePower;
    if (bench.crane) {
      v.crane = Object.assign({}, v.crane || {}, bench.crane, { correctedByOwner: false });
    }
    return v;
  }

  function catalogSelectHtml(rows, selectedCode) {
    const opts = ['<option value="">— из справочника —</option>'].concat(
      rows.map((r) => {
        const label = catalogLabel(r);
        const sel = r.code === selectedCode ? ' selected' : '';
        return (
          '<option value="' +
          (typeof esc === 'function' ? esc(r.code) : r.code) +
          '"' +
          sel +
          '>' +
          (typeof esc === 'function' ? esc(label) : label) +
          '</option>'
        );
      })
    );
    return opts.join('');
  }

  function isStagingHost() {
    try {
      return (location.hostname || '').toLowerCase() === 'staging.app.armada.sx';
    } catch (_) {
      return false;
    }
  }

  async function postCustomCatalogRow(type, make, model, data) {
    if (typeof fetchArmadaApi !== 'function' || typeof armadaApiJsonHeaders !== 'function') return null;
    const res = await fetchArmadaApi(
      '/catalogs',
      {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, armadaApiJsonHeaders()),
        body: JSON.stringify({ type, make, model, data }),
      },
      30000
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    delete cache[type];
    return json.data || json.record || null;
  }

  function setAddFieldLocked(root, locked, hint) {
    const ids = ['own-veh-body', 'own-veh-pay', 'own-veh-l', 'own-veh-w', 'own-veh-h'];
    ids.forEach((id) => {
      const el = root.querySelector('#' + id);
      if (!el) return;
      el.disabled = !!locked;
      el.classList.toggle('veh-add-locked', !!locked);
      if (locked && hint) el.placeholder = hint;
    });
    const st = root.querySelector('#own-veh-model-hint');
    if (st && locked && hint) st.textContent = hint;
  }

  function toggleCatalogRefMarks(root, on) {
    root.querySelectorAll('.catalog-ref-mark').forEach((el) => {
      el.style.display = on ? '' : 'none';
    });
  }

  function fillAddFormFromVehicle(root, v) {
    const set = (id, val) => {
      const el = root.querySelector('#' + id);
      if (el && val != null && val !== '') el.value = val;
    };
    set('own-veh-pay', v.payloadTons);
    set('own-veh-l', v.bodyLengthM);
    set('own-veh-w', v.bodyWidthM);
    set('own-veh-h', v.bodyHeightM);
    const body = root.querySelector('#own-veh-body');
    if (body && v.bodyTypeId) body.value = v.bodyTypeId;
  }

  async function wireOwnVehicleAddForm(root) {
    if (!root) return;
    const search = root.querySelector('#own-veh-model-search');
    const datalist = root.querySelector('#own-veh-model-list');
    const codeInp = root.querySelector('#own-veh-model-code');
    const manualBtn = root.querySelector('#own-veh-manual-toggle');
    const resetBtn = root.querySelector('#own-veh-catalog-reset');
    const customBtn = root.querySelector('#own-veh-custom-model');
    const bodySel = root.querySelector('#own-veh-body');
    if (!search || !datalist) return;

    const draft = { record: null, manual: false, customMode: false, rows: [], typ: 'truckModels' };

    async function reloadRows() {
      const bodyId = bodySel ? bodySel.value : '';
      draft.typ = catalogTypeForBodyTypeId(bodyId);
      draft.rows = await loadCatalogRows(draft.typ);
      datalist.innerHTML = draft.rows
        .map((r) => {
          const label = catalogLabel(r);
          return (
            '<option value="' +
            (typeof esc === 'function' ? esc(label) : label) +
            '" data-code="' +
            (typeof esc === 'function' ? esc(r.code) : r.code) +
            '"></option>'
          );
        })
        .join('');
    }

    function pickRecordBySearchText(text) {
      const t = String(text || '').trim().toLowerCase();
      if (!t) return null;
      return (
        draft.rows.find((r) => catalogLabel(r).toLowerCase() === t) ||
        draft.rows.find((r) => catalogLabel(r).toLowerCase().includes(t))
      );
    }

    function onModelPicked(rec) {
      draft.record = rec;
      if (codeInp) codeInp.value = rec ? rec.code : '';
      if (!rec) {
        setAddFieldLocked(root, true, 'Выберите модель');
        toggleCatalogRefMarks(root, false);
        if (resetBtn) resetBtn.hidden = true;
        return;
      }
      const v = applyCatalogRecord({ plate: '' }, rec, draft.manual);
      fillAddFormFromVehicle(root, v);
      setAddFieldLocked(root, !draft.manual, draft.manual ? '' : 'Эталон из справочника');
      toggleCatalogRefMarks(root, !draft.manual);
      if (resetBtn) resetBtn.hidden = !draft.manual;
      const hint = root.querySelector('#own-veh-model-hint');
      if (hint) hint.textContent = catalogLabel(rec);
    }

    await reloadRows();
    setAddFieldLocked(root, true, 'Выберите модель');

    if (bodySel) {
      bodySel.addEventListener('change', () => {
        reloadRows().then(() => {
          if (draft.record) {
            const still = draft.rows.find((r) => r.code === draft.record.code);
            if (!still) {
              draft.record = null;
              search.value = '';
              onModelPicked(null);
            }
          }
        });
      });
    }

    search.addEventListener('change', () => {
      const rec = pickRecordBySearchText(search.value);
      onModelPicked(rec);
    });
    search.addEventListener('blur', () => {
      const rec = pickRecordBySearchText(search.value);
      if (rec) onModelPicked(rec);
    });

    if (manualBtn) {
      manualBtn.onclick = () => {
        draft.manual = !draft.manual;
        manualBtn.classList.toggle('on', draft.manual);
        if (draft.record) {
          setAddFieldLocked(root, !draft.manual, draft.manual ? '' : 'Эталон из справочника');
          toggleCatalogRefMarks(root, !draft.manual);
          if (resetBtn) resetBtn.hidden = !draft.manual;
        } else if (draft.manual) {
          draft.customMode = true;
          setAddFieldLocked(root, false, '');
          toggleCatalogRefMarks(root, false);
        } else {
          setAddFieldLocked(root, true, 'Выберите модель');
        }
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        if (!draft.record) return;
        draft.manual = false;
        if (manualBtn) manualBtn.classList.remove('on');
        onModelPicked(draft.record);
      };
    }

    if (customBtn) {
      customBtn.style.display = isStagingHost() ? '' : 'none';
      customBtn.onclick = async () => {
        const make = prompt('Марка (например Scania)');
        if (!make) return;
        const model = prompt('Модель');
        if (!model) return;
        const typ = draft.typ;
        const data = { make: make.trim(), model: model.trim() };
        const rec = await postCustomCatalogRow(typ, data.make, data.model, data);
        if (!rec) {
          alert('Не удалось добавить в справочник (только staging API)');
          draft.customMode = true;
          setAddFieldLocked(root, false, '');
          search.value = make.trim() + ' ' + model.trim();
          return;
        }
        await reloadRows();
        draft.customMode = false;
        search.value = catalogLabel(rec);
        onModelPicked(rec);
      };
    }

    root._ownVehCatalogDraft = () => ({
      record: draft.record,
      manual: draft.manual,
      customMode: draft.customMode,
      buildVehicle(base) {
        let v = Object.assign({}, base);
        if (draft.record) {
          v = applyCatalogRecord(v, draft.record, draft.manual);
          v.catalogCorrectedByOwner = !!draft.manual;
        } else if (draft.customMode) {
          v.makeModel = (search.value || '').trim();
          v.catalogCorrectedByOwner = true;
        }
        return v;
      },
    });
  }

  async function wireVehicleCatalogPicker(v, root) {
    if (!root || !v) return;
    const sel = root.querySelector('#vc-catalog-model');
    const manual = root.querySelector('#vc-catalog-manual');
    const resetBtn = root.querySelector('#vc-catalog-reset');
    if (!sel) return;
    const typ = vehicleCatalogType(v);
    const rows = await loadCatalogRows(typ);
    sel.innerHTML = catalogSelectHtml(rows, v.modelId || (v.crane && v.crane.modelId));
    sel.onchange = () => {
      const code = sel.value;
      if (!code) return;
      const rec = rows.find((r) => r.code === code);
      const manualMode = manual && manual.checked;
      applyCatalogRecord(v, rec, manualMode);
      if (typeof openVehicleCard === 'function') {
        openVehicleCard(v.id);
      }
    };
    if (manual) {
      manual.checked = !!v.catalogCorrectedByOwner;
      manual.onchange = () => {
        v.catalogCorrectedByOwner = manual.checked;
        if (v.crane) v.crane.correctedByOwner = manual.checked;
      };
    }
    if (resetBtn) {
      resetBtn.onclick = () => {
        const code = sel.value || v.modelId;
        const rec = rows.find((r) => r.code === code);
        if (!rec) return;
        applyCatalogRecord(v, rec, false);
        if (typeof bumpDataEpoch === 'function') bumpDataEpoch('veh-catalog-reset');
        if (typeof persist === 'function') persist();
        if (typeof openVehicleCard === 'function') openVehicleCard(v.id);
      };
    }
  }

  g.armadaVehicleCatalog = {
    vehicleCatalogType,
    catalogTypeForBodyTypeId,
    loadCatalogRows,
    applyCatalogRecord,
    applyBenchmarkToVehicle,
    wireVehicleCatalogPicker,
    wireOwnVehicleAddForm,
    buildBenchmarkFromRecord,
  };
})(typeof window !== 'undefined' ? window : globalThis);
