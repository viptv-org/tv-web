import type { Catalog, DiscoverRequest } from '../api';
import { catalogFilters, type CatalogFilter } from '../ui/catalogFilters';
import { hostCatalogControls } from '../api/engine-discovery';

export type DiscoveryValues = Record<string, string | readonly string[]>;
export const selectedValues = (value: string | readonly string[] | undefined): readonly string[] =>
  Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : [];
export const filterTitle = (filter: CatalogFilter) => filter.label ??
  (filter.name === 'genre' ? 'Genre' : filter.name.charAt(0).toUpperCase() + filter.name.slice(1));
export function selectionLabel(filter: CatalogFilter, value: string | readonly string[] | undefined): string {
  const selected = selectedValues(value);
  if (filter.kind === 'Toggle' && selected[0] != null) return selected[0] === 'true' ? 'On' : 'Off';
  if (filter.kind === 'MultiChoice') return selected.length ? `${selected.length} selected` : filter.required ? 'Required' : 'Default';
  return filter.choices?.find(choice => choice.value === selected[0])?.label ?? selected[0] ??
    (filter.required ? 'Required' : filter.kind ? 'Default' : 'Any');
}
export function requestForCatalog(catalog: Catalog, values: DiscoveryValues, skip = 0): DiscoverRequest | undefined {
  const filters = catalogFilters(catalog);
  if (filters.some(filter => filter.required && !selectedValues(values[filter.name]).some(value => value.trim()))) return;
  const vectors = Object.entries(values).filter((entry): entry is [string, readonly string[]] => Array.isArray(entry[1]));
  if (vectors.some(([name, selected]) => selected.length > Math.min(64, filters.find(filter => filter.name === name)?.maximumSelections ?? 64))) return;
  const scalars = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const { search, genre, ...other } = scalars;
  const host = hostCatalogControls(catalog) !== undefined;
  return { type: catalog.type, catalog: host && !catalog.id ? undefined : catalog.id, addonId: catalog.addonId, skip,
    search: search || undefined, genre: genre || undefined,
    extras: Object.fromEntries(Object.entries(other).filter(([, value]) => value !== '')),
    values: vectors.filter(([, selected]) => selected.length).map(([id, values]) => ({ id, values })) };
}
