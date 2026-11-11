import type { Accessor, Setter } from "solid-js";
import { channelKey, edgeRequest, type PageDirection } from "../channelWindow";
import type { Guide, Program } from "../types";
import type { ChannelPagingPorts } from "./channel-ports";

export function createChannelMovement(options: ChannelPagingPorts & {
  programs: Accessor<Record<string, Program[]>>; guides: Accessor<Record<string, Guide["view"]>>;
  selectProgram: Setter<number>; more: (direction: PageDirection) => Promise<void>;
}) {
  const moreChannels = options.more;
  const {column, setZone, setColumn} = options.focus;
  const rememberSearch = options.search.remember;
  const loadVisibleGuides = options.live.guides;
  const channels = () => options.windows.values(false), searchChannels = () => options.windows.values(true);
  const livePages = () => options.windows.pages(false), searchChannelPages = () => options.windows.pages(true);
  function moveChannel(step: number, searching: boolean) {
    const pages = searching ? searchChannelPages() : livePages();
    const values = searching ? searchChannels() : channels();
    const direction: PageDirection = step < 0 ? "previous" : "next";
    const next = column() + step;
    if (next < 0 && !edgeRequest(pages, "previous")) {
      setZone(searching ? "keyboard" : "live-groups");
      setColumn(0);
      return;
    }
    if (next >= 0 && next < values.length) setColumn(next);
    else if (edgeRequest(pages, direction) && values[column()])
      options.pending.set({ from: channelKey(values[column()]), direction });
    if (searching) rememberSearch(column());
    else {
      const id = channels()[column()]?.id;
      options.selectProgram(
        Math.max(
          0,
          (options.programs()[id] ?? []).findIndex(
            (p) => p.id === options.guides()[id]?.current_program_id,
          ),
        ),
      );
      void loadVisibleGuides();
    }
    // Only actual directional movement prefetches. Applying a short reverse
    // page never initiates a compensating forward request by itself.
    // The trigger is the focused channel's position within the bounded render
    // window, not the global accumulated index: the window is what a page
    // fetch slides.
    const windowChannels = pages.flatMap((page) => page.channels);
    const focusedChannel = values[column()];
    const windowIndex = focusedChannel
      ? windowChannels.findIndex(
          (channel) => channelKey(channel) === channelKey(focusedChannel),
        )
      : -1;
    if (
      (step < 0 && windowIndex >= 0 && windowIndex < 6) ||
      (step > 0 && windowIndex >= 0 && windowIndex >= windowChannels.length - 6)
    )
      void moreChannels(direction);
  }
  return moveChannel;
}
