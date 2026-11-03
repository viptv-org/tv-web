import { describe, expect, it, vi } from "vitest";
import { TvApi } from "../../src/api";
import { apiFor, response, scripted } from "./client-helpers";

/**
 * The backend deleted every versioned prefix (`ea82f19`), so the transport's
 * own request literals must stay unversioned. These assertions pin the wire
 * paths; without them a retired `/api/v2/...` string silently 404s against
 * every deployed server.
 */

const pathOf = (call: { readonly input: string }) => new URL(call.input).pathname;

const series = { id: "show", kind: "series", ids: [], episode: null, edition: null };
const episode = { id: "show:1:2", kind: "series", ids: [], edition: null, episode: { order: "aired", season: 1, episode: 2 } };

function entry(status = "Resume", previous: unknown = null) {
  return {
    card: {
      identity: episode,
      provider_id: "addon:4",
      title: "Fixture Show",
      subtitle: "S1 E2 · 10m left",
      description: "A fixture series.",
      poster: "https://art.example/poster.jpg",
      landscape: "https://art.example/landscape.jpg",
      logo: "https://art.example/logo.png",
      progress: 0.4,
      badges: [],
      parent_identity: series,
    },
    record: {
      identity: episode,
      provider_id: "addon:4",
      title: "Fixture Show",
      position_millis: 600_000,
      duration_millis: 1_500_000,
      updated_at_millis: 1_700_000_000_000,
      parent_identity: series,
    },
    status,
    previous_identity: previous,
  };
}

const continuationPage = (entries: unknown[], nextCursor: string | null = null) => ({
  scope: { kind: "viptv:remote", account: "1", profile: "1", generation: 1 },
  revision: 1,
  entries,
  next_cursor: nextCursor,
  complete: nextCursor === null,
});

describe("React transport wire paths", () => {
  it("reads and writes addons on the unversioned route", async () => {
    const fake = scripted(
      response({ items: [], next_cursor: null }),
      response({ id: 4, manifest_url: "https://addon.example/manifest.json" }),
      response({ id: 4, manifest_url: "https://addon.example/manifest.json" }),
      response({}),
    );
    const api = apiFor(fake.fetcher);
    await expect(api.addons()).resolves.toEqual([]);
    await api.addAddon("https://addon.example/manifest.json");
    await api.updateAddon("4", { enabled: true });
    await api.deleteAddon("4");
    expect(fake.calls.map(call => `${call.init?.method ?? "GET"} ${pathOf(call)}`)).toEqual([
      "GET /api/addons",
      "POST /api/addons",
      "PATCH /api/addons/4",
      "DELETE /api/addons/4",
    ]);
    expect(JSON.parse(String(fake.calls[1].init?.body))).toEqual({ manifest_url: "https://addon.example/manifest.json" });
  });

  it("pages Continue Watching through the cursor envelope", async () => {
    const fake = scripted(response(continuationPage([entry()], "40")));
    const api = apiFor(fake.fetcher);
    vi.spyOn(api, "detail").mockResolvedValue({ item: { id: "show:1:2", type: "series", name: "Fixture Show", title: "Fixture Show", genres: [], episodes: [], raw: {} }, episodes: [] });
    const page = await api.queue("1");
    expect(fake.calls[0].input).toBe("https://viptv.example/api/profiles/1/continue?limit=40");
    expect(page.nextCursor).toBe("40");
    expect(page.items[0]).toMatchObject({
      id: "show:1:2",
      type: "series",
      name: "Fixture Show",
      seriesId: "show",
      season: 1,
      episode: 2,
      position: 600,
      duration: 1500,
      queueStatus: "resume",
      sourceAddonId: "addon:4",
      poster: "https://art.example/poster.jpg",
    });
  });

  it("requests the next page with the cursor the server returned", async () => {
    const fake = scripted(response(continuationPage([])));
    const api = apiFor(fake.fetcher);
    // An empty page performs no metadata work, so `detail` is never reached.
    await api.queue("1", "40");
    expect(fake.calls[0].input).toBe("https://viptv.example/api/profiles/1/continue?offset=40&limit=40");
  });

  it("keeps the previous episode of a caught-up row so Resume can finish it", async () => {
    const previous = { id: "show:1:1", kind: "series", ids: [], edition: null, episode: { order: "aired", season: 1, episode: 1 } };
    const fake = scripted(response(continuationPage([entry("Next", previous)])));
    const api = apiFor(fake.fetcher);
    vi.spyOn(api, "detail").mockResolvedValue({ item: { id: "show:1:3", type: "series", name: "Fixture Show", title: "Fixture Show", genres: [], episodes: [], raw: {} }, episodes: [] });
    const page = await api.queue("1");
    expect(page.items[0]).toMatchObject({
      queueStatus: "next",
      previousEpisode: { id: "show:1:1", type: "series", seriesId: "show", season: 1, episode: 1 },
    });
  });

  it("reads recently watched from the profile history page, not the PUT-only progress route", async () => {
    const fake = scripted(response({
      items: [{ id: "movie-1", type: "movie", name: "A Movie", position: 120, duration: 6000 }],
      offset: 0,
      total: 1,
      next_offset: null,
    }));
    const api = apiFor(fake.fetcher);
    await expect(api.progress("1")).resolves.toMatchObject([{ id: "movie-1", type: "movie", position: 120 }]);
    expect(fake.calls[0].input).toBe("https://viptv.example/api/profiles/1/progress/page");
    expect(fake.calls[0].init?.method ?? "GET").toBe("GET");
  });
});

it("no longer exposes the retired continue/settings client path", () => {
  const api = apiFor(async () => response({}));
  expect("queueSettings" in api).toBe(false);
  expect("saveQueueSettings" in api).toBe(false);
  expect(api instanceof TvApi).toBe(true);
});