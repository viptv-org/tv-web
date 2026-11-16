import type { Accessor } from "solid-js";
import type { RemoteTvApi } from "./api";
import { lookupSelector, query, segment } from "./api";
import type { Card } from "./types";

/** My List: whether a card is saved, and the one write that changes it.
 *
 * The optimistic map is keyed by `cardKey` and layered over the card's own
 * `view.saved`, so a list that was drawn before the toggle still reports the new
 * value. One function writes it, which is why add and remove cannot disagree
 * about which key they touched.
 */
export function createSavedList(options: {
  api: RemoteTvApi;
  saved: Accessor<Map<string, boolean>>;
  setSaved: (value: (previous: Map<string, boolean>) => Map<string, boolean>) => void;
  call: <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
  notify: (message: string) => void;
  run: (work: () => Promise<void>) => Promise<void>;
  cardKey: (card: Card) => string;
}) {
  const isSaved = (card: Card) =>
    options.saved().get(options.cardKey(card)) ?? card.view?.saved ?? false;

  async function toggleSaved(card: Card): Promise<void> {
    await options.run(async () => {
      const key = options.cardKey(card);
      const receipt = isSaved(card)
        ? await options.call<{ saved: boolean }>(
            options.api.scoped(
              `/library/${segment(card.identity.kind)}/${segment(card.identity.id)}?${
                query(card.metadata_origin ? { metadata_origin: card.metadata_origin, card: lookupSelector(card) } : {})
              }`,
            ),
            "DELETE",
          )
        : await options.call<{ saved: boolean }>(options.api.scoped("/library"), "PUT", { card });
      options.setSaved(old => new Map(old).set(key, receipt.saved));
      options.notify(receipt.saved ? "Added to My List" : "Removed from My List");
    });
  }

  return { isSaved, toggleSaved };
}
