import { rename } from 'node:fs/promises';
await rename('dist-viewer/viewer.html', 'dist-viewer/index.html');
