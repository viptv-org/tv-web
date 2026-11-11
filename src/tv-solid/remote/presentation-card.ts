import type { Card } from "./types";

/** Presentation identity includes the metadata authority, not just a shared IMDb ID. */
export function presentationKey(card: Card): string {
  const origin = card.metadata_origin;
  const episode = card.identity.episode;
  return JSON.stringify([origin?.provider_id ?? card.provider_id, origin?.connection_id, origin?.incarnation,
    card.identity.kind, card.identity.id, episode?.order, episode?.season, episode?.episode]);
}

/** Partial refreshes retain visual facts for the displayed or preparing selection. */
export function presentationCard(previous: Card | undefined, next: Card, pending?: Card): Card {
  if (pending && presentationKey(pending) === presentationKey(next))
    previous = presentationCard(previous, pending);
  if (!previous || presentationKey(previous) !== presentationKey(next)) return next;
  const value = (next: string | null | undefined, prior: string | null | undefined) => next?.trim() ? next : prior;
  return { ...next, description: value(next.description,previous.description),
    logo: value(next.logo,previous.logo), landscape: value(next.landscape,previous.landscape),
    poster: value(next.poster,previous.poster) };
}
