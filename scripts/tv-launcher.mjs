import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function tvHostedUrl(target, value = `https://viptv.syek.tech/tv/?platform=${target}`) {
  if (!['webos', 'tizen'].includes(target)) throw Error('Use webos or tizen');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !/^\/tv\/?$/.test(url.pathname) || url.searchParams.get('platform') !== target)
    throw Error('Hosted URL must be credential-free HTTPS /tv/?platform=' + target);
  return url;
}

export async function stageTvLauncher({ root, stage, target, version, hostedUrl }) {
  const url = tvHostedUrl(target, hostedUrl);
  await mkdir(stage, { recursive: true });
  await cp(join(root, 'public/assets/viptv-mark.png'), join(stage, 'icon.png'));
  const literal = JSON.stringify(url.href).replaceAll('<', '\\u003c');
  await writeFile(join(stage, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>VIPTV</title></head><body style="background:#0b0b0c;color:#f4f2ee">Opening VIPTV…<script>location.replace(${literal})</script></body></html>`);
  if (target === 'webos') {
    await writeFile(join(stage, 'appinfo.json'), JSON.stringify({ id: 'tech.syek.viptv', version, vendor: 'VIPTV', type: 'web', main: 'index.html', title: 'VIPTV', icon: 'icon.png', resolution: '1920x1080', disableBackHistoryAPI: true }, null, 2));
  } else {
    let config = await readFile(join(root, 'platform/tizen/config.xml'), 'utf8');
    config = config.replace('launcher.html', 'index.html').replace('assets/viptv-mark.png', 'icon.png').replace(/version="0\.1\.0"/, `version="${version}"`);
    const origin = url.origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    config = config.replace('</widget>', `  <access origin="${origin}" subdomains="false" />\n</widget>`);
    await writeFile(join(stage, 'config.xml'), config);
  }
}
