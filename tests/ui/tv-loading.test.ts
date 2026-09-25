import { describe, expect, it, vi } from "vitest";
import type { Catalog, MediaItem, TvApi } from "../../src/api";
import { loadHomeView, loadHomeShelves } from "../../src/tv-solid/homeModel";
import { loadDetailView } from "../../src/tv-solid/detailModel";

const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const item = { id: "tt1", type: "movie", name: "A title", title: "A title", genres: [], episodes: [], raw: {} } as MediaItem;

describe("TV progressive Home", () => {
  it("loads episode progress alongside metadata and retains every season", async () => {
    const metadata = deferred<Awaited<ReturnType<TvApi["detail"]>>>();
    const episode = { ...item, id: "tt-series:1:1", type: "episode", seriesId: "tt-series", season: 1, episode: 1, position: 4, duration: 1000 } as MediaItem;
    const api = { detail: vi.fn(() => metadata.promise), seriesProgress: vi.fn(async () => [episode]) };
    const pending = loadDetailView(api as unknown as TvApi, episode, "1", [], new AbortController().signal);
    expect(api.seriesProgress).toHaveBeenCalledTimes(1);
    metadata.resolve({ item: { ...item, id: "tt-series", type: "series" }, episodes: [
      { ...episode, position: 0 },
      { ...episode, id: "tt-series:2:1", season: 2, position: 0 },
    ] });
    const view = await pending;
    expect(view.target?.position).toBe(4);
    expect(view.episodes).toHaveLength(1);
    expect(view.allEpisodes).toHaveLength(2);
  });
  it("publishes the queue before slow favorites and never fetches unused progress or duplicate live/catalogue data", async () => {
    const favorites = deferred<MediaItem[]>();
    const api = { queue: vi.fn(async () => ({ items: [item] })), favorites: vi.fn(() => favorites.promise) };
    const update = vi.fn();
    const loaded = loadHomeView(api as unknown as TvApi, "1", new AbortController().signal, update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0].heroItem.id).toBe("tt1");
    favorites.resolve([item]);
    expect((await loaded).favoriteItems).toHaveLength(1);
    expect(api.queue).toHaveBeenCalledTimes(1);
    expect(api.favorites).toHaveBeenCalledTimes(1);
  });

  it("publishes fast shelves while another catalogue is pending and ignores results after cancellation", async () => {
    const stalled = deferred<{ items: MediaItem[] }>();
    const catalogs = ["slow", "fast"].map(id => ({ id, type: "movie", name: id, filters: [], extras: [], genres: [] })) as unknown as Catalog[];
    const api = {
      catalogs: vi.fn(async () => catalogs),
      live: vi.fn(async () => ({ channels: [] })),
      discover: vi.fn(request => request.catalog === "slow" ? stalled.promise : Promise.resolve({ items: [item] })),
    };
    const controller = new AbortController();
    const update = vi.fn();
    const loaded = loadHomeShelves(api as unknown as TvApi, controller.signal, update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0].title).toBe("fast");
    expect(api.discover).toHaveBeenCalledTimes(2);
    controller.abort();
    stalled.resolve({ items: [item] });
    await loaded;
    expect(update).toHaveBeenCalledTimes(1);
  });
});
