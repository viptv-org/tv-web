import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { verifyTvPackage } from './tv-package-check.mjs';

export function tvApiOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('A packaged TV application requires an HTTPS API origin.');
  return url.origin;
}

export async function stageTizenApplication({ root, dist, manifest, stage, version, apiOrigin }) {
  apiOrigin = tvApiOrigin(apiOrigin);
  if (manifest.base !== './') throw Error('Packaged TV assets require a relative-base build (--base=./).');
  await mkdir(stage, { recursive: true });
  if ((await readdir(stage)).length) throw Error('Choose an empty Tizen staging directory.');
  for (const file of manifest.files) {
    const destination = join(stage, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(dist, file), destination);
  }
  const configuration = JSON.stringify({ platform: 'tizen', apiOrigin }).replaceAll('<', '\\u003c');
  for (const file of manifest.files.filter(file => file.endsWith('.html'))) {
    const path = join(stage, file);
    const html = await readFile(path, 'utf8');
    await writeFile(path, html.replace('<head>', `<head><script id="viptv-packaged-host" type="application/json">${configuration}</script>`));
  }
  await cp(join(root, 'public/assets/viptv-mark.png'), join(stage, 'icon.png'));
  let config = await readFile(join(root, 'platform/tizen/config.xml'), 'utf8');
  config = config.replace('launcher.html', 'index.html').replace('assets/viptv-mark.png', 'icon.png').replace(/version="0\.1\.0"/, `version="${version}"`);
  config = config.replace('</widget>', `  <access origin="*" subdomains="true" />\n  <tizen:content-security-policy>default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src https: file:; media-src https: blob:; worker-src 'self' blob:; object-src 'self'</tizen:content-security-policy>\n</widget>`);
  await writeFile(join(stage, 'config.xml'), config);
  const report = await verifyTvPackage(stage, manifest);
  if (report.problems.length) throw Error(`Packaged TV assets are incomplete:\n${report.problems.join('\n')}`);
  return report;
}
