import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
// @ts-expect-error Node packaging utilities have no application declaration file.
import { stageTizenApplication, tvApiOrigin } from '../../scripts/tv-application.mjs';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

it('rejects ambiguous or credential-bearing API endpoints for the native package', () => {
  for (const origin of ['http://api.example.test', 'https://name:secret@api.example.test', 'https://api.example.test/tv/', 'https://api.example.test/?token=value'])
    expect(() => tvApiOrigin(origin)).toThrow();
  expect(tvApiOrigin('https://api.example.test:8443')).toBe('https://api.example.test:8443');
});

it('stages the local TV closure, binds its API origin and permits dynamic HTTPS resources while keeping scripts local', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'viptv-native-dist-'));
  const stage = await mkdtemp(join(tmpdir(), 'viptv-native-stage-'));
  directories.push(dist, stage);
  await writeFile(join(dist, 'index.html'), '<!doctype html><html><head></head><body><script type="module" src="./main.js"></script></body></html>');
  await writeFile(join(dist, 'main.js'), 'export const ready=true;');
  const manifest = { base: './', files: ['index.html', 'main.js'], unreachable: [] };
  const options = { root: resolve('.'), dist, stage, manifest, apiOrigin: 'https://api.example.test', version: '0.2.3' };
  await expect(stageTizenApplication({ ...options, manifest: { ...manifest, base: '/tv/' } })).rejects.toThrow('relative-base');
  const report = await stageTizenApplication(options);
  expect(report.problems).toEqual([]);
  const html = new DOMParser().parseFromString(await readFile(join(stage, 'index.html'), 'utf8'), 'text/html');
  expect(JSON.parse(html.querySelector('#viptv-packaged-host')!.textContent!)).toEqual({ platform: 'tizen', apiOrigin: 'https://api.example.test' });
  expect(html.querySelector('script[type=module]')?.getAttribute('src')).toBe('./main.js');
  const xml = new DOMParser().parseFromString(await readFile(join(stage, 'config.xml'), 'utf8'), 'application/xml');
  expect(xml.querySelector('parsererror')).toBeNull();
  expect(xml.querySelector('content')?.getAttribute('src')).toBe('index.html');
  expect(xml.querySelector('access')?.getAttribute('origin')).toBe('*');
  const policy = xml.getElementsByTagName('tizen:content-security-policy')[0].textContent;
  expect(policy).toContain("script-src 'self' 'unsafe-inline';");
  expect(policy).toContain("img-src 'self' https: data: blob:;");
  expect(policy).toContain('media-src https: blob:;');
});
