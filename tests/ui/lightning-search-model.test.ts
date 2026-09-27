import { expect, it, vi } from "vitest";
import type { Catalog, MediaItem } from "../../src/api";

vi.mock("../../src/tv-solid/searchKeyIcons", () => ({ searchKeyIcon: () => "" }));

const { projectSearch, projectSearchWindow } = await import("../../src/tv-solid/searchModel");

const item = (group: string, index: number): MediaItem => ({
  id: `${group}-${index}`, type: group === "live" ? "live" : "movie",
  name: `${group} ${index}`, title: `${group} ${index}`,
  poster: `https://art.example/${group}/${index}.jpg`, genres: [], episodes: [], raw: {},
} as MediaItem);

it("keeps full Search navigation positions while requesting only onscreen wsrv artwork", () => {
  const groups = ["movie", "series", "anime", "other", "live"];
  const rows = groups.map(group => ({
    name: group,
    items: Array.from({ length: 24 }, (_, index) => item(group, index)),
    catalog: group === "live" ? undefined : { id: group, type: group, name: group } as Catalog,
  }));
  const initial = projectSearch(rows);
  expect(initial.cards).toHaveLength(120);
  expect(initial.cards.map(card => card.position)).toEqual(Array.from({ length: 120 }, (_, index) => index));
  expect(initial.cards.filter(card => card.visible)).toHaveLength(9);
  expect(initial.cards.filter(card => !card.visible).every(card => card.image === "")).toBe(true);
  expect(initial.cards.filter(card => card.visible).every(card => card.image.includes("wsrv.nl"))).toBe(true);

  const moved = projectSearch(rows, { ":movie:movie": 5 * 356 }, 360);
  expect(moved.cards.filter(card => card.visible).map(card => card.position)).toEqual([24, 25, 26, 48, 49, 50, 72, 73, 74]);
  expect(moved.cards[5].position).toBe(5);
  expect(moved.cards[5].visible).toBe(false);

  const bySection = new Map<string, typeof initial.cards>();
  for (const card of initial.cards) bySection.set(card.section, [...(bySection.get(card.section) ?? []), card]);
  const windowed = projectSearchWindow(initial.headings, bySection, { ":movie:movie": 5 * 356 }, 360);
  expect(windowed.cards.map(card => card.position)).toEqual(moved.cards.filter(card => card.visible).map(card => card.position));
  expect(windowed.cards.map(card => [card.x, card.y])).toEqual(moved.cards.filter(card => card.visible).map(card => [card.x, card.y]));
  expect(windowed.cards.every(card => card.image.includes("wsrv.nl"))).toBe(true);
});


it("keeps identical media types separate by addon/catalog without result counts",()=>{
  const rows=[1,2].map(id=>({name:"Search movies",catalog:{id:"search",type:"movie",name:"Search movies",addonId:id,addonName:`Provider ${id}`,supportsSearch:true,supportsSkip:false,extras:[],genres:[],raw:{}} as Catalog,items:[item("movie",0)]}));
  const view=projectSearch(rows);
  expect(view.headings.map(row=>row.title)).toEqual(["Provider 1 · Search movies","Provider 2 · Search movies"]);
  expect(new Set(view.cards.map(card=>card.section)).size).toBe(2);
  expect(view.headings.every(row=>!("count" in row))).toBe(true);
});
