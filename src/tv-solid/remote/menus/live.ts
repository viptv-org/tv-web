import { segment } from "../api";
import type { Channel } from "../types";
import type { DialogActions, ScopedRequest } from "../feature-ports";
import type { PlayIntent } from "../source-picker/intent-types";

export function createLiveMenu(options: {
  request: ScopedRequest; path: (path: string) => string;
  dialogs: Pick<DialogActions, "open" | "close">; play: PlayIntent; fail: (error: unknown) => void;
}) {
  const {request: call, play: playIntent, fail} = options;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
  return (channel: Channel) => {
    void call<{ channel_ids: string[] }>(options.path("/live/favorites"))
      .then((value) => {
        const saved = value.channel_ids.includes(channel.id);
        openOverlay({
          kind: "choices",
          title: channel.card.title,
          items: [
            {
              id: "play",
              label: "Watch live",
              run: () => playIntent(channel.card, false, false, channel.id),
            },
            {
              id: "favorite",
              label: saved ? "Remove from favourites" : "Add to favourites",
              run: async () => {
                await call<{ channel_ids: string[] }>(
                  options.path(`/live/${segment(channel.id)}/favorite`),
                  saved ? "DELETE" : "PUT",
                  {},
                );
                closeOverlay();
              },
            },
          ],
        });
      })
      .catch(fail);
  };
}
