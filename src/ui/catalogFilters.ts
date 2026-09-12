import type { Catalog } from "../api";
export type CatalogFilter = {
  name: string;
  required: boolean;
  options: string[];
  defaultValue?: string;
};
export function catalogFilters(catalog: Catalog): CatalogFilter[] {
  const values = Array.isArray(catalog.raw.extra) ? catalog.raw.extra : [];
  const filters: CatalogFilter[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (typeof value.name !== "string" || value.name === "skip") continue;
    filters.push({
      name: value.name,
      required: value.is_required === true,
      options: Array.isArray(value.options)
        ? value.options.filter((v): v is string => typeof v === "string")
        : [],
      defaultValue:
        typeof value.default === "string" ? value.default : undefined,
    });
  }
  if (catalog.supportsSearch && !filters.some((f) => f.name === "search"))
    filters.push({ name: "search", required: false, options: [] });
  return filters;
}
export function catalogDefaults(catalog: Catalog): Record<string, string> {
  return Object.fromEntries(
    catalogFilters(catalog)
      .filter((f) => f.required)
      .map((f) => [f.name, f.defaultValue ?? f.options[0] ?? ""]),
  );
}
export function catalogFilterLabel(name: string): string {
  return name === "search"
    ? "Search catalog"
    : name === "genre"
      ? "Genre"
      : name.charAt(0).toUpperCase() + name.slice(1);
}
