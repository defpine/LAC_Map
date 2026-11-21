import { rename, mkdir, copyFile } from 'node:fs/promises';
await rename('dist-viewer/viewer.html', 'dist-viewer/index.html');
for (const audience of ['law_enforcement', 'medical_institution']) {
  await mkdir(`dist-viewer/${audience}`, { recursive: true });
  await copyFile('dist-viewer/index.html', `dist-viewer/${audience}/index.html`);
}

