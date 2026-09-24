import type { Catalog, MediaItem } from "../api";
import { artworkUrl, cardPresentation } from "../core/presentations";
import { searchSections, type SearchSectionKey } from "../ui/catalogFilters";
import { searchKeyIcon } from "./searchKeyIcons";
import { channelMonogram, liveSubtitle } from "../components/cards/cardText";

export interface SearchKeyView {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  action: "character" | "space" | "delete" | "clear";
  icon: string;
  focusedIcon: string;
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz1234567890";
export const searchKeys: SearchKeyView[] = [
  ...Array.from(LETTERS, (label, index) => ({
    id: `key-${label}`, label,
    x: 192 + (index % 6) * 95,
    y: 243 + Math.floor(index / 6) * 74,
    width: 84,
    action: "character" as const,
    icon: "", focusedIcon: "",
  })),
  ...([
    { id: "space", label: "", x: 192, action: "space" as const },
    { id: "delete", label: "", x: 382, action: "delete" as const },
    { id: "clear", label: "", x: 572, action: "clear" as const },
  ]).map(key => ({ ...key, y: 687, width: 180, icon: searchKeyIcon(key.action), focusedIcon: searchKeyIcon(key.action, true) })),
];

export interface SearchRow {
  name: string;
  items: readonly MediaItem[];
  catalog?: Catalog;
}

export interface SearchHeadingView {
  id: SearchSectionKey;
  title: string;
  count: string;
  countX: number;
  y: number;
}

export interface SearchCardView {
  id: string;
  position: number;
  item: MediaItem;
  section: SearchSectionKey;
  sectionIndex: number;
  localIndex: number;
  x: number;
  y: number;
  visible: boolean;
  title: string;
  subtitle: string;
  image: string;
  live: boolean;
  monogram: string;
}

export function projectSearch(rows: readonly SearchRow[], offsets: Readonly<Record<string, number>> = {}, verticalOffset = 0): {
  headings: SearchHeadingView[];
  cards: SearchCardView[];
} {
  const sections = searchSections(rows).filter(section => section.items.length > 0);
  const headings: SearchHeadingView[] = [];
  const cards: SearchCardView[] = [];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const y = 150 + sectionIndex * 360 - verticalOffset;
    headings.push({
      id: section.key, title: section.title,
      count: `${section.items.length} ${section.items.length === 1 ? "result" : "results"}`,
      countX: section.title === "Movies" ? 975 : section.title === "Series" ? 960 : 970,
      y,
    });
    const start = offsets[section.key] ?? 0;
    for (let localIndex = 0; localIndex < section.items.length; localIndex++) {
      const item = section.items[localIndex];
      const card = cardPresentation(item, "catalog");
      const cardY = y + 58;
      const visible = localIndex >= start && localIndex < start + 3 && cardY < 976 && cardY + 270 > 150;
      cards.push({
        id: `${section.key}:${item.type}:${item.id}`,
        position: cards.length,
        item, section: section.key, sectionIndex, localIndex,
        x: 850 + (localIndex - start) * 356,
        y: cardY,
        visible,
        title: card.title,
        subtitle: item.type === "live" ? liveSubtitle(item) : card.subtitle,
        image: visible ? artworkUrl(card.image ?? undefined, 320, 180, false, card.imageRole === "logo") ?? card.image ?? "" : "",
        live: item.type === "live",
        monogram: item.type === "live" ? channelMonogram(item.name) : "",
      });
    }
  }
  return { headings, cards };
}

/** Reposition only the visible TV result tiles during D-pad paging. The full
 * result index is built when API rows change, not on every focus movement. */
export function projectSearchWindow(
  headings: readonly SearchHeadingView[],
  bySection: ReadonlyMap<string, readonly SearchCardView[]>,
  offsets: Readonly<Record<string, number>>,
  verticalOffset: number,
): { headings: SearchHeadingView[]; cards: SearchCardView[] } {
  const visibleHeadings = headings.map((heading, index) => ({ ...heading, y: 150 + index * 360 - verticalOffset }));
  const cards: SearchCardView[] = [];
  for (const heading of visibleHeadings) {
    const y = heading.y + 58;
    if (y >= 976 || y + 270 <= 150) continue;
    const section = bySection.get(heading.id) ?? [];
    const start = offsets[heading.id] ?? 0;
    for (let localIndex = start; localIndex < Math.min(section.length, start + 3); localIndex++) {
      const card = section[localIndex];
      const art = cardPresentation(card.item, "catalog");
      cards.push({
        ...card, x: 850 + (localIndex - start) * 356, y, visible: true,
        image: card.image || artworkUrl(art.image ?? undefined, 320, 180, false, art.imageRole === "logo") || art.image || "",
      });
    }
  }
  return { headings: visibleHeadings, cards };
}
