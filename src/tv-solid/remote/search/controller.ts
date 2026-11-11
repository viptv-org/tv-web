import { batch, type Accessor, type Setter } from "solid-js";
import { RemoteError, type RemoteTvApi } from "../api";
import type { Screen } from "../app-types";
import type { Channel, LivePage, Page } from "../types";
import type { NavigationFocus } from "../navigation/focus";
import { searchStremio } from "./media";

export interface SearchRequests {scope?: AbortController; timer?: ReturnType<typeof setTimeout>}
interface PendingSearch {current: Accessor<boolean>; set: Setter<boolean>}
export function createSearchController(options: {
  requests: SearchRequests; parent: Accessor<AbortController>; screen: Accessor<Screen>; focus: NavigationFocus;
  query: {current: Accessor<string>; set: Setter<string>}; capabilities: Accessor<{media: boolean; channels: boolean}>;
  media: {page: Accessor<Page>; set: Setter<Page>; replace: (page: Page) => void; error: Setter<string>; pending: PendingSearch; remember: (index: number) => void};
  channels: {current: Accessor<Channel[]>; set: Setter<Channel[]>; pages: Setter<LivePage[]>; error: Setter<string>; pending: PendingSearch; paging: Setter<boolean>;
    remembered: Accessor<number>; remember: (index: number) => void; read: (signal: AbortSignal) => Promise<LivePage>; adopt: (page: LivePage) => void};
  discover: RemoteTvApi["discover"]; restart: () => AbortSignal; loading: Setter<boolean>; error: Setter<string>;
  retry: (work: () => void) => void; fail: (error: unknown) => void;
}) {
  const {requests, restart: restartPaging, loading: setLoading, error: setError, fail} = options;
  const {current: search, set: setSearch} = options.query;
  const {zone, column, setZone, setColumn} = options.focus;
  const {page, set: setPage, replace: replacePage, error: setSearchError} = options.media;
  const {current: searchMediaPending, set: setSearchMediaPending} = options.media.pending;
  const {current: searchChannels, set: setSearchChannels, pages: setSearchChannelPages, error: setSearchChannelError, paging: setSearchChannelPaging} = options.channels;
  const {current: searchChannelsPending, set: setSearchChannelsPending} = options.channels.pending;
  const refreshChannelPage = (_searching: boolean, signal: AbortSignal) => options.channels.read(signal);
  const adoptChannelWindow = (pages: LivePage[], _searching: boolean) => options.channels.adopt(pages[0]);
  function searchSignal() {
    if (!requests.scope || requests.scope.signal.aborted) {
      const owner = options.parent(),
        request = new AbortController();
      const cancel = () => request.abort();
      owner.signal.addEventListener("abort", cancel, { once: true });
      request.signal.addEventListener(
        "abort",
        () => owner.signal.removeEventListener("abort", cancel),
        { once: true },
      );
      if (owner.signal.aborted) request.abort();
      requests.scope = request;
    }
    return requests.scope.signal;
  }
  /** Media search through Stremio only. The server's `all` search fans out
   * to Simkl, whose rejected request used to hide every Stremio result. */
  function updateSearch(value: string, retain = false) {
    value = Array.from(value).slice(0, 256).join("");
    retain = retain && value === search();
    requests.scope?.abort();
    clearTimeout(requests.timer);
    restartPaging();
    const signal = searchSignal();
    const capabilities = options.capabilities();
    const current = () =>
      !signal.aborted &&
      requests.scope?.signal === signal &&
      options.screen() === "search" &&
      search() === value;
    const settle = () =>
      setLoading(
        !page().cards.length &&
          !searchChannels().length &&
          (searchMediaPending() || searchChannelsPending()),
      );
    batch(() => {
      setSearch(value);
      if (!retain || !capabilities.media)
        setPage({ cards: [], complete: !value });
      if (!retain || !capabilities.channels) {
        setSearchChannels([]);
        setSearchChannelPages([]);
      }
      if (!retain) {
        options.media.remember(0);
        options.channels.remember(0);
      }
      if (
        (!capabilities.media &&
          ["content", "search-retry"].includes(zone())) ||
        (!capabilities.channels &&
          ["search-channels", "search-channel-retry"].includes(zone()))
      )
        setZone("keyboard");
      setError("");
      setSearchError("");
      setSearchChannelError("");
      setSearchChannelPaging(false);
      setSearchMediaPending(!!value && capabilities.media);
      setSearchChannelsPending(!!value && capabilities.channels);
      settle();
    });
    options.retry(() => updateSearch(value, true));
    requests.timer = setTimeout(() => {
      if (!value || !current()) return;
      if (capabilities.media)
        void searchStremio(options.discover, value, signal)
          .then((result) => {
            if (current()) replacePage(result);
          })
          .catch((error) => {
            if (!current()) return;
            if (error instanceof RemoteError && error.status === 401)
              fail(error);
            else
              setSearchError(
                error instanceof Error
                  ? error.message
                  : "Search is unavailable. Try again.",
              );
          })
          .finally(() => {
            if (current())
              batch(() => {
                setSearchMediaPending(false);
                settle();
              });
          });
      if (capabilities.channels)
        void refreshChannelPage(true, signal)
          .then((result) => {
            if (!current()) return;
            const focused =
              searchChannels()[
                zone() === "search-channels" ? column() : options.channels.remembered()
              ]?.id;
            batch(() => {
              adoptChannelWindow([result], true);
              options.channels.remember(Math.max(
                0,
                result.channels.findIndex(
                  (channel) => channel.id === focused,
                ),
              ));
              if (zone() === "search-channels") setColumn(options.channels.remembered());
              if (result.availability !== "Available")
                setSearchChannelError(
                  result.reason ?? "Channel search is unavailable.",
                );
            });
          })
          .catch((error) => {
            if (!current()) return;
            if (error instanceof RemoteError && error.status === 401)
              fail(error);
            else
              setSearchChannelError(
                error instanceof Error
                  ? error.message
                  : "Channels are unavailable. Try again.",
              );
          })
          .finally(() => {
            if (current())
              batch(() => {
                setSearchChannelsPending(false);
                settle();
              });
          });
    }, 180);
  }
  return {signal: searchSignal, update: updateSearch};
}
