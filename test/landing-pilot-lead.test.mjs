import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const storeSrc = readFileSync(path.join(root, 'store.js'), 'utf8');

function loadNormalize() {
  const sandbox = {
    console,
    uuid: () => 'test-id',
    formatPhone: (p) => String(p || '').trim(),
    structuredClone: (x) => JSON.parse(JSON.stringify(x)),
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  const chunk =
    storeSrc.match(/function normalizeCustomerPortalLead[\s\S]*?^}/m)?.[0] ||
    storeSrc.match(/function normalizeCustomerPortalLead[\s\S]*?^}\nfunction /m)?.[0];
  assert.ok(chunk, 'normalizeCustomerPortalLead');
  vm.runInNewContext(
    chunk +
      '\nfunction numOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null;}\nfunction normalizeArmadaSxVtype(){return "";}',
    sandbox
  );
  return sandbox.normalizeCustomerPortalLead;
}

const normalize = loadNormalize();
const rec = normalize({
  kind: 'pilot',
  pilotProject: true,
  company: 'ООО Тест',
  phone: '+79001234567',
  contactName: 'Иван',
  fleetSize: '5',
  workNeeds: 'ЭТрН',
  source: 'landing.html#pilot-project',
});

assert.equal(rec.kind, 'pilot');
assert.equal(rec.pilotProject, true);
assert.equal(rec.workNeeds, 'ЭТрН');
assert.equal(rec.fleetSize, '5');

console.log('landing-pilot-lead.test.mjs: ok');
