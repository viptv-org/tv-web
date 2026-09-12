import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '').replace('Z', 'Z');
const dist = join(root, 'dist');
const publicMark = join(root, 'public', 'assets', 'viptv-mark.png');
const tizenPlatform = join(root, 'platform', 'tizen');
const tizenOutput = join(root, 'artifacts', 'tizen-candidate', `viptv-tizen-${timestamp}`);
const vizioOutput = join(root, 'artifacts', 'vizio-hosting', `viptv-vizio-${timestamp}`);
const hostedTvUrl = process.env.VIPTV_TIZEN_HOSTED_URL ?? 'https://viptv.syek.tech/tv/?platform=tizen';

assertHostedTvUrl(hostedTvUrl);
await requireReadable(dist, 'Run `npm run build` before packaging the Vizio static bundle.');
await requireReadable(join(tizenPlatform, 'config.xml'), 'Tizen config.xml is missing.');
await requireReadable(join(tizenPlatform, 'launcher.html'), 'Tizen launcher.html is missing.');
await requireReadable(publicMark, 'The design-owned VIPTV mark is missing from public assets.');

await packageTizenLauncher();
await packageVizioBundle();

async function packageTizenLauncher() {
  const stage = join(tizenOutput, 'stage');
  const candidate = join(tizenOutput, 'viptv-tizen-launcher-unsigned.wgt');
  await mkdir(join(stage, 'assets'), { recursive: true });
  await cp(join(tizenPlatform, 'config.xml'), join(stage, 'config.xml'));
  const launcher = await readFile(join(tizenPlatform, 'launcher.html'), 'utf8');
  const safeUrlLiteral = JSON.stringify(hostedTvUrl).replaceAll('<', '\\u003c');
  await writeFile(join(stage, 'launcher.html'), launcher.replace('__VIPTV_TIZEN_HOSTED_URL_JSON__', safeUrlLiteral));
  await cp(publicMark, join(stage, 'assets', 'viptv-mark.png'));
  await writeFile(join(stage, 'UNSIGNED_CANDIDATE.txt'), [
    'This launcher WGT is unsigned and cannot be installed or distributed.',
    `It opens the hosted same-origin VIPTV app at ${hostedTvUrl}.`,
    'A Samsung certificate/profile plus physical-TV qualification is required for a signed release.',
    '',
  ].join('\n'));
  archive(stage, candidate);
  await writeManifest(tizenOutput, {
    kind: 'unsigned-tizen-launcher-wgt-candidate', artifact: candidate, hostedTvUrl, installable: false,
    requiredBeforeRelease: ['Samsung signing certificate/profile', 'physical-TV fixture qualification'],
  });
  await rm(stage, { recursive: true, force: true });
  console.log(`Created unsigned Tizen launcher candidate: ${candidate}`);
}

async function packageVizioBundle() {
  const stage = join(vizioOutput, 'stage');
  const archivePath = join(vizioOutput, 'viptv-vizio-static.zip');
  await cp(dist, stage, { recursive: true });
  await writeFile(join(stage, 'HOSTING.txt'), [
    'Deploy this static bundle at the same HTTPS origin as the VIPTV API, under /tv.',
    'Serve index.html for client routes. Do not add upstream media credentials in browser code.',
    'Playback URLs are short-lived same-origin backend capabilities.',
    '',
  ].join('\n'));
  archive(stage, archivePath);
  await writeManifest(vizioOutput, {
    kind: 'vizio-static-hosting-bundle', artifact: archivePath, deployPath: '/tv', installable: false,
    requiredBeforeRelease: ['HTTPS hosting smoke test', 'physical Vizio fixture qualification'],
  });
  await rm(stage, { recursive: true, force: true });
  console.log(`Created Vizio static hosting bundle: ${archivePath}`);
}

function archive(stage, destination) {
  const zip = spawnSync('zip', ['-q', '-r', destination, '.'], { cwd: stage, encoding: 'utf8' });
  if (zip.error || zip.status !== 0) throw new Error(`Could not create archive: ${zip.error?.message ?? zip.stderr ?? 'zip exited non-zero'}`);
}

async function writeManifest(output, values) {
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ createdAt: new Date().toISOString(), ...values }, null, 2)}\n`);
}

async function requireReadable(path, instruction) {
  try { await access(path); } catch { throw new Error(instruction); }
}

function assertHostedTvUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || (url.pathname !== '/tv' && !url.pathname.startsWith('/tv/'))) throw new Error('VIPTV_TIZEN_HOSTED_URL must be an HTTPS URL under /tv.');
  if (url.searchParams.get('platform') !== 'tizen') throw new Error('VIPTV_TIZEN_HOSTED_URL must include ?platform=tizen so the hosted app selects AVPlay.');
}
