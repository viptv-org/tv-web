import type { Catalog, DiscoverRequest, MediaItem } from "../../api";
import type { HomeLayout } from "../../../vendor/core/typescript/wire";
import { normalizeCore } from "../../core";
import { catalogDefaults, catalogFilters, catalogShelfName, sameCatalog } from "../catalogFilters";

/**
 * One Home catalog shelf. Home renders every shelf from the catalog list at
 * once; a shelf's items arrive separately (`loaded`), so the page never
 * waits for its slowest catalog.
 */
export type HomeRow = {
  name: string;
  catalog: Catalog;
  items: readonly MediaItem[];
  loaded: boolean;
};

/**
 * The request that lists a catalog without user input: its declared
 * defaults applied, or undefined when a required extra has no default
 * (search-only catalogs, a genre or year the user must pick). Home skips
 * those instead of asking the backend for a guaranteed 400.
 */
export function browseRequest(catalog: Catalog): DiscoverRequest | undefined {
  const values = catalogDefaults(catalog);
  if (catalogFilters(catalog).some((filter) => filter.required && !values[filter.name]?.trim())) return undefined;
  const { search, genre, ...rest } = values;
  const extras = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== ""));
  return {
    type: catalog.type,
    catalog: catalog.id,
    addonId: catalog.addonId,
    search: search || undefined,
    genre: genre || undefined,
    extras: Object.keys(extras).length ? extras : undefined,
  };
}

/**
 * The shared Home shelf layout: shelf order, titles and fetch limits, with
 * catalog shelves only for catalogs that load without viewer input.
 */
export function homeLayout(catalogs: readonly Catalog[]): HomeLayout {
  return normalizeCore<HomeLayout>("homeLayout", { catalogs });
}

/** Catalog shelves in layout order with their addon-qualified titles. */
function homeCatalogs(catalogs: readonly Catalog[]) {
  return homeLayout(catalogs).shelves.flatMap((shelf) =>
    shelf.catalogIndex == null ? [] : [{ catalog: catalogs[shelf.catalogIndex], title: shelf.title }],
  );
}

/** Recently watched channels requested for Home. */
export const recentLiveLimit = () =>
  homeLayout([]).shelves.find((shelf) => shelf.role === "recentLive")?.limit ?? 24;

/** The catalog that feeds the hero and the first Home shelf. */
export const firstHomeCatalog = (catalogs: readonly Catalog[]) => homeCatalogs(catalogs)[0]?.catalog;

/**
 * Shelves for every other browsable catalog, in catalog order. A shelf this
 * profile already loaded keeps its items (Home reloads on every visit), so
 * returning to Home never drops loaded shelves back to placeholders.
 */
export function homeRowsFor(
  catalogs: readonly Catalog[],
  first: Catalog | undefined,
  responsive: boolean,
  previous: readonly HomeRow[] = [],
): HomeRow[] {
  return homeCatalogs(catalogs)
    .filter(({ catalog }) => catalog !== first)
    .map(({ catalog, title }) => ({
      // The responsive shelves name the content type; the TV keeps the
      // shared addon-qualified shelf titles.
      name: responsive ? catalogShelfName(catalog) : title,
      catalog,
      items: [] as readonly MediaItem[],
      loaded: false,
    }))
    .map((row) => {
      const known = previous.find((candidate) => candidate.loaded && sameCatalog(candidate.catalog, row.catalog));
      return known ? { ...row, items: known.items, loaded: true } : row;
    });
}
