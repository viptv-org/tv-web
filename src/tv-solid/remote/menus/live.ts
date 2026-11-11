import { segment } from "../api";
import type { Channel } from "../types";
import type { DialogActions, ScopedRequest } from "../feature-ports";
import type { PlayIntent } from "../source-picker/intent-types";

export function createLiveMenu(options: {
  request: ScopedRequest; path: (path: string) => string; favorites: (value: Set<string>) => void;
  dialogs: Pick<DialogActions, "open" | "close">; play: PlayIntent; fail: (error: unknown) => void;
}) {
  const {request: call, favorites: setLiveFavorites, play: playIntent, fail} = options;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
  return (channel: Channel) => {
    void call<{ channel_ids: string[] }>(options.path("/live/favorites"))
      .then((value) => {
        const saved = value.channel_ids.includes(channel.id);
        setLiveFavorites(new Set(value.channel_ids));
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
                const receipt = await call<{ channel_ids: string[] }>(
                  options.path(`/live/${segment(channel.id)}/favorite`),
                  saved ? "DELETE" : "PUT",
                  {},
                );
                setLiveFavorites(new Set(receipt.channel_ids));
                closeOverlay();
              },
            },
          ],
        });
      })
      .catch(fail);
  };
}
