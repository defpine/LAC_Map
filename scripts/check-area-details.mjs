import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const schemas = await load('src/domain/schemas.ts');
const { buildingDetails } = await load('src/domain/buildingDetails.ts');
const { supportsBuildingUnits } = await load('src/domain/buildingUnits.ts');
const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const area = { id: 'area', name: '이름', description: '설명', bannerRef: 'image_000001', geometry };
const geography = schemas.geographyFileSchema.parse({ terrain: [{ ...area, type: 'mountain' }], zones: [{ ...area, type: 'safe_zone' }], roads: [] });
const building = schemas.buildingsFileSchema.parse({ buildings: [{ ...area, type: 'institution', entityRef: 'institution_1' }] }).buildings[0];
for (const feature of [geography.terrain[0], geography.zones[0], building]) {
  assert.equal(feature.bannerRef, area.bannerRef);
  assert.equal(feature.description, area.description);
}
const project = { institutions: [{ id: 'institution_1', type: 'institution' }], shops: [], npcs: [], facilities: [{ id: 'facility_1', type: 'terminal', location: { type: 'building', buildingRef: 'area' } }] };
assert.deepEqual(buildingDetails(project, building).map(detail => detail.id), ['institution_1', 'facility_1']);
const burglary = { ...area, type: 'burglary', units: [{ id: 'unit_1', houseNumber: '101', description: '번지별 설명\n두 번째 줄', geometry, entrances: [{ type: 'Point', coordinates: [0.4, 0.5] }] }] };
const roundTrip = schemas.buildingsFileSchema.parse(JSON.parse(JSON.stringify({ buildings: [burglary] }))).buildings[0];
assert.equal(supportsBuildingUnits(roundTrip), true);
assert.deepEqual(roundTrip.units, burglary.units);
assert.equal(supportsBuildingUnits(building), false);
console.log('Area photo, description and linked detail checks passed.');
