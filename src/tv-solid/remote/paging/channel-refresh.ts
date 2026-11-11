import { channelKey, pageRequest, samePageRequest } from "../channelWindow";
import type { LivePage } from "../types";
import type { ChannelPagingPorts } from "./channel-ports";

export function createChannelRefresh(options: ChannelPagingPorts) {
  const {owner, request: read} = options;
  const {zone, column} = options.focus;
  const {query: search, remembered: rememberedSearch} = options.search;
  const {group: liveGroup, index: liveChannelIndex, retire: retireLiveGuides} = options.live;
  const channels = () => options.windows.values(false), searchChannels = () => options.windows.values(true);
  const livePages = () => options.windows.pages(false), searchChannelPages = () => options.windows.pages(true);
  const adoptChannelWindow = options.windows.adopt;
  async function refreshChannelPage(
    searching: boolean,
    signal: AbortSignal,
  ): Promise<LivePage> {
    const generation = owner.generation();
    const pages = () => (searching ? searchChannelPages() : livePages());
    const focused = () =>
      searching
        ? searchChannels()[
            zone() === "search-channels" ? column() : rememberedSearch()
          ]
        : channels()[liveChannelIndex()];
    const focusedPage = () => {
      const card = focused();
      return card
        ? pages().find((page) =>
            page.channels.some(
              (channel) => channelKey(channel) === channelKey(card),
            ),
          )
        : undefined;
    };
    for (;;) {
      const target = focusedPage() ?? pages()[0];
      const request = target
        ? pageRequest(target)
        : { cursor: "0", limit: 40, page_size: 40 };
      const snapshot = pages()[0]?.snapshot_id;
      const value = await read(
        request.cursor,
        searching ? undefined : liveGroup(),
        signal,
        searching ? search() : undefined,
        target ? request : undefined,
      );
      if (generation !== owner.generation() || signal.aborted)
        throw new DOMException("Retired channel refresh", "AbortError");
      if (snapshot && value.snapshot_id !== snapshot) {
        adoptChannelWindow([], searching);
        if (!searching) retireLiveGuides();
        const first =
          request.cursor === "0"
            ? value
            : await read(
                "0",
                searching ? undefined : liveGroup(),
                signal,
                searching ? search() : undefined,
              );
        if (generation !== owner.generation() || signal.aborted)
          throw new DOMException("Retired channel refresh", "AbortError");
        return first;
      }
      const latest = focusedPage();
      // Focus remains interactive during refresh. If it crossed a retained
      // page, fetch that page instead of replacing its current focus with 0.
      if (latest && !samePageRequest(request, pageRequest(latest))) continue;
      return value;
    }
  }
  return refreshChannelPage;
}
