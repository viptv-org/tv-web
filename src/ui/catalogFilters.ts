import { normalizeCore } from "../core";
import type { Catalog } from "../api";
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

