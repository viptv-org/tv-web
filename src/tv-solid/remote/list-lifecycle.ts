import { batch, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import type { Card, Home, Page, LibraryPage } from "./types";
import type { Overlay } from "./app-types";

/** Keeping a list's identity while its contents are replaced.
 *
 * A refresh is not a navigation: the viewer stays on the card they were on, even
 * if its index moved. `replacePage` and `replaceHome` therefore re-find the
 * focused card *by key* and move the position to match, and they leave the focus
 * alone when the replacing list is not the one on screen. That is the whole
 * reason this is one module: the two functions must agree about what "same card"
 * means or a refresh silently jumps the shelf.
 */
export function createListLifecycle(options: {
  api: RemoteTvApi;
  screen: Accessor<string>;
  zone: Accessor<string>;
  column: Accessor<number>;
  row: Accessor<number>;
  setColumn: Setter<number>;
  setRow: Setter<number>;
  page: Accessor<Page>;
  setPage: Setter<Page>;
  home: Accessor<Home | undefined>;
  setHome: Setter<Home | undefined>;
  library: Accessor<LibraryPage | undefined>;
  setLibrary: Setter<LibraryPage | undefined>;
  overlay: Accessor<Overlay | undefined>;
  setChoice: Setter<number>;
  cardKey: (card: Card) => string;
  rememberContentFocus: () => void;
  rememberHomeRow: () => void;
  contentRow: () => { id: string; cards: readonly Card[] };
  contentFocus: { resolve: (row: never) => number; remember: (row: never, index: number) => void };
  previewCard: Accessor<Card | undefined>;
  setPreviewCard: (value: Card | undefined) => void;
  presentationKey: (card: Card) => string;
  clampCycle: () => void;
  scopeSignal: () => AbortSignal;
  restartPaging: () => AbortSignal;
}) {
  /** Where a card lives in a new list: by key, else the nearest valid index. */
  function focusIndex(cards: readonly Card[], key: string | undefined, fallback: number): number {
    const index = key === undefined ? -1 : cards.findIndex(card => options.cardKey(card) === key);
    return index >= 0 ? index : Math.max(0, Math.min(fallback, cards.length - 1));
  }

  function replacePage(value: Page): void {
    options.rememberContentFocus();
    const previousColumn = options.screen() === "search" ? options.column() : options.contentFocus.resolve(options.contentRow() as never);
    const focused = options.page().cards[previousColumn];
    const index = focusIndex(value.cards, focused ? options.cardKey(focused) : undefined, previousColumn);
    batch(() => {
      options.setPage(value);
      options.contentFocus.remember(options.contentRow() as never, index);
      if (options.zone() === "content") options.setColumn(index);
    });
    const modal = options.overlay();
    if (modal?.kind === "tracks")
      options.setChoice(Math.max(0, modal.columns[0]?.items.findIndex(item => item.value === "✓") ?? 0));
  }

  async function loadLibrary(
    cursor = "0",
    signal = options.scopeSignal(),
    values: Record<string, unknown> = options.library()?.query ?? {},
  ): Promise<LibraryPage> {
    const value = await options.api.library(cursor, signal, values as never);
    options.setLibrary(value);
    return value;
  }

  function replaceHome(value: Home | undefined): void {
    options.rememberHomeRow();
    const shelf = options.home()?.rows[options.row()];
    const focused = shelf?.cards[options.column()];
    const nextRow = Math.max(0, value?.rows.findIndex(row => row.id === shelf?.id) ?? 0);
    const nextColumn = focusIndex(
      value?.rows[nextRow]?.cards ?? [],
      focused ? options.cardKey(focused) : undefined,
      options.column(),
    );
    batch(() => {
      options.setHome(value);
      const nextFocused = value?.rows[nextRow]?.cards[nextColumn];
      // The preview belongs to the card under the focus: a different card means
      // the old preview is stale, the same card keeps it.
      if (options.zone() !== "rows" || !nextFocused || !options.previewCard() ||
        options.presentationKey(options.previewCard()!) !== options.presentationKey(nextFocused))
        options.setPreviewCard(undefined);
      options.clampCycle();
      if (options.screen() === "home" && options.zone() === "rows") {
        options.setRow(nextRow);
        options.setColumn(nextColumn);
      }
    });
    const modal = options.overlay();
    if (modal?.kind === "tracks")
      options.setChoice(Math.max(0, modal.columns[0]?.items.findIndex(item => item.value === "✓") ?? 0));
  }

  return { focusIndex, replacePage, loadLibrary, replaceHome };
}
