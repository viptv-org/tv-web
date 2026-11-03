import type { Plugin, Rollup } from 'vite';

/** The TV entry module every other measurement is rooted at. */
const TV_ENTRY = /\/src\/tv-solid\/main\.ts$/;
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
  const relative = (id: string) => {
    const normalised = id.replace(/\\/g, '/');
    if (normalised.startsWith(root + '/')) return '/' + normalised.slice(root.length + 1);
    // A linked `node_modules` resolves outside the project root; keep its
    // package-relative tail so package rules match in every checkout layout.
    const installed = normalised.lastIndexOf('/node_modules/');
    return installed === -1 ? '' : normalised.slice(installed);
  };
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

/** Check the emitted, reachable TV graph, including shared and lazy chunks.
 * Type-only imports and tree-shaken legacy exports are not executable modules. */
export function remoteBoundary(): Plugin {
  let root = '';
  return {
    configResolved(config) { root = config.root.replace(/\\/g, '/'); },
    name: 'viptv-remote-boundary',
    generateBundle(_options, bundle) {
      const report = inspectRemoteBoundary(bundle, root);
      if (report.forbidden.length) this.error(`Remote TV loaded client policy/engine code:\n${report.forbidden.join('\n')}`);
      if (report.eagerOnDemand.length) {
        this.error(`Remote TV loads on-demand-only code before its first frame:\n${report.eagerOnDemand.join('\n')}`);
      }
      this.info(`Remote TV boundary passed: ${report.modules.size} emitted modules; ${report.eagerChunks.length} before first frame totalling ${(report.eagerBytes / 1000).toFixed(1)} kB (${report.eagerChunks.join(', ')}); no legacy engine, playback policy or on-demand engine.`);
    },
  };
}