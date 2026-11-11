import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "../api";
import type { Card, Detail } from "../types";
import type { PageRequestOwner } from "./owner";

export function createDetailPager(options: {
  owner: PageRequestOwner;
  current: Accessor<Detail | undefined>; adopt: Setter<Detail | undefined>;
  selected: Accessor<Card | undefined>; season: Accessor<number>; episodeCount: Accessor<number>;
  request: RemoteTvApi["detail"];
}) {
  const {owner, current: detail, adopt: setDetail, selected, season: seasonIndex} = options;
  return async () => {
    const generation = owner.generation();
    const current = detail(),
      card = selected();
    if (owner.busy() || !current?.next_cursor || !card) return;
    const count = current.seasons[seasonIndex()]?.episode_count;
    if (count != null && options.episodeCount() >= count) return;
    owner.setBusy(true);
    try {
      const next = await options.request(
        card,
        current.next_cursor,
        owner.signal(),
      );
      if (generation !== owner.generation()) return;
      if (next.next_cursor === current.next_cursor)
        throw new Error("The server repeated an episode page.");
      setDetail({
        ...next,
        episodes: [...current.episodes, ...next.episodes],
      });
    } catch (error) {
      if (generation === owner.generation()) {
        owner.cancelFocus();
        owner.fail(error);
      }
    } finally {
      if (generation === owner.generation()) {
        owner.setBusy(false);
        owner.settleFocus();
      }
    }
  };
}
