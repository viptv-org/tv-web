import type { Accessor, Setter } from "solid-js";
import type { Page } from "../types";
import type { PageRequestOwner } from "./owner";

export function createCatalogPager(options: {
  owner: PageRequestOwner;
  current: Accessor<Page>; adopt: Setter<Page>; library: Accessor<boolean>;
  discover: (cursor: string, signal: AbortSignal) => Promise<Page>;
  readLibrary: (cursor: string, signal: AbortSignal) => Promise<Page>;
}) {
  const {owner, current: page, adopt: setPage} = options;
  return async () => {
    const generation = owner.generation();
    if (owner.busy() || !page().next_cursor) return;
    owner.setBusy(true);
    const cursor = page().next_cursor!,
      signal = owner.signal();
    try {
      let result: Page;
      if (options.library()) result = await options.readLibrary(cursor, signal);
      else result = await options.discover(cursor, signal);
      if (generation !== owner.generation()) return;
      if (result.next_cursor === cursor)
        throw new Error("The server repeated a page.");
      setPage((old) => ({
        ...result,
        cards: [...old.cards, ...result.cards],
      }));
    } catch (e) {
      if (generation === owner.generation()) {
        owner.cancelFocus();
        owner.fail(e);
      }
    } finally {
      if (generation === owner.generation()) {
        owner.setBusy(false);
        owner.settleFocus();
      }
    }
  };
}
