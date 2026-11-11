import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  javascriptReferences,
  resolveReference,
  scanTvPackage,
  stylesheetReferences,
  verifyTvPackage,
} from '../../scripts/tv-package-check.mjs';

const base = '/tv/';
const packageOf = (files: Record<string, string>) => {
  const directory = mkdtempSync(join(tmpdir(), 'viptv-tv-package-'));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), source);
  }
  return directory;
};

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const stage = (files: Record<string, string>) => {
  const directory = packageOf(files);
  directories.push(directory);
  return directory;
};

describe('TV package check', () => {
  it('reads emitted module specifiers and static preload entries, not prose', () => {
    const references = javascriptReferences([
      'import{a}from"./lazy-ABC.js";',
      'import"./side-DEF.js";',
      'const load=()=>import("./hls-GHI.js");',
      'const deps=["assets/tokens-XYZ.css"];',
      'var R=["Could not find a path from ",e," to ",t,"."].join("");',
      's.warn(`queuing ${t} from "${e}"`);',
    ].join('\n'));

    expect([...references]).toEqual(expect.arrayContaining([
      './lazy-ABC.js', './side-DEF.js', './hls-GHI.js', 'assets/tokens-XYZ.css',
    ]));
    expect([...references]).not.toContain(',e,');
    expect([...references]).not.toContain('${e}');
  });

  it('resolves relative modules, base-relative preload entries and absolute URLs', () => {
    expect(resolveReference('assets/app-X.js', './App-Y.js', base)).toBe('assets/App-Y.js');
    expect(resolveReference('assets/app-X.js', '../other/Z.js', base)).toBe('other/Z.js');
    expect(resolveReference('assets/app-X.js', 'assets/tokens-Z.css', base)).toBe('assets/tokens-Z.css');
    expect(resolveReference('index.html', '/tv/assets/app-X.js?v=1', base)).toBe('assets/app-X.js');
    expect(resolveReference('index.html', 'https://example.test/x.js', base)).toBeNull();
    expect(resolveReference('index.html', 'data:text/css,x', base)).toBeNull();
    expect(resolveReference('index.html', '/elsewhere/x.js', base)).toBeNull();
  });

  it('resolves stylesheet and document references', () => {
    expect([...stylesheetReferences('a{background:url(/tv/assets/photo-W.webp)}')])
      .toEqual(['/tv/assets/photo-W.webp']);
  });

  it('passes a package whose lazy chunks are all present', async () => {
    const directory = stage({
      'assets/app-X.js': 'import("./hls-Y.js");const q=import("./qr-Z.js");',
      'assets/hls-Y.js': 'export const hls=1;',
      'assets/qr-Z.js': 'export const qr=1;',
      'index.html': '<script type="module" src="/tv/assets/app-X.js"></script>',
      'assets/tokens.css': 'a{background:url(/tv/assets/photo.webp)}',
      'assets/photo.webp': '',
    });
    const manifest = { base, files: ['assets/app-X.js', 'assets/hls-Y.js', 'assets/qr-Z.js', 'index.html', 'assets/tokens.css', 'assets/photo.webp'] };

    const report = await verifyTvPackage(directory, manifest);

    expect(report.problems).toEqual([]);
    expect(report.missing).toEqual([]);
  });

  it('fails when a lazily fetched chunk was left out', async () => {
    const directory = stage({
      'assets/app-X.js': 'import("./hls-Y.js");',
      'index.html': '<script type="module" src="/tv/assets/app-X.js"></script>',
    });
    const manifest = { base, files: ['index.html', 'assets/app-X.js'] };

    const report = await verifyTvPackage(directory, manifest);

    expect(report.missing).toEqual([
      { from: 'assets/app-X.js', reference: './hls-Y.js', to: 'assets/hls-Y.js' },
    ]);
    expect(report.problems[0]).toContain('assets/hls-Y.js');
  });

  it('resolves relative-base public artwork from the document while retaining module-relative imports', async () => {
    const directory = stage({
      'index.html': '<script type="module" src="./assets/app.js"></script>',
      'assets/app.js': 'const picture="./assets/photo.webp";import("./assets/lazy.js");',
      'assets/photo.webp': '',
    });
    const report = await scanTvPackage(directory, { base: './', files: ['index.html', 'assets/app.js', 'assets/photo.webp'] });
    expect(report.missing).toEqual([{ from: 'assets/app.js', reference: './assets/lazy.js', to: 'assets/assets/lazy.js' }]);
  });

  it('allows only references the build declared unreachable for a TV', async () => {
    const directory = stage({
      'assets/app-X.js': 'const react=()=>import("./main-REACT.js");const load=()=>import("./hls-Y.js");',
      'assets/hls-Y.js': 'export const hls=1;',
    });
    const manifest = {
      base,
      files: ['assets/app-X.js', 'assets/hls-Y.js'],
      unreachable: [{ file: 'assets/main-REACT.js', module: '/src/main.tsx', reason: 'browser-app' as const }],
    };

    const report = await scanTvPackage(directory, manifest);

    expect(report.missing).toEqual([]);
    expect(report.allowed).toEqual([{ from: 'assets/app-X.js', to: 'assets/main-REACT.js' }]);
  });
});
