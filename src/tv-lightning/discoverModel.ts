import type { Catalog, DiscoverRequest, MediaItem } from "../api";
import { artworkUrl, cardPresentation } from "../core/presentations";
import {
  catalogChipLabels, catalogDefaults, catalogFilters, catalogsForGroup,
  discoverGroupLabel, discoverGroups, discoverTypeGroup, sameCatalog, type DiscoverGroup,
} from "../ui/catalogFilters";

export interface DiscoverCardView {
  id: string;
  title: string;
  subtitle: string;
  image: string;
}
export const emptyDiscoverCard: DiscoverCardView = { id: "", title: "", subtitle: "", image: "" };

export interface DiscoverChipView {
  label: string;
  kind: "group" | "catalog" | "filter";
  value: string;
  x: number;
  width: number;
  selected: boolean;
  visible: boolean;
}
export const emptyDiscoverChip: DiscoverChipView = {
  label: "", kind: "group", value: "", x: 0, width: 0, selected: false, visible: false,
};

export function discoverCard(item: MediaItem): DiscoverCardView {
  const card = cardPresentation(item, "catalog");
  return {
    id: item.id,
    title: card.title,
    subtitle: card.subtitle,
    image: artworkUrl(card.image ?? undefined, 320, 180, false, card.imageRole === "logo") ?? card.image ?? "",
  };
}

export function requestForCatalog(catalog: Catalog, values: Readonly<Record<string, string>>, skip = 0): DiscoverRequest | undefined {
  if (catalogFilters(catalog).some(filter => filter.required && !values[filter.name]?.trim())) return undefined;
  const { search, genre, ...other } = values;
  return {
    type: catalog.type, catalog: catalog.id, addonId: catalog.addonId, skip,
    search: search || undefined, genre: genre || undefined,
    extras: Object.fromEntries(Object.entries(other).filter(([, value]) => value !== "")),
  };
}

export function initialCatalog(catalogs: readonly Catalog[]): Catalog | undefined {
  return catalogs.find(catalog => catalog.type !== "live") ?? catalogs[0];
}

export function discoverChips(catalogs: readonly Catalog[], selected: Catalog | undefined, values: Readonly<Record<string, string>>): DiscoverChipView[] {
  if (!selected) return [];
  const groups = discoverGroups(catalogs);
  const group = discoverTypeGroup(selected.type);
  const inGroup = catalogsForGroup(catalogs, group);
  const names = catalogChipLabels(inGroup);
  const chips: DiscoverChipView[] = [];
  let x = 192;
  for (const candidate of groups) {
    const label = discoverGroupLabel(candidate);
    const width = { movie: 136, series: 127, anime: 129, other: 127 }[candidate];
    chips.push({ label, kind: "group", value: candidate, x, width, selected: candidate === group, visible: true });
    x += width + 8;
  }
  x += 42;
  for (let index = 0; index < inGroup.length; index++) {
    const label = names[index];
    const width = Math.max(136, Math.round(label.length * 12 + 55));
    chips.push({ label, kind: "catalog", value: `${index}`, x, width, selected: sameCatalog(inGroup[index], selected), visible: true });
    x += width + 8;
  }
  const filters = catalogFilters(selected);
  if (filters.length) x += 42;
  for (const filter of filters) {
    const value = values[filter.name]?.trim();
    const label = `${filter.name === "genre" ? "Genre" : filter.name.charAt(0).toUpperCase() + filter.name.slice(1)}: ${value || (filter.required ? "Required" : "Any")} ⌄`;
    const width = Math.max(176, Math.round(label.length * 12 + 38));
    chips.push({ label, kind: "filter", value: filter.name, x, width, selected: !!value, visible: true });
    x += width + 8;
  }
  return chips;
}

export function catalogForGroup(catalogs: readonly Catalog[], group: DiscoverGroup): Catalog | undefined {
  return catalogsForGroup(catalogs, group)[0];
}

export { catalogDefaults, catalogFilters, catalogsForGroup, discoverTypeGroup, sameCatalog };
