import { cp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('FiveM_LAC');
const target = path.resolve('public-viewer');
if (target !== path.join(process.cwd(), 'public-viewer')) throw new Error('Unsafe staging path');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
const names = ['project', 'geography', 'buildings', 'institutions', 'shops', 'npcs', 'facilities', 'images'];
await mkdir(path.join(target, 'Data'), { recursive: true });
for (const name of names) {
  const source = path.join(root, 'Data', `${name}.json`);
  JSON.parse(await readFile(source, 'utf8'));
  await cp(source, path.join(target, 'Data', `${name}.json`));
}
// Publish only assets referenced by the public project; never Backup or settings.
const project = JSON.parse(await readFile(path.join(root, 'Data/project.json'), 'utf8'));
const image = project.mapImages.find(x => x.id === project.currentMapImageRef);
if (!image) throw new Error('Current map image is missing');
for (const name of [image.filePath, image.previewFilePath, image.tileDirectory].filter(Boolean)) {
  const relative = name.replaceAll('\\', '/');
  if (!relative.startsWith('Assets/') || relative.split('/').includes('..')) throw new Error('Invalid asset path');
  await access(path.join(root, relative));
  await mkdir(path.dirname(path.join(target, relative)), { recursive: true });
  await cp(path.join(root, relative), path.join(target, relative), { recursive: true });
}
await cp('public/assets/fonts', path.join(target, 'assets/fonts'), { recursive: true });
await mkdir(path.join(target, 'Assets/images/icons'), { recursive: true });
const icons = JSON.parse(await readFile(path.join(root, 'Data/images.json'), 'utf8'));
for (const icon of icons.images) {
  if (!/^Assets\/images\/(icons|banners)\/image_\d{6}\.(png|jpg|webp)$/.test(icon.filePath)) throw new Error('Invalid image path');
  await mkdir(path.dirname(path.join(target, icon.filePath)), { recursive: true });
  await cp(path.join(root, icon.filePath), path.join(target, icon.filePath));
}
await writeFile(path.join(target, '.nojekyll'), '');
console.log('Viewer JSON, map, tiles and fonts prepared.');
