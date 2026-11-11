import { expect, it } from 'vitest';
import { resolveTvPlatform } from '../../src/tv-solid/platform/tv-platform';

const samsung = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.5) AppleWebKit/537.36 Chrome/69.0.3497.106 TV Safari/537.36';
const lg = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/87.0.4280.144 Safari/537.36 WebAppManager';

it('selects real TV user agents when a direct hosted URL has no platform hint', () => {
  expect(resolveTvPlatform('', samsung)).toBe('tizen');
  expect(resolveTvPlatform('', lg)).toBe('webos');
  expect(resolveTvPlatform('', lg.replace('Web0S', 'webOS'))).toBe('webos');
});

it('retains explicit platform fixtures and a web override on TV browsers', () => {
  for (const platform of ['web', 'webos', 'tizen', 'vizio']) {
    expect(resolveTvPlatform(`?platform=${platform}`, samsung)).toBe(platform);
    expect(resolveTvPlatform(`?platform=${platform}`, lg)).toBe(platform);
  }
  expect(resolveTvPlatform('?platform=invalid', samsung)).toBe('tizen');
});

it('keeps desktop, PS4 and mobile Tizen browsers on the shared web path', () => {
  for (const agent of ['', 'Mozilla/5.0 (PlayStation 4 11.00)', 'Mozilla/5.0 (Linux; Android 14)', 'Mozilla/5.0 (Linux; Tizen 3.0; Mobile)']) {
    expect(resolveTvPlatform('', agent)).toBe('web');
  }
});
