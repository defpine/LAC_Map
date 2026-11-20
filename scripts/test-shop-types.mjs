import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('src/domain/schemas.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('from "zod"', `from ${JSON.stringify(import.meta.resolve('zod'))}`);
const schemas = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const types = ['tattoo_shop', 'supermarket', 'pawn_shop', 'pet_shop', 'furniture_store', 'ifruit_store', 'hair_salon'];
for (const type of types) {
  assert.equal(schemas.shopsFileSchema.parse({ shops: [{ id: 'shop_000001', type }] }).shops[0].type, type);
  const marker = { id: 'marker_000001', type: 'shop', shopType: type, geometry: { type: 'Point', coordinates: [0.5, 0.5] } };
  assert.equal(schemas.markersFileSchema.parse({ markers: [marker] }).markers[0].shopType, type);
}
console.log('New shop types accepted for shops and markers.');

