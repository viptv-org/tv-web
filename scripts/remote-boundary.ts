import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin, Rollup } from 'vite';

/** The TV entry module every other measurement is rooted at. */
const TV_ENTRY = /\/src\/tv-solid\/main\.ts$/;
/** The page `/tv/` serves: it selects the TV renderer and launches it. */
const BOOTSTRAP_ENTRY = /\/src\/bootstrap\.ts$/;
/** The React application is the bootstrap's non-TV branch; a TV never fetches it. */
const REACT_ENTRY = /\/src\/main\.tsx$/;
/** The one prefetch the TV bootstrap awaits before first frame (`main.ts`). */
const BOOT_PREFETCH = /\/src\/tv-solid\/remote\/App\.tsx$/;
/** Client policy/engine code the TV entry must never ship or evaluate. */
const FORBIDDEN = [
  /^\/(?:vendor\/core|src\/core)\//,
  /^\/src\/api\/(?:client[^/]*|torrent-runtime[^/]*)\.[tj]s$/,
  /^\/src\/ui\/(?:continuation|app\/upNext)\.[tj]sx?$/,
  /^\/vendor\/video\/src\/(?:session|session-request|mediabunny[^/]*|tauri-native)\.ts$/,
];
/** Packages with one narrow use: a session that plays HLS, or the pairing
 * screen that draws a QR code. Both must stay behind an on-demand `import()`. */
