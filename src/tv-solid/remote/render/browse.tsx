/** @jsxImportSource @solidtv/solid */
import { Show, type Accessor } from "solid-js";
import { BrowseControls } from "../BrowseControls";
import { CatalogGrid } from "../CatalogGrid";
import { LibraryToolbar } from "../LibraryToolbar";
import { SearchChannels } from "../SearchChannels";
import { SearchHeader } from "../SearchHeader";
import { SearchRows } from "../SearchRows";
import type { Catalog, Control, LibraryPage, Page, SearchRow } from "../types";
import type { Screen } from "../app-types";

type GridProps = Parameters<typeof CatalogGrid>[0];
type RowsProps = Parameters<typeof SearchRows>[0];
type ChannelsProps = Parameters<typeof SearchChannels>[0];

/** The four catalog-shaped screens: a catalog, the library and search.
 *
 * They share one grid window and one focus index, so they are one screen with
 * three toolbars rather than three screens. Search adds its own header, its
 * per-provider rows and an optional channel column; a catalog that reports no
 * media search never grows the search parts at all.
 */
export function BrowseScreen(props: {
  screen: Screen;
  zone: Accessor<string>;
  column: Accessor<number>;
  key: Accessor<number>;
  search: Accessor<string>;
  searchCapabilities: { media: boolean; channels: boolean };
  searchResults: { rows: SearchRow[] };
  searchError: Accessor<string>;
  library: LibraryPage | undefined;
  libraryType: Control | undefined;
  librarySort: Control | undefined;
  libraryFilters: unknown[];
  catalog: Catalog | undefined;
  page: Page;
  loading: Accessor<boolean>;
  grid: GridProps["window"];
  gridFocus: GridProps["focus"];
  gridSearch: GridProps["search"];
  searchRowIndex: number;
  searchMediaFocus: number;
  searchMediaPending: Accessor<boolean>;
  searchNeedsRetry: Accessor<boolean>;
  searchRemembered: RowsProps["remembered"];
  searchChannels: ChannelsProps["channels"];
  hasPreviousChannelPage: boolean;
  searchChannelFocus: number;
  searchChannelsPending: boolean;
  searchChannelPaging: boolean;
  searchChannelError: string;
}) {
  return (
    <Show when={["movie", "series", "anime", "library", "search"].includes(props.screen)}>
      <Show when={props.screen === "library"}>
        <LibraryToolbar
          type={props.libraryType}
          sort={props.librarySort}
          filters={props.libraryFilters.length > 0}
          query={props.library?.query}
          defaultQuery={props.library?.default_query}
          focused={props.zone() === "library-controls"}
          index={props.column()}
        />
      </Show>
      <Show when={props.screen === "movie" || props.screen === "series" || props.screen === "anime"}>
        <BrowseControls
          catalog={props.catalog?.name ?? "Choose a catalog"}
          filters={(props.catalog?.controls.length ?? 0) > 0}
          focused={props.zone() === "filters"}
          index={props.column()}
        />
      </Show>
      <Show when={props.screen === "search"}>
        <SearchHeader
          query={props.search()}
          selected={props.key()}
          keyboardFocused={props.zone() === "keyboard"}
          media={props.searchCapabilities.media && !props.searchResults.rows.length}
          retry={!!props.searchError() && !props.searchResults.rows.length}
          resultCount={props.page.cards.length}
          error={props.searchError()}
          retryFocused={props.zone() === "search-retry"}
        />
      </Show>
      <Show when={["movie", "series", "anime", "library"].includes(props.screen) && (props.screen !== "search" || props.searchCapabilities.media)}>
        <CatalogGrid
          screen={props.screen}
          cards={props.page.cards}
          window={props.grid}
          focus={props.gridFocus}
          loading={props.loading()}
          search={props.gridSearch}
        />
      </Show>
      <Show when={props.screen === "search" && props.searchCapabilities.media}>
        <SearchRows
          rows={props.searchResults.rows}
          row={props.searchRowIndex}
          column={props.zone() === "content" ? props.column() : props.searchMediaFocus}
          focused={props.zone() === "content"}
          retryFocused={props.zone() === "search-retry"}
          pending={props.searchMediaPending()}
          error={props.searchError()}
          query={props.search()}
          channels={props.searchCapabilities.channels}
          remembered={props.searchRemembered}
        />
      </Show>
      <Show when={props.screen === "search" && props.searchCapabilities.channels && props.search()}>
        <SearchChannels
          channels={props.searchChannels}
          hasPrevious={props.hasPreviousChannelPage}
          index={props.zone() === "search-channels" ? props.column() : props.searchChannelFocus}
          focused={props.zone() === "search-channels"}
          y={props.searchCapabilities.media ? 650 : 140}
          pending={props.searchChannelsPending || props.searchChannelPaging}
          error={props.searchChannelError}
          retryFocused={props.zone() === "search-channel-retry"}
        />
      </Show>
    </Show>
  );
}
