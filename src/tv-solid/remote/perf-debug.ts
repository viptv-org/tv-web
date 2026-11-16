import { onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { Home, Page } from "./types";

/** The `?perfdebug` counter the perf specs read.
 *
 * It publishes counts, never behaviour: guide snapshots retained, requests in
 * flight, cards held by each list. The payload counts deliberately measure the
 * retained render window, not the accumulated focus list, because the focus list
 * legitimately spans every traversed channel and would otherwise look like a leak.
 */
export function installPerfDebug(options: {
  programs: Accessor<Record<string, unknown[]>>;
  guideRequestsInFlight: () => number;
  page: Accessor<Page>;
  livePages: Accessor<readonly { channels: unknown[] }[]>;
  searchChannelPages: Accessor<readonly { channels: unknown[] }[]>;
  home: Accessor<Home | undefined>;
  historyEntries: number;
}) {
  const target = window as Window & { __viptvRemoteMetrics?: () => Record<string, number> };
  target.__viptvRemoteMetrics = () => ({
    guideSnapshots: Object.keys(options.programs()).length,
    guideRequestsInFlight: options.guideRequestsInFlight(),
    catalogCards: options.page().cards.length,
    livePayloadPages: options.livePages().length,
    livePayloadChannels: options.livePages().reduce((sum, page) => sum + page.channels.length, 0),
    searchPayloadPages: options.searchChannelPages().length,
    searchPayloadChannels: options.searchChannelPages().reduce((sum, page) => sum + page.channels.length, 0),
    homeCards: (options.home()?.rows ?? []).reduce((sum, row) => sum + row.cards.length, 0),
    historyEntries: options.historyEntries,
  });
  onCleanup(() => {
    delete target.__viptvRemoteMetrics;
  });
}
