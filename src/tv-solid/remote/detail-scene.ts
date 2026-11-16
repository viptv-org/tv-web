import { createEffect, createSignal, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { createDetailPresentation } from "./detail-presentation";
import { createDetailRefresh } from "./detail-refresh";
import { RowFocus } from "./row-focus";
import { presentationKey } from "./presentation-card";
import { cardKey, type Card, type Detail, type Home, type TitleAction } from "./types";

/** One title's page: the item, the season being looked at, the action the remote
 * is on, and the two lists under it.
 *
 * The two lists are one focus machine. Each keeps its own remembered column
 * keyed by the title and the season, so walking from episodes to recommendations
 * and back lands where the viewer left, and a *different* title starts at the
 * first card instead of inheriting a stranger's position.
 */
export function createDetailScene(options: {
  api: RemoteTvApi;
  home: Accessor<Home | undefined>;
  selected: Accessor<Card | undefined>;
  screen: Accessor<string>;
  zone: Accessor<string>;
  column: Accessor<number>;
  setColumn: Setter<number>;
  overlayVisible: Accessor<boolean>;
  pending: Accessor<boolean>;
  signal: Accessor<AbortSignal>;
  profile: Accessor<string>;
  pageGeneration: Accessor<number>;
  focusedCard: Accessor<Card | undefined>;
  resolveFocus: (cards: readonly Card[], key: string | undefined, fallback: number) => number;
}) {
  const [detail, setDetail] = createSignal<Detail>();
  const [detailAction, setDetailAction] = createSignal<TitleAction>();
  const [seasonIndex, setSeasonIndex] = createSignal(0);
  const presentation = createDetailPresentation({
    home: options.home, detail, action: detailAction, selected: options.selected, season: seasonIndex,
  });
  const focus = new RowFocus<Card>(cardKey);
  const row = (kind: "episodes" | "recommendations") => {
    const value = detail();
    return {
      id: JSON.stringify([value && presentationKey(value.item), kind, kind === "episodes" ? seasonIndex() : undefined]),
      cards: kind === "episodes" && presentation.hasEpisodes() ? presentation.episodes() : value?.recommendations ?? [],
    };
  };
  const column = (kind: "episodes" | "recommendations") =>
    (options.zone() === kind ? options.column() : focus.resolve(row(kind)));
  const rememberFocus = () => {
    const region = options.zone();
    if (options.screen() === "detail" && (region === "episodes" || region === "recommendations"))
      focus.remember(row(region), options.column());
  };
  createEffect(() => focus.retain([row("episodes"), row("recommendations")]));
  const refresh = createDetailRefresh({
    api: options.api,
    detail: { current: detail, set: setDetail, action: setDetailAction },
    selected: options.selected, focused: options.focusedCard,
    season: { current: seasonIndex, set: setSeasonIndex }, generation: options.pageGeneration,
    current: (signal, profile, generation, card) =>
      !options.overlayVisible() && !options.pending() && !signal.aborted && options.signal() === signal &&
      options.screen() === "detail" && options.pageGeneration() === generation &&
      options.profile() === profile && !!options.selected() && cardKey(options.selected()!) === cardKey(card),
    focus: { zone: options.zone, column: options.column, setColumn: options.setColumn },
    resolve: options.resolveFocus,
  });
  /** A new profile: no title, no season, no remembered lists. */
  function reset() {
    setDetail(undefined); setDetailAction(undefined); setSeasonIndex(0); focus.clear();
  }
  return {
    reset,
    detail, setDetail, detailAction, setDetailAction, seasonIndex, setSeasonIndex, presentation,
    row, column, rememberFocus, refresh, focus,
  };
}
