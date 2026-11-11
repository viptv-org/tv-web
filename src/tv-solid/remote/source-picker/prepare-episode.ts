import type { RemoteTvApi } from "../api";
import type { SourceReuseContext } from "../device-playback";
import { sourcePageReady, sourceStartIds, type PreparedEpisode } from "../episode-preparation";
import type { Card, Source, SourcePage } from "../types";

export function createEpisodeDiscovery(options: {
  api: Pick<RemoteTvApi, "titleAction" | "sources">;
  memory: (card: Card) => Promise<SourceReuseContext>;
}) {
  async function discoverEpisode(card: Card, signal: AbortSignal): Promise<Omit<PreparedEpisode, "created">> {
    const resolved = await options.api.titleAction(card, true, signal);
    const memory = await options.memory(resolved.card);
    if (signal.aborted) throw new DOMException("Preparation cancelled", "AbortError");
    const operation = new AbortController(), cancel = () => operation.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const remembered = !!(memory.title || memory.across);
    let page: SourcePage | undefined, ready!: (rows: Source[]) => void;
    const firstReady = new Promise<Source[]>(resolve => { ready = resolve; });
    try {
      const discovery = options.api.sources(resolved.card, (rows, value) => {
        if (operation.signal.aborted) return;
        page = value;
        if (sourcePageReady(value, remembered)) ready(rows);
      }, operation.signal, undefined, () => undefined, memory);
      // A qualifying preferred supplier need not wait behind unrelated slow
      // providers. Both readiness and candidate IDs remain server decisions.
      const streams = await Promise.race([discovery, firstReady]);
      if (!page || signal.aborted) throw new DOMException("Preparation cancelled", "AbortError");
      page = { ...page, streams: [...streams] };
      return { card: resolved.card, action: resolved, page, ids: sourceStartIds(page, remembered), memory: remembered };
    } finally {
      signal.removeEventListener("abort", cancel);
      operation.abort();
    }
  }
  return discoverEpisode;
}
