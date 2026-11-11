import { batch, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "../api";
import type { Detail } from "../types";
import type { Overlay } from "../app-types";
import { seasonLabel } from "../seasons";
import type { NavigationFocus } from "../navigation/focus";

export function createSeasonPicker(options: {
  current: Accessor<Detail | undefined>; adopt: Setter<Detail | undefined>; season: {current: Accessor<number>; set: Setter<number>};
  focus: NavigationFocus; choice: Setter<number>; loading: Setter<boolean>; rememberedEpisode: () => number; restart: () => AbortSignal;
  request: RemoteTvApi["detail"]; open: (overlay: Overlay) => void; close: (restore?: boolean) => void;
}) {
  const {current: detail, adopt: setDetail, choice: setChoice, loading: setLoading, restart: restartPaging, open: openOverlay, close: closeOverlay} = options;
  const {current: seasonIndex, set: setSeasonIndex} = options.season;
  const {setColumn, setZone} = options.focus;
  return () => {
    const value = detail();
    if (!value?.seasons.length) return;
    openOverlay({ kind: "choices", title: "Seasons", items: value.seasons.map((season, index) => ({
      id: String(season.season), label: seasonLabel(season.season),
      value: `${season.episode_count} episode${season.episode_count === 1 ? "" : "s"}`,
      run: async () => {
        closeOverlay(false);
        if (index === seasonIndex()) { setColumn(options.rememberedEpisode());setZone("episodes");return; }
        const signal = restartPaging();
        setLoading(true);
        try {
          const next = await options.request(value.item, String(season.offset), signal);
          if (signal.aborted) return;
          batch(() => { setDetail(next);setSeasonIndex(index);setColumn(0);setZone("episodes"); });
        } finally { if (!signal.aborted) setLoading(false); }
      },
    })) });
    setChoice(seasonIndex());
  };
}
