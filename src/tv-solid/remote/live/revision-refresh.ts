import { batch, type Accessor } from "solid-js";
import type { Channel, LivePage } from "../types";
import type { NavigationFocus } from "../navigation/focus";

export function createLiveRefresh(options: {
  channels: Accessor<Channel[]>; index: Accessor<number>; read: (signal: AbortSignal) => Promise<LivePage>;
  snapshot: (id: string) => void; window: (pages: LivePage[]) => void; groups: (value: LivePage["groups"]) => void;
  failure: (value: string) => void; focus: NavigationFocus; clearGuides: () => void; loadGuides: () => Promise<void>;
}) {
  const {channels, index: liveChannelIndex, snapshot: adoptLiveSnapshot, window: adoptChannelWindow, groups: setGroups, failure: setLiveFailure} = options;
  const {zone, column, setZone, setColumn} = options.focus;
  return async (signal: AbortSignal, commit: () => void) => {
    const value = await options.read(signal);
    const focused = channels()[liveChannelIndex()]?.id;
    // A page that had nothing to show and now has rows lands the remote
    // on the first row instead of leaving focus on the navigation
    // (LIVE-EMPTY-13).
    const arrived = !channels().length && !!value.channels.length;
    batch(() => {
      adoptLiveSnapshot(value.snapshot_id);
      adoptChannelWindow([value]);
      setGroups(value.groups);
      setLiveFailure("");
      if (zone() === "live-groups")
        setColumn(Math.min(column(), value.groups.length));
      else if (zone() === "content")
        // Focus is the channel's index in the accumulated list, which
        // the refresh merges into — not its slot within the refreshed
        // page alone.
        setColumn(
          Math.max(
            0,
            channels().findIndex(
              (channel) => channel.id === focused,
            ),
          ),
        );
      else if (
        arrived &&
        (zone() === "live-empty" || zone() === "nav")
      ) {
        setZone("content");
        setColumn(0);
      }
      options.clearGuides();
    });
    void options.loadGuides();
    commit();
  };
}
