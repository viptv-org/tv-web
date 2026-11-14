import { describe, expect, it } from 'vitest';
import type { Rollup } from 'vite';
import { collectTvDistribution, htmlEntryFiles, inspectRemoteBoundary } from '../../scripts/remote-boundary';

const root = '/repo';
const tv = '/repo/src/tv-solid/main.ts';
const app = '/repo/src/tv-solid/remote/App.tsx';
const playback = '/repo/src/tv-solid/remote/playback.ts';
const hlsEngine = '/repo/src/tv-solid/remote/hls-engine.ts';
const vizio = '/repo/vendor/video/src/vizio-html5.ts';
const hls = '/repo/node_modules/hls.js/dist/hls.mjs';
const qrcode = '/repo/node_modules/qrcode/lib/browser.js';
const avplay = '/repo/vendor/video/src/tizen-avplay.ts';
const engine = '/repo/vendor/core/wasm/viptv_core.js';
const bridge = '/repo/node_modules/@tauri-apps/plugin-http/dist-js/index.js';
const react = '/repo/src/main.tsx';

interface Edges {
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
  code?: string;
}

/** A rendered chunk shaped like the ones Rollup hands to `generateBundle`. */
function chunk(fileName: string, modules: Record<string, number>, edges: Edges = {}): Rollup.OutputChunk {
  const rendered = Object.values(modules).reduce((total, size) => total + size, 0);
  return {
    type: 'chunk',
    fileName,
    code: edges.code ?? 'x'.repeat(Math.max(rendered, 1)),
    imports: edges.imports ?? [],
    dynamicImports: edges.dynamicImports ?? [],
    modules: Object.fromEntries(
      Object.entries(modules).map(([id, renderedLength]) => [id, { renderedLength }]),
    ),
    viteMetadata: {
      importedAssets: new Set(edges.assets ?? []),
      importedCss: new Set(edges.css ?? []),
    },
  } as unknown as Rollup.OutputChunk;
}

const bundleOf = (...chunks: Rollup.OutputChunk[]) =>
  Object.fromEntries(chunks.map(current => [current.fileName, current])) as Rollup.OutputBundle;

describe('remote TV build boundary', () => {
  /** The shipped shape: the bootstrap awaits `remote/App`, and only a session
   * fetches the HTML/HLS engine, so hls.js never precedes the first frame. */
  const shipped = () =>
    bundleOf(
      chunk('main.js', { [tv]: 100 }, { imports: ['preload.js'], dynamicImports: ['App.js'] }),
      chunk('preload.js', { '/repo/node_modules/vite/preload-helper.js': 10 }),
      chunk('App.js', { [app]: 100, [playback]: 10 }, { imports: ['tokens.js'], dynamicImports: ['hls-engine.js', 'qrcode.js'] }),
      chunk('tokens.js', { [avplay]: 100 }),
      chunk('hls-engine.js', { [hlsEngine]: 10 }, { imports: ['vizio.js'] }),
      chunk('vizio.js', { [vizio]: 100, [hls]: 50_000 }),
      chunk('qrcode.js', { [qrcode]: 10_000 }),
    );

  it('keeps hls.js and the QR encoder out of the first frame', () => {
    const report = inspectRemoteBoundary(shipped(), root);

    expect(report.eagerOnDemand).toEqual([]);
    expect([...report.eagerModules]).not.toContain(hls);
    expect([...report.eagerModules]).not.toContain(qrcode);
    expect(report.eagerChunks).toEqual(['App.js', 'tokens.js', 'main.js', 'preload.js']);
    // Both are still emitted and reachable on demand, so the split is real.
    expect([...report.modules]).toContain(hls);
    expect([...report.modules]).toContain(qrcode);
  });

  it('fails when a static adapter import puts hls.js back on the boot path', () => {
    const report = inspectRemoteBoundary(
      bundleOf(
        chunk('main.js', { [tv]: 100 }, { dynamicImports: ['App.js'] }),
        chunk('App.js', { [app]: 100, [playback]: 10, [vizio]: 100 }, { imports: ['browser.js'] }),
        chunk('browser.js', { [hls]: 50_000 }),
      ),
      root,
    );

    expect(report.eagerOnDemand).toEqual([hls]);
  });

  it('fails when the pairing screen imports the QR encoder eagerly', () => {
    const report = inspectRemoteBoundary(
      bundleOf(
        chunk('main.js', { [tv]: 100 }, { dynamicImports: ['App.js'] }),
        chunk('App.js', { [app]: 100, [qrcode]: 10_000 }),
      ),
      root,
    );

    expect(report.eagerOnDemand).toEqual([qrcode]);
  });

  it('still refuses client policy and engine code reached through a lazy import', () => {
    const report = inspectRemoteBoundary(
      bundleOf(
        chunk('main.js', { [tv]: 100 }, { dynamicImports: ['App.js'] }),
        chunk('App.js', { [app]: 100 }, { dynamicImports: ['engine.js'] }),
        chunk('engine.js', { [engine]: 90_000 }),
      ),
      root,
    );

    expect(report.forbidden).toEqual([engine]);
    expect(report.eagerOnDemand).toEqual([]);
  });

  it('does not treat the desktop bridge as TV code', () => {
    const report = inspectRemoteBoundary(
      bundleOf(
        chunk('main.js', { [tv]: 100 }, { dynamicImports: ['App.js'] }),
        chunk('App.js', { [app]: 100 }, { dynamicImports: ['hls-engine.js'] }),
        chunk('hls-engine.js', { [hlsEngine]: 10 }, { imports: ['vizio.js'] }),
        chunk('vizio.js', { [vizio]: 100, [hls]: 50_000 }, { dynamicImports: ['bridge.js'] }),
        chunk('bridge.js', { [bridge]: 2_000 }, { imports: ['react.js'] }),
        chunk('react.js', { [react]: 600_000, [engine]: 90_000 }),
      ),
      root,
    );

    expect(report.forbidden).toEqual([]);
    expect(report.eagerOnDemand).toEqual([]);
  });

  it('requires the TV entry to exist in the build', () => {
    expect(() => inspectRemoteBoundary(bundleOf(chunk('main.js', { [react]: 100 })), root)).toThrow(
      'The remote TV entry is missing from this build.',
    );
  });
});

