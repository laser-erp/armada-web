import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(path.join(root, 'vehicle-podbor.js'), 'utf8');
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const pod = sandbox.armadaVehiclePodbor;

const hooks = { missingBlock: () => [], bodyMatch: () => true };

function v(tons) {
  return { plate: `T${tons}`, payloadTons: tons, bodyLengthM: 6, bodyWidthM: 2.4, bodyHeightM: 2.2, bodyTypeId: 'board' };
}

// vehicleFitsOrder tonnage edges
assert.equal(pod.vehicleFitsOrderCore(v(10), { reqPayloadTons: 10 }, hooks), true);
assert.equal(pod.vehicleFitsOrderCore(v(9.999), { reqPayloadTons: 10 }, hooks), false);
assert.equal(pod.vehicleFitsOrderCore(v(20), { reqPayloadTons: 20.001 }, hooks), false);

// sort: 5/10/20 t cargo 8 t → first 10 t
const sorted = pod.fleetVehiclesMatchingOrder([v(20), v(5), v(10)], { reqPayloadTons: 8 }, hooks);
assert.equal(sorted[0].payloadTons, 10);

// 1,5 t → 1500 kg
assert.equal(pod.parsePublicCargoWeightKg('1,5'), 1500);
assert.equal(pod.parsePublicCargoWeightKg('1.5'), 1500);

// empty weight — no tonnage filter
const allThree = pod.fleetVehiclesMatchingOrder([v(5), v(20)], {}, hooks);
assert.equal(allThree.length, 2);
assert.equal(pod.orderVehicleWeightUnknown({}), true);
assert.equal(pod.orderVehicleWeightUnknown({ cargoWeightKg: 500 }), false);
assert.equal(pod.orderEffectivePayloadTons({ cargoWeightKg: 1500 }), 1.5);

console.log('vehicle-podbor.test.mjs: ok');
