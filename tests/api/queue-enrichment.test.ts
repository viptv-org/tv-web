import { describe, expect, it, vi } from "vitest";
import { TvApi, TvApiError, type MediaItem } from "../../src/api";

const item = (id: string): MediaItem => ({ id, type: "movie", name: id, title: id, genres: [], episodes: [], raw: {}, position: 60, duration: 1000, sourceAddonId: "addon:1", sourceFingerprint: "exact" });
function fixture(count = 5) {
  const api = new TvApi({ baseUrl: "https://viptv.example", fetch: async () => new Response(JSON.stringify({
    items: Array.from({ length: count }, (_, index) => ({ id: String(index), type: "movie", name: String(index), position: 60, duration: 1000, source_addon_id: "addon:1", source_fingerprint: "exact" })),
    offset: 0, total: count, next_offset: null,
  }), { status: 200 }) });
  return api;
}
describe("queue metadata hydration", () => {
  it("publishes saved rows before metadata and updates only after each response without a duplicate request", async () => {
    const api = fixture(1);
    let complete!: () => void;
    const details = vi.spyOn(api, "detail").mockImplementation(async source => {
      await new Promise<void>(resolve => { complete = resolve; });
      return { item: { ...item(source.id), background: "https://images.example/art.jpg" }, episodes: [] };
    });
    const onPage = vi.fn();
    const pending = api.queue("profile", undefined, { onPage });
    await vi.waitFor(() => expect(details).toHaveBeenCalledTimes(1));
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage.mock.calls[0][0].items[0]).toMatchObject({ id: "0", position: 60 });
    complete();
    await pending;
    expect(onPage).toHaveBeenCalledTimes(2);
    expect(onPage.mock.calls[1][0].items[0].background).toBe("https://images.example/art.jpg");
    expect(details).toHaveBeenCalledTimes(1);
  });
  it("bounds requests, keeps order and preserves resumable rows when optional metadata fails", async () => {
    const api = fixture();
    let active = 0, peak = 0;
    const releases: (() => void)[] = [];
    const details = vi.spyOn(api, "detail").mockImplementation(async source => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>(resolve => releases.push(resolve));
      active--;
      if (source.id === "1") throw new TvApiError(500, "Unavailable");
      return { item: { ...item(source.id), position: 0, background: `https://images.example/${source.id}.jpg` }, episodes: [] };
    });
    const pending = api.queue("profile");
    await vi.waitFor(() => expect(details).toHaveBeenCalledTimes(3));
    releases.splice(0).forEach(release => release());
    await vi.waitFor(() => expect(details).toHaveBeenCalledTimes(5));
    releases.splice(0).forEach(release => release());
    const result = await pending;
    expect(peak).toBe(3);
    expect(result.items.map(row => row.id)).toEqual(["0", "1", "2", "3", "4"]);
    expect(result.items[0]).toMatchObject({ position: 60, sourceAddonId: "addon:1", sourceFingerprint: "exact", background: "https://images.example/0.jpg" });
    expect(result.items[1]).toMatchObject({ position: 60, sourceFingerprint: "exact" });
  });
  it("propagates caller cancellation to every in-flight detail and schedules no later rows", async () => {
    const api = fixture();
    const parent = new AbortController();
    const signals: AbortSignal[] = [];
    vi.spyOn(api, "detail").mockImplementation((_source, options) => new Promise((_resolve, reject) => {
      const signal = options!.signal!;
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    }));
    const pending = api.queue("profile", undefined, { signal: parent.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(signals).toHaveLength(3));
    parent.abort();
    await rejected;
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(signals).toHaveLength(3);
  });
});
