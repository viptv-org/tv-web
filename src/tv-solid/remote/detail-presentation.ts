import { createMemo, type Accessor } from "solid-js";
import { episodeActionLabel, seasonEpisodes } from "./seasons";
import { hasSavedPosition, savedPositionLabel } from "./resume-position";
import type { Card, Detail, Home, TitleAction } from "./types";

export function createDetailPresentation(options: {
  home: Accessor<Home | undefined>; detail: Accessor<Detail | undefined>;
  action: Accessor<TitleAction | undefined>; selected: Accessor<Card | undefined>; season: Accessor<number>;
}) {
  const continuingCard = (item: Card) => {
    const row = options.home()?.rows?.find((value) => value.id === "continue");
    return (row?.cards ?? []).find((card) => {
      if (!hasSavedPosition(card)) return false;
      if (item.identity.kind === "movie")
        return (
          card.identity.kind === "movie" &&
          card.identity.id === item.identity.id &&
          card.identity.episode == null
        );
      if (item.identity.kind === "series" && item.identity.episode == null)
        return (
          card.identity.kind === "series" &&
          card.parent_identity?.id === item.identity.id &&
          (card.identity.episode?.episode ?? 0) > 0
        );
      return false;
    });
  };
  const detailHasEpisodes = () => !!(options.detail()?.seasons.length || options.detail()?.episodes.length);
  const detailEpisodes = createMemo(() => seasonEpisodes(options.detail(), options.season()));
  const detailCursor = () => {
    const value = options.detail(), count = value?.seasons[options.season()]?.episode_count;
    return count != null && detailEpisodes().length >= count ? null : value?.next_cursor;
  };
  const detailTarget = createMemo(() => {
    const value = options.detail();
    if (!value) return undefined;
    const action = options.action();
    const regular = (card: Card | undefined) =>
      card?.identity.episode != null &&
      (card.identity.episode.season ?? 1) > 0;
    let card: Card | undefined = action && action.card.identity.kind !== "series"
      ? action.card
      : action?.card.identity.episode && (action.resume || options.selected()?.identity.episode)
      ? action.card
      : regular(action?.card)
        ? action!.card
      : regular(value.item)
        ? value.item
        : [...value.episodes]
            .filter((episode) => regular(episode))
            .sort((left, right) => {
              const season =
                (left.identity.episode?.season ?? 1) -
                (right.identity.episode?.season ?? 1);
              return season
                ? season
                : (left.identity.episode?.episode ?? 0) -
                    (right.identity.episode?.episode ?? 0);
            })[0];
    if (!card && value.item.identity.kind !== "series") card = value.item;
    if (!card && action?.card.identity.episode && !value.seasons.some(season => season.season > 0)) card = action.card;
    if (!card) return undefined;
    const resume = !!action?.resume && action.card === card;
    const label = action?.card === card ? action.label : episodeActionLabel(card, "Play");
    if (!action && !options.selected()?.identity.episode && !value.item.identity.episode) {
      const continuing = continuingCard(value.item);
      if (continuing) {
        const progress = continuing.progress ?? 0;
        return {
          card: continuing,
          label: savedPositionLabel(continuing),
          progress,
        };
      }
    }
    return {
      card,
      label,
      progress: resume ? (action?.progress ?? 0) : 0,
    };
  });
  const detailActionLabel = () =>
    detailTarget()?.label ?? options.action()?.label ?? "Play";
  const detailPlayProgress = () =>
    detailTarget()?.progress ??
    (options.action()?.resume ? (options.action()?.progress ?? 0) : 0);
  return {hasEpisodes: detailHasEpisodes, episodes: detailEpisodes, cursor: detailCursor,
    target: detailTarget, label: detailActionLabel, progress: detailPlayProgress};
}
