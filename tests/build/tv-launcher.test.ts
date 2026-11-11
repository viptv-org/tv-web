import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
// @ts-expect-error Node packaging utilities have no application declaration file.
import { stageTvLauncher, tvHostedUrl } from '../../scripts/tv-launcher.mjs';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

it.each(['webos', 'tizen'])('rejects unsafe or mismatched %s hosted entries', target => {
  for (const url of [
    `http://example.test/tv/?platform=${target}`,
    `https://user:password@example.test/tv/?platform=${target}`,
    `https://example.test/other/?platform=${target}`,
    'https://example.test/tv/?platform=web',
    `https://example.test/tv/?platform=${target}#fragment`,
  ]) expect(() => tvHostedUrl(target, url)).toThrow();
});

it.each(['webos', 'tizen'])('stages a %s launcher without allowing hosted URL script injection', async target => {
  const stage = await mkdtemp(join(tmpdir(), 'viptv-launcher-test-'));
  directories.push(stage);
  await stageTvLauncher({ root: resolve('.'), stage, target, version: '0.2.3', hostedUrl: `https://example.test/tv/?platform=${target}&value=</script><script>alert(1)</script>` });
  const html = await readFile(join(stage, 'index.html'), 'utf8');
  expect(html.match(/<script>/g)).toHaveLength(1);
  expect(html).not.toContain('alert(1)</script>');
  expect((await readFile(join(stage, 'icon.png'))).length).toBeGreaterThan(0);
  if (target === 'webos') {
    const info = JSON.parse(await readFile(join(stage, 'appinfo.json'), 'utf8'));
    expect(info).toMatchObject({ main: 'index.html', icon: 'icon.png', version: '0.2.3', disableBackHistoryAPI: true });
  } else {
    const xml = new DOMParser().parseFromString(await readFile(join(stage, 'config.xml'), 'utf8'), 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.querySelector('content')?.getAttribute('src')).toBe('index.html');
    expect(xml.querySelector('access')?.getAttribute('origin')).toBe('https://example.test');
    expect(Array.from(xml.getElementsByTagName('tizen:privilege'), element => element.getAttribute('name'))).toContain('http://tizen.org/privilege/tv.inputdevice');
  }
});
