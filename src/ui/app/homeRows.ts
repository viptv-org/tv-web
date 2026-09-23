import type { Catalog, DiscoverRequest, MediaItem } from "../../api";
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

/** The catalog that feeds the hero and the first Home shelf. */
export const firstHomeCatalog = (catalogs: readonly Catalog[]) =>
  catalogs.find((catalog) => catalog.type !== "live" && !!browseRequest(catalog));

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
  return catalogs
    .filter((catalog) => catalog.type !== "live" && catalog !== first && !!browseRequest(catalog))
    .map((catalog) => ({
      // The responsive shelves name the content type; the TV keeps its
      // addon-qualified Roku row labels.
      name: responsive
        ? catalogShelfName(catalog)
        : catalog.addonName ? `${catalog.addonName} · ${catalog.name}` : catalog.name,
      catalog,
      items: [] as readonly MediaItem[],
      loaded: false,
    }))
    .map((row) => {
      const known = previous.find((candidate) => candidate.loaded && sameCatalog(candidate.catalog, row.catalog));
      return known ? { ...row, items: known.items, loaded: true } : row;
    });
}
