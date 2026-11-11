import type { RemoteTvApi } from "../api";
import { cardKey, type Card } from "../types";

export async function searchStremio(discover: RemoteTvApi["discover"], value: string, signal: AbortSignal) {
  const results = await Promise.allSettled([
    discover(
      { type: "movie", provider_id: "stremio", search: value },
      signal,
    ),
    discover(
      { type: "series", provider_id: "stremio", search: value },
      signal,
    ),
  ]);
  const pages = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (!pages.length) {
    const failure = results.find((result) => result.status === "rejected");
    throw failure && failure.status === "rejected"
      ? failure.reason
      : new Error("Search is unavailable. Try again.");
  }
  const cards: Card[] = [],
    seen = new Set<string>();
  for (const page of pages)
    for (const card of page.cards) {
      const key = cardKey(card);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  return {
    cards,
    complete: pages.every((page) => page.complete),
    next_cursor: null,
  };
}
