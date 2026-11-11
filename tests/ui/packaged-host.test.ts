import { expect, it } from 'vitest';
import { packagedTvHost } from '../../src/tv-solid/platform/packaged-host';

function config(value: unknown) {
  const root = document.implementation.createHTMLDocument();
  const data = root.createElement('script');
  data.id = 'viptv-packaged-host'; data.type = 'application/json'; data.textContent = JSON.stringify(value);
  root.head.append(data);
  return root;
}

it('uses an explicit credential-free HTTPS API origin only inside a packaged entry', () => {
  const root = config({ platform: 'tizen', apiOrigin: 'https://api.example.test' });
  expect(packagedTvHost('https:', root)).toBeUndefined();
  expect(packagedTvHost('file:', root)).toEqual({ platform: 'tizen', apiOrigin: 'https://api.example.test' });
  for (const origin of ['file:///app', 'http://api.example.test', 'https://user:secret@api.example.test', 'https://api.example.test/path', 'https://api.example.test/?query'])
    expect(() => packagedTvHost('file:', config({ platform: 'tizen', apiOrigin: origin }))).toThrow();
});
