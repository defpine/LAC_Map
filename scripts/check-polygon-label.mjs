import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/domain/polygonLabelPoint.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { polygonLabelPoint } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function inside([x, y], rings) {
  let result = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < xi + (y - yi) * (xj - xi) / (yj - yi)) result = !result;
  }
  return result;
}
const concave = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,0.2],[0.2,0.2],[0.2,1],[0,1],[0,0]]] };
const hole = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]],[[0.25,0.25],[0.75,0.25],[0.75,0.75],[0.25,0.75],[0.25,0.25]]] };
const geography = JSON.parse(await readFile('FiveM_LAC/Data/geography.json', 'utf8'));
const gordo = geography.terrain.find(area => area.name === '고르도 산');
assert.ok(gordo, '고르도 산 영역이 필요합니다');
const buildings = JSON.parse(await readFile('FiveM_LAC/Data/buildings.json', 'utf8'));
const geometries = [concave, hole, ...geography.terrain.map(area => area.geometry), ...geography.zones.map(area => area.geometry), ...buildings.buildings.map(area => area.geometry)];
for (const geometry of geometries) assert.ok(inside(polygonLabelPoint(geometry), geometry.coordinates), 'label position must be inside polygon');
console.log(`Verified interior label positions for ${geometries.length - 2} project areas, including 고르도 산, plus concave and holed examples.`);

