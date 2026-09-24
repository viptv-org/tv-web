import { normalizeCore } from "../core";
import type { Catalog, MediaItem } from "../api";
export type CatalogFilter = {
  name: string;
  required: boolean;
  options: string[];
  defaultValue?: string;
};
export function catalogFilters(catalog: Catalog): CatalogFilter[] {
  return normalizeCore("catalogFilters", catalog);
}
export function catalogDefaults(catalog: Catalog): Record<string, string> {
  return normalizeCore("catalogDefaults", catalog);
}
export function catalogFilterLabel(name: string): string {
  return name === "search"
    ? "Search catalog"
    : name === "genre"
      ? "Genre"
      : name.charAt(0).toUpperCase() + name.slice(1);
}

/** Canonical Stremio-style discover groups; addon namespaces fold into them. */
export type DiscoverGroup = "movie" | "series" | "anime" | "other";
export function discoverTypeGroup(type: string): DiscoverGroup {
  if (type === "movie") return "movie";
  if (type === "series") return "series";
  if (type === "anime" || type.startsWith("anime.")) return "anime";
  return "other";
}
export function discoverGroupLabel(group: DiscoverGroup): string {
  if (group === "movie") return "Movies";
  if (group === "series") return "Series";
  if (group === "anime") return "Anime";
  return "Other";
}
/** Same addon catalog, across refetched catalog lists. */
export const sameCatalog = (left: Catalog, right: Catalog | undefined) =>
  !!right && left.id === right.id && left.type === right.type && left.addonId === right.addonId;

/** "Addon · Catalog" ("Cinemeta · Popular"): the desktop catalog chip and every catalog list. */
export function catalogChoiceLabel(catalog: Catalog): string {
  return catalog.addonName ? `${catalog.addonName} · ${catalog.name}` : catalog.name;
}

/**
 * Chip labels for one type's catalogs (phone and TV catalog chips): the
 * catalog name, in "Addon · Catalog" form only where two catalogs share a name.
 */
export function catalogChipLabels(catalogs: readonly Catalog[]): string[] {
  const counts = new Map<string, number>();
  for (const catalog of catalogs) counts.set(catalog.name, (counts.get(catalog.name) ?? 0) + 1);
  return catalogs.map((catalog) =>
    (counts.get(catalog.name) ?? 0) > 1 ? catalogChoiceLabel(catalog) : catalog.name,
  );
}

/** A filter chip's accessible name: "Genre: Any", "Year: Required", "Search catalog: moon". */
export function catalogFilterSummary(filter: CatalogFilter, value: string | undefined): string {
  const current = value?.trim();
  return `${catalogFilterLabel(filter.name)}: ${current || (filter.required ? "Required" : "Any")}`;
}

/** Search results grouped the way the design shows them: by content type, then Live TV. */
export type SearchSectionKey = DiscoverGroup | "live";
export type SearchSection = {
  key: SearchSectionKey;
  title: string;
  items: readonly MediaItem[];
  /** The first catalog that contributed, handed to the detail page as the titles' origin. */
  catalog?: Catalog;
};
const SEARCH_ORDER: readonly SearchSectionKey[] = ["movie", "series", "anime", "other", "live"];
export function searchSectionTitle(key: SearchSectionKey): string {
  return key === "live" ? "Live TV" : discoverGroupLabel(key);
}
/**
 * Folds the per-catalog search rows into one section per content type (in
 * Movies, Series, Anime, Other, Live TV order), without duplicates. A section
 * whose catalogs all came back empty is kept with no items, so its count
 * ("Live TV · 0") still shows.
 */
export function searchSections(
  rows: readonly { name: string; items: readonly MediaItem[]; catalog?: Catalog }[],
): SearchSection[] {
  const sections = new Map<SearchSectionKey, { items: MediaItem[]; seen: Set<string>; catalog?: Catalog }>();
  for (const row of rows) {
    const key: SearchSectionKey = row.catalog ? discoverTypeGroup(row.catalog.type) : "live";
    const section = sections.get(key) ?? { items: [], seen: new Set<string>(), catalog: row.catalog };
    section.catalog ??= row.catalog;
    for (const item of row.items) {
      const id = `${item.type}:${item.id}`;
      if (section.seen.has(id)) continue;
      section.seen.add(id);
      section.items.push(item);
    }
    sections.set(key, section);
  }
  return SEARCH_ORDER.filter((key) => sections.has(key)).map((key) => {
    const section = sections.get(key)!;
    return { key, title: searchSectionTitle(key), items: section.items, catalog: section.catalog };
  });
}

/**
 * Home shelf heading for a catalog: its content type rather than the addon
 * that serves it ("Series · AniList Trending", not "AIOMetadata · AniList
 * Trending"). Discover keeps addon names where they disambiguate choices.
 */
export function catalogShelfName(catalog: Catalog): string {
  const group = discoverTypeGroup(catalog.type);
  const type = group === "other" ? formatContentType(catalog.type) : discoverGroupLabel(group);
  return catalog.name ? `${type} · ${catalog.name}` : type;
}
export function catalogsForGroup(catalogs: readonly Catalog[], group: DiscoverGroup): readonly Catalog[] {
  return catalogs.filter((c) => c.type !== "live" && discoverTypeGroup(c.type) === group);
}
export function discoverGroups(catalogs: readonly Catalog[]): DiscoverGroup[] {
  const groups: DiscoverGroup[] = [];
  for (const group of ["movie", "series", "anime", "other"] as const) {
    if (catalogsForGroup(catalogs, group).length > 0) groups.push(group);
  }
  return groups;
}

export function formatContentType(type: string): string {
  const overrides: Record<string, string> = {
    movie: "Movie",
    series: "Series",
    "anime.movie": "Anime Movie",
    "anime.series": "Anime Series",
    anime: "Anime",
    live: "Live TV",
  };
  if (overrides[type]) return overrides[type];
  return type
    .split(/[._]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

