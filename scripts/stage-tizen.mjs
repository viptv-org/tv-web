import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageTizenApplication } from './tv-application.mjs';

const [dist, manifestFile, stage, apiOrigin] = process.argv.slice(2);
if (!dist || !manifestFile || !stage || !apiOrigin) throw Error('Use stage-tizen.mjs DIST MANIFEST OUTPUT HTTPS_API_ORIGIN');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(manifestFile), 'utf8'));
const report = await stageTizenApplication({ root, dist: resolve(dist), manifest, stage: resolve(stage), version, apiOrigin });
console.log(`Staged unsigned local Tizen application: ${report.files.length} files. Signing and native transport qualification remain separate.`);
