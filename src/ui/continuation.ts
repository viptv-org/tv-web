import { normalizeCore } from "../core";
import type {
  MediaItem,
  MediaSource,
  PlaybackCapabilities,
  PlaybackPreferences,
  SourcesPollState,
  TvApi,
} from "../api";
import type { SessionStartIntent } from "@viptv/video";

/**
 * The continuation selector is deliberately separate from exact resume.
 *
 * Roku's `BestContinuationSource` keeps an IPTV episode inside the account
 * which supplied the current episode. Add-on episodes are instead selected by
 * the same source-match ranking used in the source picker. This protects a
 * user from silently crossing IPTV accounts, while still allowing ordinary
 * add-ons to supply the best available next episode.
 */
export async function resolveNext(
  api: Pick<TvApi, "nextEpisode" | "sources" | "pollSourcesStep">,
  profileId: string,
  current: MediaItem,
  preferences: PlaybackPreferences,
  signal?: AbortSignal,
  capabilities: PlaybackCapabilities = DEFAULT_CONTINUATION_CAPABILITIES,
  excludedSourceIds: ReadonlySet<string> = new Set(),
): Promise<SessionStartIntent<MediaItem, MediaSource> | null> {
  const next = await api.nextEpisode(profileId, current, { signal });
  if (next.status !== "next" || !next.item) return null;

  const discovery = await api.sources(next.item, { signal });
  const sources = await collectSources(api, discovery.id, signal);
  const source = bestContinuationSource(
    sources.filter((source) => !excludedSourceIds.has(source.id)),
    current,
    preferences,
    capabilities,
  );
  return source ? { item: next.item, source, position: 0 } : null;
}

/** Matches Roku's default SourceMatch capability envelope. */
export const DEFAULT_CONTINUATION_CAPABILITIES: PlaybackCapabilities = {
  maxWidth: 1920,
  maxHeight: 1080,
  h264: true,
  hevc: false,
  aac: true,
  directPlay: true,
  hevcSdr: false,
};

/**
 * Port of Roku `BestContinuationSource`: IPTV stays with its source account;
 * add-on candidates are ranked and discovery order resolves equal ranks.
 */
export function bestContinuationSource(
  sources: readonly MediaSource[],
  current: Pick<MediaItem, "sourceAddonId">,
  preferences: PlaybackPreferences,
  capabilities: PlaybackCapabilities = DEFAULT_CONTINUATION_CAPABILITIES,
): MediaSource | undefined {
  return normalizeCore<MediaSource | null>("continuationSource", { sources, current, preferences, capabilities }) ?? undefined;
}

/** Resume must never select a similarly named source from another provider. */
export function exactResumeSource(item: MediaItem, sources: readonly MediaSource[]): MediaSource | undefined {
  return normalizeCore<MediaSource | null>("exactResumeSource", { item, sources }) ?? undefined;
}

export interface SourceMatch {
  readonly rank: number;
  readonly likely: boolean;
  readonly best: boolean;
}

/**
 * Rust owns the shared source ranking policy.
 * It is recommendation only: backend inspection, not a release filename,
 * decides whether direct play is actually safe.
 */
export function sourceMatch(
  source: MediaSource,
  capabilities: PlaybackCapabilities,
  preferences: PlaybackPreferences,
): SourceMatch {
  return normalizeCore<SourceMatch>("sourceMatch", { source, capabilities, preferences });
}

async function collectSources(
  api: Pick<TvApi, "pollSourcesStep">,
  id: string,
  signal?: AbortSignal,
): Promise<readonly MediaSource[]> {
  // The polling policy (cursor, dedup, three-minute budget, completion) is
  // the shared Rust reducer; this loop owns only cancellation and the delay.
  let state: SourcesPollState = { after: 0, sources: [], polls: 0 };
  for (;;) {
    throwIfAborted(signal);
    const step = await api.pollSourcesStep(id, state, { signal });
    if (step.done) return step.sources;
    state = step.state;
    await delay(1_500, signal);
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
}
function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(done, milliseconds);
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}
