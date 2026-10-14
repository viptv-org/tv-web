import type { Catalog, MediaItem } from "../api";
import { filterTitle, selectionLabel, type DiscoveryValues } from "./discoveryQuery";
import { requestForCatalog } from "./discoveryQuery";
export { requestForCatalog } from "./discoveryQuery";
import { artworkUrl, cardPresentation } from "../core/presentations";
import {
  catalogChipLabels,
  catalogDefaults,
  catalogFilters,
  catalogsForGroup,
  discoverGroupLabel,
  discoverGroups,
  discoverTypeGroup,
  sameCatalog,
  type DiscoverGroup,
} from "../ui/catalogFilters";

export interface DiscoverCardView {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  progress: number;
  /** Contain rather than crop the art (live channel logos in a poster frame). */
  logo?: boolean;
}
export const emptyDiscoverCard: DiscoverCardView = {
  id: "",
  title: "",
  subtitle: "",
  image: "",
  progress: 0,
};

export interface DiscoverChipView {
  label: string;
  kind: "group" | "catalog" | "filter";
  value: string;
  x: number;
  y: number;
  width: number;
  selected: boolean;
  visible: boolean;
}
export const emptyDiscoverChip: DiscoverChipView = {
  label: "",
  kind: "group",
  value: "",
  x: 0,
  y: 162,
  width: 0,
  selected: false,
  visible: false,
};

export function discoverCard(item: MediaItem): DiscoverCardView {
  const card = cardPresentation(item, "catalog");
  return {
    id: item.id,
    title: card.title,
    subtitle: card.subtitle,
    image:
      artworkUrl(
        card.image ?? undefined,
        320,
        180,
        false,
        card.imageRole === "logo",
      ) ??
      card.image ??
      "",
    progress: card.progress ?? 0,
  };
}

export function initialCatalog(
  catalogs: readonly Catalog[],
): Catalog | undefined {
  const available = catalogs.filter(catalog => catalog.type !== 'live');
  return available.find(catalog => requestForCatalog(catalog, catalogDefaults(catalog))) ?? available[0] ?? catalogs[0];
}

export function discoverChips(
  catalogs: readonly Catalog[],
  selected: Catalog | undefined,
  values: DiscoveryValues,
  types?: readonly string[],
  requestedType?: string,
): DiscoverChipView[] {
  if (!selected && !types) return [];
  const groups = types ? (["movie", "series", "anime", "other"] as const).filter(group => types.some(type => discoverTypeGroup(type) === group)) : discoverGroups(catalogs);
  const group = discoverTypeGroup(selected?.type ?? requestedType ?? types?.[0] ?? "movie");
  const inGroup = catalogsForGroup(catalogs, group);
  const names = catalogChipLabels(inGroup);
  const chips: DiscoverChipView[] = [];
  let x = 192;
  for (const candidate of groups) {
    const label = discoverGroupLabel(candidate);
    const width = { movie: 136, series: 127, anime: 129, other: 127 }[
      candidate
    ];
    chips.push({
      label,
      kind: "group",
      y: 162,
      value: candidate,
      x,
      width,
      selected: candidate === group,
      visible: true,
    });
    x += width + 8;
  }
  if (!selected) return chips;
  x = 192;
  for (let index = 0; index < inGroup.length; index++) {
    const label = names[index];
    const width = Math.max(136, Math.round(label.length * 12 + 55));
    chips.push({
      label,
      kind: "catalog",
      y: 238,
      value: `${index}`,
      x,
      width,
      selected: sameCatalog(inGroup[index], selected),
      visible: true,
    });
    x += width + 8;
  }
  const filters = catalogFilters(selected);
  if (filters.length) x += 42;
  for (const filter of filters) {
    const value = values[filter.name];
    const label = `${filterTitle(filter)}: ${selectionLabel(filter, value)}`;
    const width = Math.max(176, Math.round(label.length * 12 + 38));
    chips.push({
      label,
      kind: "filter",
      y: 238,
      value: filter.name,
      x,
      width,
      selected: Array.isArray(value) ? value.length > 0 : !!value,
      visible: true,
    });
    x += width + 8;
  }
  return chips;
}

export function catalogForGroup(
  catalogs: readonly Catalog[],
  group: DiscoverGroup,
): Catalog | undefined {
  return catalogsForGroup(catalogs, group)[0];
}

export {
  catalogDefaults,
  catalogFilters,
  catalogsForGroup,
  discoverTypeGroup,
  sameCatalog,
};
