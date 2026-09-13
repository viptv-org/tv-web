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
