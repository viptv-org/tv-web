import { batch, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { cardKey, type Card, type Detail, type TitleAction } from "./types";
import { initialSeasonIndex, seasonEpisodes } from "./seasons";
import { presentationCard } from "./presentation-card";
import type { NavigationFocus } from "./navigation/focus";

export function createDetailRefresh(options: {
  api: Pick<RemoteTvApi, "detail" | "titleAction">;
  detail: {current: Accessor<Detail | undefined>; set: Setter<Detail | undefined>; action: Setter<TitleAction | undefined>};
  selected: Accessor<Card | undefined>; focused: Accessor<Card | undefined>; season: {current: Accessor<number>; set: Setter<number>};
  generation: Accessor<number>; current: (signal: AbortSignal, profile: string, generation: number, card: Card) => boolean;
  focus: Pick<NavigationFocus, "zone" | "column" | "setColumn">; resolve: (cards: Card[], key: string | undefined, fallback: number) => number;
}) {
  const {current: detail, set: setDetail, action: setDetailAction} = options.detail;
  const {selected, focused: focusedCard, resolve: focusIndex} = options;
  const {current: seasonIndex, set: setSeasonIndex} = options.season;
  const {zone, column, setColumn} = options.focus;
  return async (signal: AbortSignal, profile: string, commit: () => void, authority: () => boolean = () => true) => {
    const previous = detail(), selectedCard = selected()!, generation = options.generation();
    const season = previous?.seasons[seasonIndex()];
    const [value, intent] = await Promise.all([
      options.api.detail(selectedCard, String(season?.offset ?? 0), signal),
      options.api.titleAction(selected()!, false, signal),
    ]);
    if (!authority() || !options.current(signal, profile, generation, selectedCard)) return;
    const key = focusedCard() ? cardKey(focusedCard()!) : undefined;
    const nextSeason = season ? value.seasons.findIndex(item => item.season === season.season) : -1;
    batch(() => {
      setDetail({ ...value, item: presentationCard(previous?.item, value.item) });
      setDetailAction(intent);
      setSeasonIndex(nextSeason >= 0 ? nextSeason : initialSeasonIndex(value, selectedCard, intent));
      if (zone() === "episodes" || zone() === "recommendations")
        setColumn(
          focusIndex(
            zone() === "recommendations" || !(value.seasons.length || value.episodes.length)
              ? value.recommendations
              : seasonEpisodes(value, nextSeason >= 0 ? nextSeason : initialSeasonIndex(value, selectedCard, intent)),
            key,
            column(),
          ),
        );
      else if (zone() === "seasons")
        setColumn(
          Math.min(column(), Math.max(0, value.seasons.length - 1)),
        );
    });
    commit();
  };
}
