import { describe, expect, it } from "vitest";
import type { Catalog, MediaItem } from "../../src/api";
import { catalogChipLabels, catalogChoiceLabel, catalogFilterSummary, searchSections } from "../../src/ui/catalogFilters";

const catalog = (id: string, name: string, type: string, addonName?: string) =>
  ({ id, name, type, addonId: addonName ?? "addon", addonName, supportsSearch: true, supportsSkip: true, extras: [], genres: [], raw: {} }) as unknown as Catalog;
const title = (id: string, type = "movie"): MediaItem =>
  ({ id, type, name: id, title: id, genres: [], episodes: [], raw: {} }) as unknown as MediaItem;

describe("browse catalog helpers", () => {
  it("labels catalogs as Addon · Catalog, and chips by name unless two share one", () => {
    const popular = catalog("top", "Popular", "movie", "Cinemeta");
    const other = catalog("popular", "Popular", "movie", "AIOMetadata");
    const seasonal = catalog("seasonal", "Seasonal", "movie", "Trakt");
    expect(catalogChoiceLabel(popular)).toBe("Cinemeta · Popular");
    expect(catalogChoiceLabel(catalog("x", "Plain", "movie"))).toBe("Plain");
    expect(catalogChipLabels([popular, seasonal])).toEqual(["Popular", "Seasonal"]);
    expect(catalogChipLabels([popular, other, seasonal])).toEqual(["Cinemeta · Popular", "AIOMetadata · Popular", "Seasonal"]);
  });

  it("names filter chips with their value, Any, or Required", () => {
    expect(catalogFilterSummary({ name: "genre", required: false, options: [] }, "")).toBe("Genre: Any");
    expect(catalogFilterSummary({ name: "year", required: true, options: [] }, undefined)).toBe("Year: Required");
    expect(catalogFilterSummary({ name: "search", required: false, options: [] }, " moon ")).toBe("Search catalog: moon");
  });

  it("groups search rows by type in Movies, Series, Anime, Other, Live TV order without duplicates", () => {
    const movies = catalog("top", "Popular", "movie", "Cinemeta");
    const digital = catalog("digital", "Latest digital", "movie", "Cinemeta");
    const series = catalog("top", "Popular", "series", "Cinemeta");
    const anime = catalog("kitsu", "Top airing", "anime.series", "Kitsu");
    const sections = searchSections([
      { name: "Popular", items: [title("a"), title("b")], catalog: movies },
      { name: "Popular", items: [title("s", "series")], catalog: series },
      { name: "Top airing", items: [], catalog: anime },
      { name: "Latest digital", items: [title("b"), title("c")], catalog: digital },
      { name: "Live TV", items: [] },
    ]);
    expect(sections.map((section) => [section.title, section.items.map((item) => item.id)])).toEqual([
      ["Movies", ["a", "b", "c"]],
      ["Series", ["s"]],
      ["Anime", []],
      ["Live TV", []],
    ]);
    expect(sections[0].catalog).toBe(movies);
  });
});
