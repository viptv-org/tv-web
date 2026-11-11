import type { Card } from "../types";
import type { DialogActions } from "../feature-ports";
import type { PlayIntent } from "../source-picker/intent-types";

export function createCardMenu(options: {
  dialogs: Pick<DialogActions, "open" | "close">; details: (card: Card) => Promise<void>;
  play: PlayIntent; saved: (card: Card) => boolean; toggleSaved: (card: Card) => Promise<void>;
}) {
  const {details: openDetail, play: playIntent, saved: isSaved, toggleSaved} = options;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
  return (card: Card) => {
    openOverlay({
      kind: "choices",
      title: card.title,
      items: [
        {
          id: "detail",
          label: "More information",
          run: async () => {
            closeOverlay();
            await openDetail(card);
          },
        },
        {
          id: "sources",
          label: "Choose a source",
          run: () => playIntent(card, true),
        },
        {
          id: "restart",
          label: "Play from start",
          run: () => playIntent(card, false, true),
        },
        {
          id: "save",
          label: isSaved(card) ? "Remove from My List" : "Add to My List",
          run: () => toggleSaved(card),
        },
      ],
    });
  };
}
