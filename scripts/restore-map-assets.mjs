import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Large map sources may be committed as ordered binary parts.
const directory = path.resolve('FiveM_LAC/Assets/images/maps');
const names = await readdir(directory);
for (const first of names.filter(name => name.endsWith('.part-000'))) {
  const name = first.slice(0, -9);
  const parts = names.filter(item => item.startsWith(`${name}.part-`)).sort();
  parts.forEach((part, index) => {
    if (part !== `${name}.part-${String(index).padStart(3, '0')}`) throw new Error(`Missing map part: ${name}`);
  });
  const bytes = Buffer.concat(await Promise.all(parts.map(part => readFile(path.join(directory, part)))));
  const expected = JSON.parse(await readFile(path.join(directory, `${name}.sha256`), 'utf8'));
  if (bytes.length !== expected.size || createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw new Error(`Map integrity check failed: ${name}`);
  let exists = true;
  try { await access(path.join(directory, name)); } catch { exists = false; }
  if (!exists) await writeFile(path.join(directory, name), bytes);
  console.log(`Map source verified: ${name}`);
}
