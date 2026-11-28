import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/editor/projectSaver.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { saveProjectData } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function fixture(failName) {
  const names = ['geography', 'buildings', 'markers', 'institutions', 'shops', 'npcs', 'facilities', 'images'];
  const files = new Map(names.map(name => [`${name}.json`, `original:${name}`]));
  const icons = new Map();
  const banners = new Map();
  let failed = false;
  const dir = (storage) => ({
    async getFileHandle(name, options) {
      if (!storage.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
      if (!storage.has(name)) storage.set(name, '');
      return {
        async getFile() { return new Blob([storage.get(name)]); },
        async createWritable() { return {
          async write(value) { if (name === failName && !failed) { failed = true; throw new Error('simulated failure'); } storage.set(name, value); },
          async close() {},
        }; },
      };
    },
    async removeEntry(name) { storage.delete(name); },
  });
  const root = { async getDirectoryHandle(name) { if (name === 'Data') return dir(files); return { async getDirectoryHandle() { return { async getDirectoryHandle(kind) { return dir(kind === 'icons' ? icons : banners); } }; } }; } };
  const project = { terrain: [], zones: [], roads: [], buildings: [], markers: [], institutions: [], shops: [], npcs: [], facilities: [], icons: [{ id: 'image_000001', originalFileName: 'icon.png', filePath: 'Assets/images/icons/image_000001.png', format: 'png', fileSize: 4, sha256: 'a'.repeat(64), pendingFile: new Blob(['test']) }] };
  return { root, files, icons, banners, project };
}

const success = fixture();
await saveProjectData(success.root, success.project);
assert.equal(success.icons.size, 1);
assert.equal(JSON.parse(success.files.get('images.json')).images[0].id, 'image_000001');
const failure = fixture('markers.json');
failure.project.icons.push({ id: 'image_000002', originalFileName: 'banner.png', filePath: 'Assets/images/banners/image_000002.png', format: 'png', fileSize: 6, sha256: 'b'.repeat(64), pendingFile: new Blob(['banner']) });
await assert.rejects(saveProjectData(failure.root, failure.project));
assert.equal(failure.icons.size, 0);
assert.equal(failure.banners.size, 0);
for (const [name, value] of failure.files) assert.equal(value, `original:${name.replace('.json', '')}`);
console.log('Icon save and rollback checks passed.');
