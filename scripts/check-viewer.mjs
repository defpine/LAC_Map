import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const schemaSource = await readFile('src/domain/schemas.ts', 'utf8');
const compiled = ts.transpileModule(schemaSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('from "zod"', `from ${JSON.stringify(import.meta.resolve('zod'))}`);
const schemas = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
for (const name of ['project','geography','buildings','institutions','shops','npcs','facilities']) {
  schemas[`${name}FileSchema`].parse(JSON.parse(await readFile(`dist-viewer/Data/${name}.json`, 'utf8')));
}
const iconData = schemas.iconsFileSchema.parse(JSON.parse(await readFile('dist-viewer/Data/images.json', 'utf8')));
for (const icon of iconData.images) await access(path.join('dist-viewer', icon.filePath));
const root = path.resolve('dist-viewer');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
assert(!html.includes('/src/'), 'Source entry leaked');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const relative = match[1].replace(/^.*?assets\//, 'assets/');
  await access(path.join(root, relative));
}
for (const file of await readdir(path.join(root, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(path.join(root, 'assets', file), 'utf8');
  for (const forbidden of ['showDirectoryPicker', 'Global Save', 'leaflet-geoman', 'chooseProjectFolder', 'saveProjectData']) assert(!text.includes(forbidden), `Editor code found: ${forbidden}`);
}
const project = JSON.parse(await readFile(path.join(root, 'Data/project.json'), 'utf8'));
const image = project.mapImages.find(x => x.id === project.currentMapImageRef);
for (const file of [image.filePath, image.previewFilePath].filter(Boolean)) await access(path.join(root, file));
let tiles = 0;
if (image.tileDirectory) for (let level = 0; level <= 5; level++) {
  const columns = Math.ceil(image.width / (512 * 2 ** level));
  const rows = Math.ceil(image.height / (512 * 2 ** level));
  for (let x = 0; x < columns; x++) for (let y = 0; y < rows; y++) {
    await access(path.join(root, image.tileDirectory, `level_${level}/${x}_${y}.png`)); tiles++;
  }
}
for (const name of ['geography','buildings','institutions','shops','npcs','facilities']) JSON.parse(await readFile(path.join(root, `Data/${name}.json`), 'utf8'));
assert(!(await readdir(root)).includes('Backup'));
console.log(`Viewer artifact checks passed; ${tiles} tiles, JSON and asset references verified; no Editor imports.`);
