import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/domain/viewerVisibility.ts'], bundle: true, format: 'esm', write: false, platform: 'node' });
const { viewerAudience, visibleInViewer } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
assert.equal(viewerAudience('/LAC_Map/', '/LAC_Map/'), 'law_enforcement');
assert.equal(viewerAudience('/LAC_Map/law_enforcement/', '/LAC_Map/'), 'law_enforcement');
assert.equal(viewerAudience('/LAC_Map/medical_institution/', '/LAC_Map/'), 'medical_institution');
for (const role of ['law_enforcement', 'medical_institution']) assert.equal(visibleInViewer({}, role), false);
const item = { viewerVisibility: { law_enforcement: true, medical_institution: false } };
assert.equal(visibleInViewer(item, 'law_enforcement'), true);
assert.equal(visibleInViewer(item, 'medical_institution'), false);
console.log('Viewer visibility checks passed.');

