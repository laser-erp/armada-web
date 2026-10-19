/**
 * TDZ: fillRatesFrom не должен вызываться до const CASH_DISCOUNT / VAT_MARKUP в app.js.
 * Запуск: node --test web-preview/test/fillRatesFrom-no-tdz.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const APP_JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js');

function firstFillRatesFromCallIndex(src) {
  let from = 0;
  while (from < src.length) {
    const idx = src.indexOf('fillRatesFrom(', from);
    if (idx < 0) return -1;
    const lineStart = src.lastIndexOf('\n', idx) + 1;
    const lineEnd = src.indexOf('\n', idx);
    const line = src.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
    if (!line.includes('function fillRatesFrom')) return idx;
    from = idx + 1;
  }
  return -1;
}

describe('fillRatesFrom без TDZ', () => {
  it('константы и fillRatesFrom в app.js выше первого вызова', () => {
    const src = readFileSync(APP_JS, 'utf8');
    const vatIdx = src.indexOf('const VAT_MARKUP');
    const cashIdx = src.indexOf('const CASH_DISCOUNT');
    const fnIdx = src.indexOf('function fillRatesFrom');
    const callIdx = firstFillRatesFromCallIndex(src);
    assert.ok(vatIdx >= 0 && cashIdx >= 0 && fnIdx >= 0, 'объявления найдены');
    assert.ok(callIdx >= 0, 'вызов fillRatesFrom найден');
    assert.ok(vatIdx < callIdx && cashIdx < callIdx && fnIdx < callIdx);
  });

  it('fillRatesFrom и customerCarrierPriceAmount работают в sandbox', () => {
    const sb = loadTariffSandbox();
    const t = sb.fillRatesFrom('cash', 10000);
    assert.equal(t.cash, 10000);
    assert.ok(t.withVat > t.withoutVat);
    const carrier = { vatPayer: 'vat' };
    const quote = { minimumCash: 10800, logistFeePercent: 0 };
    const amt = sb.customerCarrierPriceAmount(quote, carrier);
    assert.ok(amt > 0);
  });
});
