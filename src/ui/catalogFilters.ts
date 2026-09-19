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

