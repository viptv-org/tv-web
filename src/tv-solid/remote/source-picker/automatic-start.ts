import type { RemoteTvApi } from "../api";
import type { SourceReuseContext } from "../device-playback";
import { sourcePageReady, sourceStartIds } from "../episode-preparation";
import type { Source, SourcePage, TitleAction } from "../types";

/** Executes only the server-projected candidates, including its preferred-phase expansion. */
export async function startAutomaticSources(options: {
  api: Pick<RemoteTvApi, "preferredSourceDiscoverySupported" | "sources">;
  page: SourcePage; rows: Source[]; action: () => TitleAction; memory: SourceReuseContext; hasMemory: boolean;
  active: () => boolean; intent: () => boolean; owns: (operation: AbortController) => boolean;
  fallback: (operation: AbortController) => void;
  publish: (rows: Source[], page: SourcePage, ids: string[]) => void;
  ready: () => void; play: (source: Source) => Promise<boolean>; notify: (message: string) => void;
}): Promise<"started" | "cancelled" | "exhausted"> {
  let page = options.page, rows = options.rows, expanded = false, attempts = 0;
  let ids = sourceStartIds(page, options.hasMemory);
  const tried = new Set<string>();
  while (attempts < 3) {
    if (!options.active()) return "cancelled";
    const id = ids.find(id => !tried.has(id));
    if (!id) {
      if (!options.api.preferredSourceDiscoverySupported || page.discovery_phase !== "preferred" || expanded) break;
      expanded = true;
      const fallback = new AbortController();options.fallback(fallback);
      let fallbackPage: SourcePage | undefined;
      let ready!: (rows: Source[]) => void;
      const first = new Promise<Source[]>(resolve => { ready = resolve; });
      const discovery = options.api.sources(options.action().card, (value, result, allIds) => {
        if (!options.owns(fallback) || fallback.signal.aborted) return;
        fallbackPage = result;options.publish(value, result, allIds);
        if (sourcePageReady(result, options.hasMemory)) ready(value);
      }, fallback.signal, undefined, () => undefined, options.memory, true);
      rows = await Promise.race([discovery, first]);
      if (fallback.signal.aborted || !options.intent()) return "cancelled";
      options.ready();
      if (!fallbackPage) break;
      page = fallbackPage;ids = sourceStartIds(page, options.hasMemory);
      continue;
    }
    tried.add(id);
    const source = rows.find(row => row.id === id);
    if (!source) continue;
    if (attempts) {
      options.notify("Trying the next matching source…");
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!options.active()) return "cancelled";
    }
    attempts++;
    if (await options.play(source)) return "started";
  }
  return "exhausted";
}
