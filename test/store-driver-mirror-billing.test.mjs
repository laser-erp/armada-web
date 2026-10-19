/**
 * Зеркало админа-водителя и ensureDriverInCompany — лимит тарифа add_driver.
 * Запуск: node --test web-preview/test/store-driver-mirror-billing.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadTariffSandbox } from '../../scripts/qa-tariff-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadStoreBillingSandbox() {
  const sb = loadTariffSandbox();
  vm.runInNewContext(readFileSync(path.join(ROOT, 'billing.js'), 'utf8'), sb, { filename: 'billing.js' });
  return sb;
}

function seedMirrorSpace(sb) {
  const sp = 'sp-driver-limit-qa';
  const coId = 'co-own-limit';
  sb.state.spaces = [{ id: sp, name: 'Limit QA', ownCompanyId: coId, createdAt: new Date().toISOString() }];
  sb.state.companies = [{ id: coId, name: 'ИП Лимит', roles: ['own'], spaceId: sp }];
  sb.state.drivers = [];
  sb.state.billing = {
    spaces: {
      [sp]: {
        planId: 'start',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    },
  };
  return { sp, coId };
}

function pushDrivers(sb, sp, coId, n) {
  for (let i = 0; i < n; i++) {
    sb.state.drivers.push({
      id: `drv-fill-${i}`,
      name: `Водитель ${i}`,
      spaceId: sp,
      companyId: coId,
    });
  }
}

describe('store — лимит водителей при зеркале админа', () => {
  it('ensureDriverInCompany не добавляет водителя при достигнутом лимите', () => {
    const sb = loadStoreBillingSandbox();
    const { sp, coId } = seedMirrorSpace(sb);
    pushDrivers(sb, sp, coId, 3);
    const added = sb.ensureDriverInCompany({
      name: 'ИП Владелец',
      companyId: coId,
      companyName: 'ИП Лимит',
      spaceId: sp,
    });
    assert.equal(added, false);
    assert.equal(sb.state.drivers.length, 3);
  });

  it('ensureAdminDriverMirror уважает лимит (ИП-владелец-водитель)', () => {
    const sb = loadStoreBillingSandbox();
    const { sp, coId } = seedMirrorSpace(sb);
    pushDrivers(sb, sp, coId, 3);
    const adm = {
      id: 'adm-owner-driver',
      name: 'ИП Владелец',
      spaceId: sp,
      phone: '+79001112233',
      pin: '1234',
    };
    const mirrored = sb.ensureAdminDriverMirror(adm);
    assert.equal(mirrored, false);
    assert.equal(sb.state.drivers.length, 3);
    assert.ok(!sb.state.drivers.some((d) => d.name === 'ИП Владелец'));
  });

  it('ensureDriverInCompany добавляет водителя, если лимит не исчерпан', () => {
    const sb = loadStoreBillingSandbox();
    const { sp, coId } = seedMirrorSpace(sb);
    pushDrivers(sb, sp, coId, 2);
    const added = sb.ensureDriverInCompany({
      name: 'ИП Владелец',
      companyId: coId,
      companyName: 'ИП Лимит',
      spaceId: sp,
    });
    assert.equal(added, true);
    assert.equal(sb.state.drivers.length, 3);
  });
});
