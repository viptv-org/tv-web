import { describe, expect, it } from "vitest";
import type { Catalog, MediaItem } from "../../src/api";
import { normalizeCore } from "../../src/core";
import { browseRequest, firstHomeCatalog, homeRowsFor } from "../../src/ui/app/homeRows";
import { castMembers, directorNames, genreTarget } from "../../src/ui/detailLinks";

const catalogs = (raw: unknown[]) => normalizeCore<Catalog[]>("catalogs", raw);
const item = (raw: Record<string, unknown>) =>
  ({ id: "tt1", type: "movie", name: "Inception", title: "Inception", genres: ["Drama", "Action"], episodes: [], raw }) as unknown as MediaItem;

describe("Home catalog shelves", () => {
  // Built lazily: the WASM core initializes in the suite's beforeAll.
  const shelves = () => catalogs([
    { id: "top", name: "Top", type: "movie", addon_id: 1, addon_name: "Cinemeta", extra: [{ name: "skip" }] },
    { id: "search.movie", name: "Search", type: "movie", addon_id: 4, extra: [{ name: "search", is_required: true }] },
    { id: "year", name: "By year", type: "movie", addon_id: 4, extra: [{ name: "year", is_required: true, options: ["2024", "2025"], default: "2025" }] },
    { id: "genre", name: "By genre", type: "series", addon_id: 4, extra: [{ name: "genre", is_required: true, options: ["Drama"] }] },
    { id: "channels", name: "Channels", type: "live", addon_id: 5 },
  ]);

  it("lists catalogs with their required defaults and skips ones that need input", () => {
    const list = shelves();
    expect(browseRequest(list[0])).toEqual({ type: "movie", catalog: "top", addonId: 1, search: undefined, genre: undefined, extras: undefined });
    expect(browseRequest(list[1])).toBeUndefined();
    expect(browseRequest(list[2])?.extras).toEqual({ year: "2025" });
    // A required extra with options takes its first option, as in Stremio;
    // only free-form required input (search) keeps a catalog off Home.
    expect(browseRequest(list[3])?.genre).toBe("Drama");
    expect(firstHomeCatalog(list)?.id).toBe("top");
    expect(homeRowsFor(list, list[0], true).map((row) => [row.catalog.id, row.name, row.loaded])).toEqual([
      ["year", "Movies · By year", false],
      ["genre", "Series · By genre", false],
    ]);
  });

  it("keeps a shelf this profile already loaded when Home reloads", () => {
    const list = shelves();
    const loaded = homeRowsFor(list, list[0], true).map((row) => ({ ...row, items: [item({})], loaded: true }));
    const refetched = catalogs([{ id: "year", name: "By year", type: "movie", addon_id: 4, extra: [{ name: "year", is_required: true, options: ["2025"], default: "2025" }] }]);
    const rows = homeRowsFor(refetched, undefined, true, loaded);
    expect(rows[0].loaded).toBe(true);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].catalog).toBe(refetched[0]);
  });
});

describe("detail links", () => {
  it("prefers photographed app_extras cast and falls back to names", () => {
    expect(castMembers(item({ app_extras: { cast: [{ name: "Leonardo DiCaprio", character: "Cobb", photo: "https://image.tmdb.org/p.jpg" }] }, cast: ["Other"] })))
      .toEqual([{ name: "Leonardo DiCaprio", character: "Cobb", photo: "https://image.tmdb.org/p.jpg" }]);
    expect(castMembers(item({ cast: ["Leonardo DiCaprio", 7, ""] }))).toEqual([{ name: "Leonardo DiCaprio" }]);
    expect(directorNames(item({ director: ["Christopher Nolan", "Emma Thomas"] }))).toBe("Christopher Nolan, Emma Thomas");
  });

  it("browses a genre in the origin catalog, then the linked catalog, then any same-type catalog", () => {
    const list = catalogs([
      { id: "top", name: "Popular", type: "movie", addon_id: 1, addon_name: "Cinemeta", extra: [{ name: "genre", options: ["Drama", "Action"] }] },
      { id: "top", name: "Popular", type: "movie", addon_id: 4, addon_name: "AIOMetadata", extra: [{ name: "genre", options: ["drama"] }] },
      { id: "plain", name: "Plain", type: "movie", addon_id: 4, extra: [] },
    ]);
    const title = item({ links: [{ name: "Drama", category: "Genres", url: "stremio:///discover/https%3A%2F%2Faiometadata.example%2Fmanifest.json/movie/top?genre=Drama" }] });
    expect(genreTarget(title, "Drama", list, list[0])).toMatchObject({ catalog: list[0], values: { genre: "Drama" } });
    // The link names AIOMetadata's "top", and its declared spelling wins.
    expect(genreTarget(title, "Drama", list, list[2])).toMatchObject({ catalog: list[1], values: { genre: "drama" } });
    expect(genreTarget(item({}), "Action", list)).toMatchObject({ catalog: list[0], values: { genre: "Action" } });
    expect(genreTarget(item({}), "Western", list)).toBeUndefined();
  });
});
