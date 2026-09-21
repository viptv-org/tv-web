import { describe, expect, it } from "vitest";
import { MemoryDeviceSessionStore, TvApi } from "../../src/api";
import { apiFor, deviceTokens, response, scripted, type Call } from "./client-helpers";


describe("TvApi device and media boundary", () => {
  it("uses the existing device-pairing wire contract", async () => {
    const fake = scripted(
      response({
        device_code: "device-secret",
        user_code: "AB12CD34EF",
        verification_uri: "https://viptv.example/device",
        verification_uri_complete:
          "https://viptv.example/device?code=AB12CD34EF",
        qr_uri: "https://viptv.example/api/auth/device/qr?code=AB12CD34EF",
        expires_in: 600,
        interval: 5,
      }),
    );
    const api = apiFor(fake.fetcher);
    await expect(api.beginPairing("Tizen Living Room")).resolves.toMatchObject({
      deviceCode: "device-secret",
      intervalSeconds: 5,
    });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({
      input: "https://viptv.example/api/auth/device/code",
      init: { method: "POST" },
    });
    expect(fake.calls[0].init?.body).toBe(
      '{"device_name":"Tizen Living Room"}',
    );
  });

  it("rotates a device grant once and retries the protected request with the new bearer", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({
      sessionId: "s1",
      accountId: "1",
      profileId: null,
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresIn: 900,
    });
    const fake = scripted(
      response({ error: "expired" }, 401),
      response({
        session_id: "s1",
        account_id: 1,
        profile_id: null,
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 900,
      }),
      response([]),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(api.catalogs()).resolves.toEqual([]);
    expect(fake.calls.map((call) => call.input)).toEqual([
      "https://viptv.example/api/catalogs",
      "https://viptv.example/api/auth/device/refresh",
      "https://viptv.example/api/catalogs",
    ]);
    expect(new Headers(fake.calls[2].init?.headers).get("authorization")).toBe(
      "Bearer new-access",
    );
    await expect(store.load()).resolves.toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("keeps the device grant when protected sign-out is rejected or cannot reach the server", async () => {
    const token = {
      sessionId: "s1",
      accountId: "1",
      profileId: "3",
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    };
    const forbiddenStore = new MemoryDeviceSessionStore();
    await forbiddenStore.save(token);
    const forbidden = scripted(response({ error: "parent PIN required" }, 403));
    const forbiddenApi = apiFor(forbidden.fetcher, forbiddenStore);
    await forbiddenApi.restoreSession();
    await expect(forbiddenApi.signOut()).rejects.toMatchObject({
      name: "TvApiError",
      status: 403,
    });
    await expect(forbiddenStore.load()).resolves.toEqual(token);
    await expect(forbiddenApi.restoreSession()).resolves.toEqual(token);

    const offlineStore = new MemoryDeviceSessionStore();
    await offlineStore.save(token);
    const offlineApi = new TvApi({
      baseUrl: "https://viptv.example",
      fetch: async () => {
        throw new TypeError("offline");
      },
      sessionStore: offlineStore,
    });
    await offlineApi.restoreSession();
    await expect(offlineApi.signOut()).rejects.toMatchObject({
      name: "TvApiError",
      status: 0,
      code: "network",
    });
    await expect(offlineStore.load()).resolves.toEqual(token);
    await expect(offlineApi.restoreSession()).resolves.toEqual(token);
  });

  it("normalizes source cards while removing upstream URLs and authorization headers", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({
      sessionId: "s1",
      accountId: "1",
      profileId: "3",
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    });
    const fake = scripted(
      response({
        events: [
          {
            seq: 1,
            source: "addon:2",
            streams: [
              {
                id: "stream-1",
                name: "1080p",
                title: "Movie 1080p",
                filename: "movie.mkv",
                source_addon_id: "addon:2",
                url: "https://upstream.example/secret.m3u8",
                headers: { authorization: "Bearer secret" },
                behaviorHints: {
                  proxyHeaders: { request: { Authorization: "Bearer secret" } },
                },
              },
            ],
          },
        ],
        done: true,
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    const step = await api.pollSourcesStep("job/1", { after: 0, sources: [], polls: 0 });
    expect(fake.calls[0].input).toBe(
      "https://viptv.example/api/streams/job%2F1?after=0",
    );
    expect(step.sources[0]).toMatchObject({
      id: "stream-1",
      sourceAddonId: "addon:2",
    });
    expect(step.sources[0].raw).not.toHaveProperty("url");
    expect(JSON.stringify(step.sources[0].raw)).not.toContain(
      "secret",
    );
    expect(step.done).toBe(true);
  });

  it("inherits the series identity for Stremio episode videos that omit it", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({
      sessionId: "s1",
      accountId: "1",
      profileId: "3",
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    });
    const fake = scripted(
      response({
        meta: {
          id: "tt-series",
          type: "series",
          name: "A Series",
          videos: [
            {
              id: "tt-series:1:2",
              title: "Episode Two",
              season: 1,
              episode: 2,
            },
          ],
        },
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    const detail = await api.detail({ id: "tt-series", type: "series" });
    expect(detail.episodes).toEqual([
      expect.objectContaining({
        id: "tt-series:1:2",
        type: "series",
        seriesId: "tt-series",
      }),
    ]);
  });

  it("uses the requested kind when an actual Stremio meta envelope omits meta.type", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({
      sessionId: "s1",
      accountId: "1",
      profileId: "3",
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    });
    const fake = scripted(
      response({
        meta: { id: "tt-movie", name: "A Movie", poster: "poster.jpg" },
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(
      api.detail({ id: "tt-movie", type: "movie" }),
    ).resolves.toMatchObject({
      item: { id: "tt-movie", type: "movie", name: "A Movie" },
    });
  });

  it("preserves the server kids policy field on profiles", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({
      sessionId: "s1",
      accountId: "1",
      profileId: "3",
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    });
    const fake = scripted(
      response([
        {
          id: 3,
          name: "Kids",
          avatar_style: "moods",
          avatar_choice: 2,
          kids: true,
          max_age: 10,
          setup_complete: true,
        },
      ]),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(api.profiles()).resolves.toEqual([
      expect.objectContaining({ id: "3", kid: true, setupComplete: true }),
    ]);
  });

});