const ON_DEMAND_ONLY = [/^\/node_modules\/hls\.js\//, /^\/node_modules\/qrcode\//];
/** The Tauri IPC bridge is another app's transport. Its only entry condition is
 * `'__TAURI_INTERNALS__' in window`, so a TV never fetches it, and a lazy edge
 * into it must not pull the React desktop entry into the TV graph. */
const HOST_BRIDGE = /^\/node_modules\/@tauri-apps\//;
/** Runtime asset paths written as string literals by reachable TV code, such as
 * the empty-state photography. Public files are unhashed and addressed at
 * runtime rather than imported, so they are found by scanning emitted code. */
const RUNTIME_ASSET = /assets\/[\w.@/-]+/g;
/** The manifest `package-tv.mjs` uses instead of copying all of `dist`. It is
 * kept outside `dist` so the browser/desktop distribution is unchanged. */
export const TV_MANIFEST_FILE = 'tv-assets.json';

/** A path that resolves outside the project root (a linked `node_modules`)
 * keeps its package-relative tail, so package rules match in every checkout
 * layout. Anything else outside both gets no path and matches no rule. */
function relativePath(id: string, root: string): string {
  const normalised = id.replace(/\\/g, '/');
  if (normalised.startsWith(root + '/')) return '/' + normalised.slice(root.length + 1);
  const installed = normalised.lastIndexOf('/node_modules/');
  return installed === -1 ? '' : normalised.slice(installed);
}

interface ViteChunkMetadata {
  readonly importedCss?: Iterable<string>;
  readonly importedAssets?: Iterable<string>;
}

function viteMetadata(chunk: Rollup.OutputChunk): ViteChunkMetadata {
  return (chunk as Rollup.OutputChunk & { viteMetadata?: ViteChunkMetadata }).viteMetadata ?? {};
}

/** Vite writes a chunk only when it carries code; a CSS-only facade chunk is
 * dropped and only its extracted stylesheet remains in the output. */
function isWritten(chunk: Rollup.OutputChunk): boolean {
  return chunk.code.trim().length > 0 && Object.values(chunk.modules).some(module => module.renderedLength > 0);
}

export interface BoundaryReport {
  /** Chunks the TV fetches before its first frame, and their emitted code size. */
  readonly eagerChunks: readonly string[];
  readonly eagerBytes: number;
  /** Chunks reachable from the TV entry, including on-demand ones. */
  readonly chunks: readonly string[];
  readonly eagerModules: ReadonlySet<string>;
  readonly modules: ReadonlySet<string>;
  readonly forbidden: readonly string[];
  readonly eagerOnDemand: readonly string[];
}

/** Classify an emitted bundle without asserting anything, so the build gate and
 * its unit tests share one definition of "eager" and "forbidden". */
export function inspectRemoteBoundary(bundle: Rollup.OutputBundle, root: string): BoundaryReport {
  const relative = (id: string) => relativePath(id, root);
  const chunks = Object.values(bundle).filter((entry): entry is Rollup.OutputChunk => entry.type === 'chunk');
  const roots = chunks.filter(chunk => Object.keys(chunk.modules).some(id => TV_ENTRY.test(id)));
  if (!roots.length) throw new Error('The remote TV entry is missing from this build.');
  const prefetched = chunks
    .filter(chunk => Object.keys(chunk.modules).some(id => BOOT_PREFETCH.test(id)))
    .map(chunk => chunk.fileName);
  const collect = (names: readonly string[], follow: 'eager' | 'lazy') => {
    const visited = new Set<string>();
    const modules = new Set<string>();
    const emitted: string[] = [];
    let bytes = 0;
    const pending = [...names];
    while (pending.length) {
      const name = pending.pop()!;
      if (visited.has(name)) continue;
      visited.add(name);
      const chunk = bundle[name];
      if (!chunk || chunk.type !== 'chunk') continue;
      // The bridge is reached only inside the desktop host; stop there instead
      // of walking into the React entry chunk it happens to share a module with.
      if (!roots.includes(chunk) && Object.keys(chunk.modules).every(id => HOST_BRIDGE.test(relative(id)))) continue;
      pending.push(...chunk.imports);
      if (follow === 'lazy') pending.push(...chunk.dynamicImports);
      // A CSS-only facade chunk carries no executable code and is not written.
      if (!Object.values(chunk.modules).some(module => module.renderedLength > 0)) continue;
      emitted.push(name);
      bytes += chunk.code.length;
      for (const [id, module] of Object.entries(chunk.modules)) {
        if (module.renderedLength > 0) modules.add(id);
      }
    }
    return { chunks: emitted, bytes, modules };
  };
  // The bootstrap awaits its one prefetch before first frame, so that chunk is
  // as eager as the entry's own static imports.
  const eager = collect([...roots.map(chunk => chunk.fileName), ...prefetched], 'eager');
  const all = collect(roots.map(chunk => chunk.fileName), 'lazy');
  return {
    eagerChunks: eager.chunks,
    eagerBytes: eager.bytes,
    chunks: all.chunks,
    eagerModules: eager.modules,
    modules: all.modules,
    forbidden: [...all.modules].filter(id => { const path = relative(id); return !!path && FORBIDDEN.some(rule => rule.test(path)); }),
    eagerOnDemand: [...eager.modules].filter(id => { const path = relative(id); return !!path && ON_DEMAND_ONLY.some(rule => rule.test(path)); }),
  };
}

/** Why an emitted file sits on a branch a TV cannot execute. */
export interface UnreachableFile {
  /** Output path, relative to the output root. */
  readonly file: string;
  readonly reason: 'browser-app' | 'desktop-bridge';
  /** The module id that proves the classification. */
  readonly module: string;
}

export interface TvDistribution {
  /** URL prefix the build emits for absolute references (`config.base`). */
  readonly base: string;
  /** Every output file the TV pages can fetch, relative to the output root. */
  readonly files: readonly string[];
  /** Output files only the browser/desktop branch can fetch. Packaging them
   * would ship code a TV is not allowed to run; listing them lets the package
   * check prove every unresolved reference belongs to one of these branches. */
  readonly unreachable: readonly UnreachableFile[];
}

/** The HTML documents Vite writes for this build, relative to the output root. */
export function htmlEntryFiles(input: unknown, root: string): string[] {
  const values = typeof input === 'string'
    ? [input]
    : Array.isArray(input)
      ? input
      : Object.values((input ?? {}) as Record<string, unknown>);
  return values
    .filter((value): value is string => typeof value === 'string' && value.endsWith('.html'))
    .map(value => value.replace(/\\/g, '/').slice(root.length + 1))
    .sort();
}

/** Derive the TV package contents from the emitted bundle, never from a list of
 * chunk names. Names carry content hashes, and the lazy chunks a Tizen session
 * needs at Play are only knowable from the build's own import graph. */
export function collectTvDistribution(
  bundle: Rollup.OutputBundle,
  root: string,
  options: { readonly html: readonly string[]; readonly base: string; readonly isPublicFile?: (path: string) => boolean },
): TvDistribution {
  const relative = (id: string) => relativePath(id, root);
  const chunks = Object.values(bundle).filter((entry): entry is Rollup.OutputChunk => entry.type === 'chunk');
  const roots = chunks.filter(chunk => Object.keys(chunk.modules).some(id => TV_ENTRY.test(id) || BOOTSTRAP_ENTRY.test(id)));
  if (!roots.length) throw new Error('The remote TV entry is missing from this build.');

  const files = new Set<string>(options.html);
  const addAssets = (chunk: Rollup.OutputChunk) => {
    const metadata = viteMetadata(chunk);
    for (const file of metadata.importedCss ?? []) files.add(file);
    for (const file of metadata.importedAssets ?? []) files.add(file);
  };
  /** The bootstrap selects between the TV and React entries at runtime; the
   * desktop bridge is gated on the Tauri host. Neither is TV-reachable. */
  const stopBranch = (chunk: Rollup.OutputChunk): { reason: UnreachableFile['reason']; module: string } | undefined => {
    const modules = Object.keys(chunk.modules);
    const react = modules.find(id => REACT_ENTRY.test(relative(id)));
    if (react) return { reason: 'browser-app', module: relative(react) };
    if (modules.length && modules.every(id => HOST_BRIDGE.test(relative(id)))) {
      return { reason: 'desktop-bridge', module: relative(modules[0]) };
    }
    return undefined;
  };

  // Walk everything a TV page can fetch, including dynamic imports and the CSS
  // and assets each chunk pulls in.
  const visited = new Set<string>();
  const pending = roots.map(chunk => chunk.fileName);
  const excludedRoots: { chunk: Rollup.OutputChunk; reason: UnreachableFile['reason']; module: string }[] = [];
  while (pending.length) {
    const name = pending.pop()!;
    if (visited.has(name)) continue;
    visited.add(name);
    const chunk = bundle[name];
    if (!chunk || chunk.type !== 'chunk') continue;
    const stop = stopBranch(chunk);
    if (stop) {
      excludedRoots.push({ chunk, ...stop });
      continue;
    }
    if (isWritten(chunk)) files.add(name);
    addAssets(chunk);
    pending.push(...chunk.imports, ...chunk.dynamicImports);
  }

  // A TV never executes the excluded branches, so their imports stay out of the
  // package. Enumerating the full closure lets the package check prove that
  // every reference it cannot resolve is on one of those branches.
  const excluded = new Map<string, { reason: UnreachableFile['reason']; module: string }>();
  for (const entry of excludedRoots) {
    excluded.set(entry.chunk.fileName, { reason: entry.reason, module: entry.module });
  }
  const excludedPending = excludedRoots.map(entry => ({ file: entry.chunk.fileName, reason: entry.reason, module: entry.module }));
  const excludedVisited = new Set<string>();
  while (excludedPending.length) {
    const item = excludedPending.pop()!;
    if (excludedVisited.has(item.file)) continue;
    excludedVisited.add(item.file);
    const chunk = bundle[item.file];
    if (!chunk || chunk.type !== 'chunk') continue;
    if (!excluded.has(item.file)) excluded.set(item.file, item);
    const metadata = viteMetadata(chunk);
    for (const file of [...metadata.importedCss ?? [], ...metadata.importedAssets ?? []]) {
      if (!excluded.has(file)) excluded.set(file, item);
    }
    for (const next of [...chunk.imports, ...chunk.dynamicImports]) excludedPending.push({ ...item, file: next });
  }

  // Public files are unhashed and addressed at runtime, so the only reliable
  // source is the emitted code that names them.
  if (options.isPublicFile) {
    for (const file of [...files]) {
      if (!file.endsWith('.js')) continue;
      const chunk = bundle[file];
      if (!chunk || chunk.type !== 'chunk') continue;
      const code = chunk.code ?? '';
      for (const match of code.matchAll(RUNTIME_ASSET)) {
        if (options.isPublicFile(match[0])) files.add(match[0]);
      }
    }
  }

  return {
    base: options.base,
    files: [...files].sort(),
    unreachable: [...excluded]
      .filter(([file]) => !files.has(file))
      .map(([file, entry]) => ({ file, reason: entry.reason, module: entry.module }))
      .sort((left, right) => left.file.localeCompare(right.file)),
  };
}

/** Check the emitted, reachable TV graph, including shared and lazy chunks.
 * Type-only imports and tree-shaken legacy exports are not executable modules. */
export function remoteBoundary(): Plugin {
  let root = '';
  let base = '/';
  let outDir = '';
  let publicDir = '';
  let html: string[] = [];
  let distribution: TvDistribution | undefined;
  return {
    configResolved(config) {
      root = config.root.replace(/\\/g, '/');
      base = config.base;
      outDir = config.build.outDir;
      publicDir = config.publicDir;
      html = htmlEntryFiles(config.build.rollupOptions.input, root);
    },
    name: 'viptv-remote-boundary',
    generateBundle(_options, bundle) {
      const report = inspectRemoteBoundary(bundle, root);
      if (report.forbidden.length) this.error(`Remote TV loaded client policy/engine code:\n${report.forbidden.join('\n')}`);
      if (report.eagerOnDemand.length) {
        this.error(`Remote TV loads on-demand-only code before its first frame:\n${report.eagerOnDemand.join('\n')}`);
      }
      this.info(`Remote TV boundary passed: ${report.modules.size} emitted modules; ${report.eagerChunks.length} before first frame totalling ${(report.eagerBytes / 1000).toFixed(1)} kB (${report.eagerChunks.join(', ')}); no legacy engine, playback policy or on-demand engine.`);
      // Compute the package set here: a CSS-only facade chunk is still in the
      // bundle at this point, and its extracted stylesheet is what the TV
      // fetches. Later `generateBundle` hooks drop that facade from the bundle.
      distribution = collectTvDistribution(bundle, root, {
        base,
        html,
        isPublicFile: path => {
          const file = join(publicDir, path);
          return existsSync(file) && statSync(file).isFile();
        },
      });
      this.info(`TV distribution: ${distribution.files.length} files; ${distribution.unreachable.length} browser/desktop files stay out of the package.`);
    },
    writeBundle(options) {
      const directory = options.dir ?? outDir;
      if (!distribution) this.error('The TV distribution was not computed for this build.');
      const missing = distribution.files.filter(file => !existsSync(join(directory, file)));
      if (missing.length) this.error(`The TV distribution lists files this build did not write:\n${missing.join('\n')}`);
      const manifestPath = join(root, 'artifacts', TV_MANIFEST_FILE);
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, JSON.stringify(distribution, null, 2) + '\n');
    },
  };
}