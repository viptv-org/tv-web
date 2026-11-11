import { batch } from "solid-js";
import { RemoteError } from "../api";
import { channelKey, edgeRequest, joinChannelWindow, samePageRequest, type PageDirection } from "../channelWindow";
import type { ChannelPagingPorts } from "./channel-ports";

export function createChannelPager(options: ChannelPagingPorts) {
  const {owner, request: read, screen} = options;
  const {zone, column, setColumn} = options.focus;
  const {query: search, remember: rememberSearch, signal: searchSignal, paging: setSearchChannelPaging, error: setSearchChannelError, refresh: updateSearch} = options.search;
  const {group: liveGroup, retire: retireLiveGuides, guides: loadVisibleGuides, reload: loadLiveGroup} = options.live;
  const channels = () => options.windows.values(false), searchChannels = () => options.windows.values(true);
  const livePages = () => options.windows.pages(false), searchChannelPages = () => options.windows.pages(true);
  const adoptChannelWindow = options.windows.adopt;
  const {fail} = owner;
  async function moreChannels(direction: PageDirection) {
    const searching = screen() === "search",
      expectedScreen = screen(),
      expectedZone = zone();
    const pages = () => (searching ? searchChannelPages() : livePages());
    const values = () => (searching ? searchChannels() : channels());
    const request = edgeRequest(pages(), direction),
      generation = owner.generation();
    if (owner.busy() || !request) return;
    owner.setBusy(true);
    const signal = searching ? searchSignal() : owner.signal();
    if (searching) setSearchChannelPaging(true);
    else options.retryAction(() => void moreChannels(direction));
    try {
      const value = await read(
        request.cursor,
        searching ? undefined : liveGroup(),
        signal,
        searching ? search() : undefined,
        request,
      );
      if (
        signal.aborted ||
        generation !== owner.generation() ||
        screen() !== expectedScreen ||
        zone() !== expectedZone ||
        options.overlay() ||
        !samePageRequest(request, edgeRequest(pages(), direction))
      )
        return;
      if (value.snapshot_id !== pages()[0]?.snapshot_id) {
        if (searching) updateSearch(search());
        else {
          adoptChannelWindow([]);
          retireLiveGuides();
          await loadLiveGroup(liveGroup()).catch(fail);
        }
        return;
      }
      const focused = values()[column()];
      const next = joinChannelWindow(pages(), value, direction);
      const items = next.flatMap((page) => page.channels);
      const anchor = focused
        ? items.findIndex(
            (channel) => channelKey(channel) === channelKey(focused),
          )
        : -1;
      // The user may have reversed into the page we would evict while the
      // request was in flight. Discard that prefetch instead of moving focus.
      if (anchor < 0) return;
      const advance =
        options.pending.current()?.from === channelKey(focused) &&
        options.pending.current()!.direction === direction;
      const index = Math.max(
        0,
        Math.min(
          items.length - 1,
          anchor + (advance ? (direction === "next" ? 1 : -1) : 0),
        ),
      );
      batch(() => {
        adoptChannelWindow(next, searching);
        // Focus is the channel's position in the accumulated list.
        const globalIndex = channels().findIndex(
          (channel) => channelKey(channel) === channelKey(items[index]),
        );
        setColumn(globalIndex >= 0 ? globalIndex : index);
        if (searching) {
          rememberSearch(index);
          setSearchChannelError("");
        }
      });
      options.pending.set(undefined);
      options.retry(undefined);
      if (!searching) void loadVisibleGuides();
    } catch (error) {
      if (
        generation !== owner.generation() ||
        signal.aborted ||
        screen() !== expectedScreen ||
        zone() !== expectedZone ||
        options.overlay()
      )
        return;
      const focused = values()[column()];
      const currentPages = pages();
      const evicted =
        currentPages.length > 1
          ? currentPages[direction === "next" ? 0 : currentPages.length - 1]
          : undefined;
      if (
        !(error instanceof RemoteError && error.status === 401) &&
        (!samePageRequest(request, edgeRequest(pages(), direction)) ||
          (focused &&
            evicted?.channels.some(
              (channel) => channelKey(channel) === channelKey(focused),
            )))
      )
        return;
      options.pending.set(undefined);
      options.retry(direction);
      if (error instanceof RemoteError && error.status === 401) fail(error);
      else if (searching)
        setSearchChannelError(
          error instanceof Error
            ? error.message
            : "Channels are unavailable. Try again.",
        );
      else fail(error);
    } finally {
      if (generation === owner.generation()) {
        owner.setBusy(false);
        if (searching) setSearchChannelPaging(false);
        const waiting = options.pending.current();
        const focused = values()[column()];
        if (
          waiting &&
          focused &&
          waiting.from === channelKey(focused) &&
          screen() === expectedScreen &&
          zone() === expectedZone &&
          !options.overlay()
        )
          void moreChannels(waiting.direction);
      }
    }
  }
  return moreChannels;
}