describe('TV distribution manifest', () => {
  const bootstrap = '/repo/src/bootstrap.ts';
  const hostCss = '/repo/src/tv-solid/host.css';
  const options = { base: '/tv/', html: ['index.html', 'lightning.html', 'solid.html'] };

  /** The shipped shape: `/tv/` loads the bootstrap, which dynamically imports
   * the TV entry, the host stylesheet and the React application. The TV entry
   * lazily fetches the HLS engine and the QR encoder, and the HLS engine can
   * lazily reach the desktop bridge. */
  const shipped = () =>
    bundleOf(
      chunk('app.js', { [bootstrap]: 100, '/repo/src/rendererSelection.ts': 10 }, {
        imports: ['preload.js'], dynamicImports: ['host.js', 'main.js', 'react.js'],
      }),
      chunk('preload.js', { '/repo/node_modules/vite/preload-helper.js': 10 }),
      chunk('host.js', { [hostCss]: 0 }, { css: ['host.css'] }),
      chunk('main.js', { [tv]: 100 }, { dynamicImports: ['App.js'], assets: ['font.woff2'] }),
      chunk('App.js', { [app]: 100 }, { dynamicImports: ['hls-engine.js', 'qrcode.js'], assets: ['photo.webp'] }),
      chunk('hls-engine.js', { [hlsEngine]: 10 }, { imports: ['vizio.js'] }),
      chunk('vizio.js', { [vizio]: 100, [hls]: 50_000 }, { dynamicImports: ['bridge.js'] }),
      chunk('qrcode.js', { [qrcode]: 10_000 }),
      chunk('bridge.js', { [bridge]: 2_000 }, { imports: ['react.js'] }),
      chunk('react.js', { [react]: 600_000 }, { imports: ['engine.js', 'mediabunny.js'], css: ['main.css'], assets: ['engine.wasm'] }),
      chunk('engine.js', { [engine]: 90_000 }),
      chunk('mediabunny.js', { '/repo/node_modules/mediabunny/index.js': 400_000 }),
    );

  it('packages every chunk a TV can fetch, including the lazy HLS and QR chunks', () => {
    const { files } = collectTvDistribution(shipped(), root, options);

    expect(files).toEqual(expect.arrayContaining([
      'index.html', 'lightning.html', 'solid.html',
      'app.js', 'preload.js', 'host.css', 'main.js', 'App.js', 'hls-engine.js', 'vizio.js', 'qrcode.js',
      'font.woff2', 'photo.webp',
    ]));
  });

  it('leaves the browser application and its assets out, and says why', () => {
    const { files, unreachable } = collectTvDistribution(shipped(), root, options);

    expect(files).not.toContain('react.js');
    expect(files).not.toContain('mediabunny.js');
    expect(files).not.toContain('engine.wasm');
    expect(files).not.toContain('main.css');
    expect(unreachable).toEqual(expect.arrayContaining([
      { file: 'react.js', module: '/src/main.tsx', reason: 'browser-app' },
      { file: 'engine.wasm', module: '/src/main.tsx', reason: 'browser-app' },
      { file: 'main.css', module: '/src/main.tsx', reason: 'browser-app' },
      { file: 'bridge.js', module: '/node_modules/@tauri-apps/plugin-http/dist-js/index.js', reason: 'desktop-bridge' },
    ]));
  });

  it('does not walk the desktop bridge into the React entry', () => {
    const { files } = collectTvDistribution(
      bundleOf(
        chunk('app.js', { [bootstrap]: 100 }, { dynamicImports: ['main.js'] }),
        chunk('main.js', { [tv]: 100 }, { dynamicImports: ['vizio.js'] }),
        chunk('vizio.js', { [vizio]: 100 }, { dynamicImports: ['bridge.js'] }),
        chunk('bridge.js', { [bridge]: 2_000 }, { imports: ['react.js'] }),
        chunk('react.js', { [react]: 600_000 }),
      ),
      root,
      options,
    );

    expect(files).toContain('vizio.js');
    expect(files).not.toContain('bridge.js');
    expect(files).not.toContain('react.js');
  });

  it('adds public files named by reachable TV code only', () => {
    const publicFile = 'assets/photography/live-empty-wide.webp';
    const { files } = collectTvDistribution(
      bundleOf(
        chunk('app.js', { [bootstrap]: 100 }, { dynamicImports: ['main.js'] }),
        chunk('main.js', { [tv]: 100 }, {
          code: `const wide="/tv/${publicFile}", tall="/tv/assets/photography/live-empty-tall.webp";`,
        }),
        chunk('react.js', { '/repo/src/main.tsx': 100 }, {
          code: 'const gallery="/tv/assets/avatar-catalog/clay-1.png";',
        }),
      ),
      root,
      { ...options, isPublicFile: path => path === publicFile },
    );

    expect(files).toContain(publicFile);
    expect(files).not.toContain('assets/avatar-catalog/clay-1.png');
  });

  it('adds public files named by reachable TV code outside the assets directory', () => {
    const artwork = 'tv-artwork/87b1f851442b89b94153.png';
    const { files } = collectTvDistribution(
      bundleOf(
        chunk('app.js', { [bootstrap]: 100 }, { dynamicImports: ['main.js'] }),
        chunk('main.js', { [tv]: 100 }, {
          code: `const hero="/tv/${artwork}";`,
        }),
      ),
      root,
      { ...options, isPublicFile: path => path === artwork },
    );

    expect(files).toContain(artwork);
  });

  it('adds public files named by a relative-base build outside the assets directory', () => {
    const artwork = 'tv-artwork/b1e715feceeb80c8ca5f.webp';
    const { files } = collectTvDistribution(
      bundleOf(
        chunk('app.js', { [bootstrap]: 100 }, { dynamicImports: ['main.js'] }),
        chunk('main.js', { [tv]: 100 }, {
          code: `const hero="./${artwork}";`,
        }),
      ),
      root,
      { ...options, base: './', isPublicFile: path => path === artwork },
    );

    expect(files).toContain(artwork);
  });

  it('requires at least one TV entry in the build', () => {
    expect(() => collectTvDistribution(bundleOf(chunk('react.js', { [react]: 100 })), root, options)).toThrow(
      'The remote TV entry is missing from this build.',
    );
  });

  it('derives the HTML documents from the build inputs', () => {
    expect(htmlEntryFiles({ app: '/repo/index.html', solid: '/repo/solid.html', lightning: '/repo/lightning.html' }, root))
      .toEqual(['index.html', 'lightning.html', 'solid.html']);
    expect(htmlEntryFiles(['/repo/solid.html'], root)).toEqual(['solid.html']);
    expect(htmlEntryFiles(undefined, root)).toEqual([]);
  });
});