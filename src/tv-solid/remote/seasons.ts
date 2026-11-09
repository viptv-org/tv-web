import type { Card, Detail, TitleAction } from "./types";

export function seasonLabel(season: number | null | undefined): string {
  return season == null ? "Episodes" : season === 0 ? "Specials" : `Season ${season}`;
}

export function episodeActionLabel(card: Card, verb: string): string {
  const episode = card.identity.episode;
  if (!episode) return verb;
  return episode.season === 0 ? `${verb} Special ${episode.episode}` : `${verb} S${episode.season ?? 1} E${episode.episode}`;
}

/** Choose the shelf's initial focus; explicit episodes and resumes retain specials. */
export function initialSeasonIndex(detail: Detail, selected: Card, action: TitleAction): number {
  const target = selected.identity.episode ?? (action.resume ? action.card.identity.episode : undefined);
  const requested = target ? detail.seasons.findIndex(season => season.season === target.season) : -1;
  if (requested >= 0) return requested;
  const regular = detail.seasons.findIndex(season => season.season > 0);
  return Math.max(0, regular);
}

/** API pages may cross a season boundary; only the chosen shelf is rendered. */
export function seasonEpisodes(detail: Detail | undefined, index: number): Card[] {
  if (!detail) return [];
  if (!detail.seasons.length) return detail.episodes;
  const season = detail.seasons[index]?.season;
  return detail.episodes.filter(card => (card.identity.episode?.season ?? null) === (season ?? null));
}
