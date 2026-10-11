import { describe, it, expect } from "vitest";
import type { MediaItem } from "../../src/api";
import { libraryCard, libraryGrid } from "../../src/tv-solid/libraryModel";
import { catalogHomeCards, homeRowTop, homeShelfGeometry, posterHomeCards, type HomeShelfView } from "../../src/tv-solid/homeModel";

const movie = {
  id: "tt0111161", type: "movie", name: "Saved", title: "Saved", genres: [], episodes: [], raw: {},
  poster: "https://images.example/poster.jpg", background: "https://images.example/backdrop.jpg",
} as unknown as MediaItem;
const shelf = (kind: HomeShelfView["kind"]): HomeShelfView => ({ key: kind, title: kind, kind, cards: [], loaded: true });

// TV-MYLIST-POSTER-001
describe("TV My List posters", () => {
  it("lays My List out as seven 200 x 300 posters inside the 1824 px safe edge", () => {
    const grid = libraryGrid(false);
    expect(grid.columns).toBe(7);
    expect(192 + (grid.columns - 1) * grid.strideX + 200).toBeLessThanOrEqual(1824);
    expect(grid.strideY).toBe(300 + 122);
    expect(libraryGrid(true)).toMatchObject({ columns: 4, slots: 12, strideX: 404 });
  });

  it("uses the saved poster, never the landscape backdrop", () => {
    const card = libraryCard(movie, false);
    expect(card.image).toContain("poster");
    expect(card.image).not.toContain("backdrop");
    expect(card.progress).toBe(0);
    expect(libraryCard(movie, true).image).toContain("backdrop");
  });

  it("keeps a live channel's logo contained in the poster frame", () => {
    const live = { ...movie, id: "live-1", type: "live" } as MediaItem;
    expect(libraryCard(live, false).logo).toBe(true);
    expect(posterHomeCards([live])[0].image).toBe(catalogHomeCards([live])[0].image);
  });

  it("gives the Home My List shelf 160 x 240 posters and 60 px of extra height", () => {
    expect(homeShelfGeometry("favorites")).toMatchObject({ poster: true, width: 160, stride: 196, extra: 60 });
    expect(homeShelfGeometry("catalog")).toMatchObject({ poster: false, width: 320, stride: 356, extra: 0 });
    expect(posterHomeCards([movie])[0].image).toContain("poster");
    const shelves = [shelf("queue"), shelf("favorites"), shelf("catalog")];
    expect(homeRowTop(shelves, 1)).toBe(700 + 364);
    expect(homeRowTop(shelves, 2)).toBe(700 + 2 * 364 + 60);
  });
});
