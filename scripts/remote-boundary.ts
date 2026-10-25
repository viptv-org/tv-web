import type { Plugin } from 'vite';

/** Check the emitted, reachable TV graph, including shared and lazy chunks.
 * Type-only imports and tree-shaken legacy exports are not executable modules. */
export function remoteBoundary(): Plugin {
  let root='';
  return {
    configResolved(config){root=config.root.replace(/\\/g,'/');},
    name: 'viptv-remote-boundary',
    generateBundle(_options, bundle) {
      const roots = Object.values(bundle).filter(chunk => chunk.type === 'chunk' &&
        Object.keys(chunk.modules).some(id => id.endsWith('/src/tv-solid/main.ts')));
      if (!roots.length) this.error('The remote TV entry is missing from this build.');
      const pending = roots.map(chunk => chunk.fileName), visited = new Set<string>(), modules = new Set<string>();
      while (pending.length) {
        const name = pending.pop()!;
        if (visited.has(name)) continue;
        visited.add(name);
        const chunk = bundle[name];
        if (!chunk || chunk.type !== 'chunk') continue;
        pending.push(...chunk.imports, ...chunk.dynamicImports);
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (module.renderedLength > 0) modules.add(id);
        }
      }
      const forbidden = [...modules].filter(moduleId => {const id=moduleId.startsWith(root+'/')?'/'+moduleId.slice(root.length+1):'';return /^\/(?:vendor\/core|src\/core)\//.test(id) ||
        /^\/src\/api\/(?:client[^/]*|torrent-runtime[^/]*)\.[tj]s$/.test(id) ||
        /^\/src\/ui\/(?:continuation|app\/upNext)\.[tj]sx?$/.test(id) ||
        /^\/vendor\/video\/src\/(?:session|session-request|mediabunny[^/]*|tauri-native)\.ts$/.test(id);});
      if (forbidden.length) this.error(`Remote TV loaded client policy/engine code:\n${forbidden.join('\n')}`);
      this.info(`Remote TV boundary passed: ${modules.size} emitted modules; no legacy engine or playback policy.`);
    },
  };
}
