import { normalizeCore } from "./index";
import type { CardPresentation, HeroEdgePool, MediaItem, MediaPresentation } from "../api";

/**
 * Presentation and artwork projections are pure functions of the item, but
 * every direct `normalizeCore` call is a JSON → WASM → JSON round trip.
 * Rows re-render for window and focus changes while items keep their object
 * identity, and the TV layout keeps every card mounted, so recomputing a
 * presentation per render multiplies the WASM cost across whole shelves.
 *
 * Entries cache per item identity: items are replaced wholesale when data
 * is refetched, and the WeakMap drops their projections with them.
 * `failedImages` is part of the key because image failures are deliberate
 * input to the Rust fallback-choice policy, and the playback-progress
 * presentation is intentionally uncached — its result depends on the
 * ticking position.
 */
const cardCache = new WeakMap<MediaItem, Map<string, CardPresentation>>();
const presentationCache = new WeakMap<MediaItem, MediaPresentation>();
const artworkCache = new Map<string, string>();

export function cardPresentation(
  item: MediaItem,
  context: "queue" | "catalog",
  failedImages: readonly string[] = [],
): CardPresentation {
  let byContext = cardCache.get(item);
  if (!byContext) {
    byContext = new Map();
    cardCache.set(item, byContext);
  }
  const key = failedImages.length ? `${context}:${failedImages.join("|")}` : context;
  let value = byContext.get(key);
  if (!value) {
    value =
      failedImages.length
        ? normalizeCore<CardPresentation>("cardPresentation", { item, context, failedImages })
        : normalizeCore<CardPresentation>("cardPresentation", { item, context });
    byContext.set(key, value);
  }
  return value;
}

export function presentation(item: MediaItem): MediaPresentation {
  let value = presentationCache.get(item);
  if (!value) {
    value = normalizeCore<MediaPresentation>("presentation", item);
    presentationCache.set(item, value);
  }
  return value;
}

export function artworkUrl(
  original: string | undefined,
  width: number,
  height: number,
  large = false,
  logo = false,
): string | undefined {
  if (!original) return undefined;
  const key = `${original}|${width}x${height}|${large ? 1 : 0}${logo ? 1 : 0}`;
  let value = artworkCache.get(key);
  if (value === undefined) {
    if (artworkCache.size >= 4096) artworkCache.clear();
    value = normalizeCore<string | null>("artworkUrl", { original, width, height, large, logo }) ?? "";
    artworkCache.set(key, value);
  }
  return value || undefined;
}

const edgePoolCache = new Map<string, HeroEdgePool>();

/**
 * The TV hero backdrop's category and edge pool for a title (TV-042). Rust owns
 * the genre table; the renderer passes the edge styles it actually ships. One
 * bridge call per distinct title facts, never per frame. All three fields are
 * always sent, and a Core error yields an empty pool (the `linear` baseline)
 * rather than breaking the backdrop.
 */
export function heroEdgePool(
  mediaType: string,
  genres: readonly string[] | null | undefined,
  availableEdges: readonly string[],
): HeroEdgePool {
  const input = { mediaType: mediaType || "movie", genres: genres ? [...genres] : [], availableEdges: [...availableEdges] };
  const key = `${input.mediaType}\u0000${input.genres.join("\u0001")}\u0000${input.availableEdges.join("\u0001")}`;
  let value = edgePoolCache.get(key);
  if (!value) {
    try {
      value = normalizeCore<HeroEdgePool>("heroEdgePool", input);
    } catch (cause) {
      console.warn("Hero edge pool unavailable; using the baseline edge", cause);
      return { category: null, edges: [] };
    }
    if (edgePoolCache.size >= 256) edgePoolCache.clear();
    edgePoolCache.set(key, value);
  }
  return value;
}
