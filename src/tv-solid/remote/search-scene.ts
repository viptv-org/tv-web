import { batch, createMemo, createSignal, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { createSearchController, type SearchRequests } from "./search/controller";
import { RowFocus } from "./row-focus";
import { searchRowFocus } from "./search/media";
import { cardKey, type Card, type Channel, type LivePage, type Page, type SearchPage } from "./types";
import type { Screen } from "./app-types";

/** Search: one query, its media rows, its channel column and the paging state
 * they share.
 *
 * The two result surfaces keep separate remembered positions — a channel row and
 * a media row are different lists — but they publish into the same page, so the
 * grid and the channel list never disagree about which cards are on screen.
 */
export function createSearchScene(options: {
  api: RemoteTvApi;
  parent: () => AbortController;
  screen: Accessor<Screen>;
  zone: Accessor<string>;
  column: Accessor<number>;
  setZone: Setter<string>;
  setColumn: Setter<number>;
  capabilities: Accessor<{ media: boolean; channels: boolean }>;
  page: Accessor<Page>;
  setPage: Setter<Page>;
  setError: Setter<string>;
  restartPaging: () => AbortSignal;
  setLoading: Setter<boolean>;
  retry: (work: () => void) => void;
  fail: (error: unknown) => void;
  /** The focused media row's remembered column, owned by the navigation layer. */
  mediaFocus: { current: () => number; set: (value: number) => void };
  /** The channel column's remembered position, owned by the navigation layer. */
  channelFocus: { current: () => number; set: (value: number) => void };
  /** Re-request the open channel window. */
  refreshChannelPage: (searching: boolean, signal?: AbortSignal) => Promise<LivePage>;
  adoptChannelWindow: (pages: LivePage[], searching?: boolean) => void;
}) {
  const requests: SearchRequests = {};
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchPage>({ rows: [], complete: true });
  const [rowIndex, setRowIndex] = createSignal(0);
  const [error, setError] = createSignal("");
  const [channelError, setChannelError] = createSignal("");
  const [mediaPending, setMediaPending] = createSignal(false);
  const [channelsPending, setChannelsPending] = createSignal(false);
  const [channelPaging, setChannelPaging] = createSignal(false);
  const [channels, setChannels] = createSignal<Channel[]>([]);
  const [channelPages, setChannelPages] = createSignal<LivePage[]>([]);
  const positions = new RowFocus<Card>(cardKey);

  const activeRow = createMemo(() => results().rows[rowIndex()]);
  /** A search that has an answer but nothing usable in it offers a retry. */
  const needsRetry = () =>
    options.capabilities().media && !!query() && !mediaPending() &&
    (!!error() || activeRow()?.state === "Failed" || !!activeRow()?.message);

  function rememberRow(index: number) {
    options.mediaFocus.set(index);
    const shelf = activeRow();
    if (shelf) positions.remember(shelf, index);
  }
  function clearRows() {
    setResults({ rows: [], complete: true });
    setRowIndex(0);
    positions.clear();
  }
  function replaceRows(value: SearchPage) {
    const previous = activeRow();
    const focused = options.zone() === "content" ? options.column() : options.mediaFocus.current();
    const next = searchRowFocus(value.rows, previous, focused);
    batch(() => {
      positions.retain(value.rows);
      setResults(value);
      setRowIndex(next.row);
      rememberRow(next.column);
      options.setPage({
        cards: value.rows[next.row]?.cards ?? [], complete: value.complete,
        next_cursor: value.rows[next.row]?.next_cursor,
      });
      if (options.zone() === "content") options.setColumn(next.column);
    });
  }
  /** Move between the per-provider result rows. */
  function moveRow(step: number): boolean {
    const next = rowIndex() + step;
    if (next < 0 || next >= results().rows.length) return false;
    rememberRow(options.zone() === "content" ? options.column() : options.mediaFocus.current());
    const shelf = results().rows[next];
    const index = Math.max(0, Math.min(positions.resolve(shelf), shelf.cards.length - 1));
    batch(() => {
      setRowIndex(next);
      options.setPage({ cards: shelf.cards, complete: results().complete, next_cursor: shelf.next_cursor });
      rememberRow(index);
      options.setColumn(index);
      options.setZone(!shelf.cards.length && (shelf.message || shelf.state === "Failed") ? "search-retry" : "content");
    });
    return true;
  }

  const controller = createSearchController({
    requests, parent: options.parent, screen: options.screen,
    focus: { zone: options.zone, column: options.column, setZone: options.setZone, setColumn: options.setColumn },
    query: { current: query, set: setQuery }, capabilities: options.capabilities,
    media: {
      page: options.page, set: options.setPage, error: setError,
      pending: { current: mediaPending, set: setMediaPending },
      remember: index => options.mediaFocus.set(index),
    },
    channels: {
      current: channels, set: setChannels, pages: setChannelPages, error: setChannelError, paging: setChannelPaging,
      pending: { current: channelsPending, set: setChannelsPending },
      remembered: () => options.channelFocus.current(),
      remember: index => options.channelFocus.set(index),
      read: signal => options.refreshChannelPage(true, signal),
      adopt: (page: LivePage) => options.adoptChannelWindow([page], true),
    },
    search: (value, signal) => options.api.search(value, signal),
    rows: { clear: clearRows, replace: replaceRows }, restart: options.restartPaging,
    loading: options.setLoading, error: options.setError, retry: options.retry, fail: options.fail,
  });
  /** A new profile: the query, its rows and its channel column are gone. */
  function reset() {
    requests.scope?.abort();
    clearTimeout(requests.timer);
    setQuery(""); clearRows(); setError(""); setChannelError(""); setMediaPending(false);
    setChannelsPending(false); setChannelPaging(false); setChannels([]); setChannelPages([]);
  }
  return {
    reset,
    query, setQuery, results, setResults, rowIndex, setRowIndex, error, setError, channelError, setChannelError,
    mediaPending, setMediaPending, channelsPending, setChannelsPending, channelPaging, setChannelPaging,
    channels, setChannels, channelPages, setChannelPages,
    activeRow, needsRetry, rememberRow, clearRows, replaceRows, moveRow, positions,
    signal: controller.signal, update: controller.update, requests,
  };
}
