/**
 * Песочница для сценария A (справочники и тарифы): store + app + fleet-rates + vehicle-podbor.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox, seedCompany } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadARefSandbox(companyId = 'qa-a-ref-co') {
  const sb = loadTariffSandbox();
  vm.runInNewContext(readFileSync(path.join(ROOT, 'vehicle-podbor.js'), 'utf8'), sb, {
    filename: 'vehicle-podbor.js',
  });
  seedCompany(sb, companyId);
  return sb;
}

export function domInput(value) {
  const el = {
    value: value == null ? '' : String(value),
    style: {},
    oninput: null,
    addEventListener() {},
  };
  return el;
}

/** Минимальный DOM для draftTariffFromDom / updatePerKmPreview */
export function wireDraftTariffDom(sb, fields) {
  const map = {
    'd-perkm': fields.ratePerKmCash,
    'd-perhour': fields.ratePerHourWork,
    'd-estimate-km': fields.estimateKm,
    'd-estimate-hours': fields.estimateWorkHours,
    'd-work-hours': fields.workHours,
    'd-empty-after': fields.emptyKmAfter,
    'd-overnight-rate': fields.overnightStorageRateCash,
    'd-overnight-nights': fields.overnightNights,
  };
  const preview = { innerHTML: '' };
  sb.document.getElementById = (id) => {
    if (id === 'perkm-preview') return preview;
    if (map[id] !== undefined) return domInput(map[id]);
    return domInput('');
  };
  sb.$ = (id) => sb.document.getElementById(id);
  return preview;
}

export { seedCompany };
