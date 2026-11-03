import { describe, expect, it } from 'vitest';
import type { Rollup } from 'vite';
import { inspectRemoteBoundary } from '../../scripts/remote-boundary';

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
}

/** A rendered chunk shaped like the ones Rollup hands to `generateBundle`. */
function chunk(fileName: string, modules: Record<string, number>, edges: Edges = {}): Rollup.OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code: 'x'.repeat(Object.values(modules).reduce((total, size) => total + size, 0)),
    imports: edges.imports ?? [],
    dynamicImports: edges.dynamicImports ?? [],
    modules: Object.fromEntries(
      Object.entries(modules).map(([id, renderedLength]) => [id, { renderedLength }]),
    ),
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