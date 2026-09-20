import { describe, expect, it } from "vitest";
import { MemoryDeviceSessionStore, TvApi } from "../../src/api";
import { apiFor, deviceTokens, response, scripted, type Call } from "./client-helpers";

describe("TvApi device and media boundary", () => {
  it("decodes declared catalog extras, defaults, genres and bounded option lists", async () => {
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
          id: "calendar",
          name: "Calendar",
          type: "movie",
          addon_id: 2,
          supports_search: true,
          supports_skip: true,
          genres: ["Drama", "Comedy"],
          extra: [
            {
              name: "year",
              is_required: true,
              options: ["2024", "2025"],
              default: "2024",
              options_limit: 2,
            },
            {
              name: "genre",
              is_required: false,
              options: ["Drama", "Comedy"],
              default: null,
              options_limit: 32,
            },
          ],
        },
      ]),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(api.catalogs()).resolves.toEqual([
      expect.objectContaining({
        genres: ["Drama", "Comedy"],
        extras: [
          {
            name: "year",
            required: true,
            options: ["2024", "2025"],
            defaultValue: "2024",
            optionsLimit: 2,
          },
          {
            name: "genre",
            required: false,
            options: ["Drama", "Comedy"],
            defaultValue: undefined,
            optionsLimit: 32,
          },
        ],
      }),
    ]);
  });

  it("normalizes the backend relative media capability to same-origin HTTPS for AVPlay", async () => {
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
        id: "playback-1",
        url: "/media/playback-1/capability/index.m3u8",
        format: "hls",
        mode: "remux",
        video_mode: "copy",
        audio_mode: "copy",
        position: 0,
        live: false,
        duration: 120,
        audio_tracks: [],
        subtitle_tracks: [],
        subtitles_supported: false,
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(
      api.startPlayback({
        streamId: "stream-1",
        capabilities: {
          maxWidth: 1920,
          maxHeight: 1080,
          h264: true,
          hevc: false,
          aac: true,
          directPlay: true,
          hevcSdr: false,
          directMp4: false,
          directHls: true,
        },
      }),
    ).resolves.toMatchObject({
      url: "https://viptv.example/media/playback-1/capability/index.m3u8",
    });
    expect(JSON.parse(String(fake.calls[0].init?.body)).capabilities).toMatchObject({
      direct_mp4: false, direct_hls: true,
    });
  });

  it("keeps a safe playback contract when an older server omits informational fields", async () => {
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
        id: "playback-1",
        url: "/media/playback-1/capability/index.m3u8",
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(
      api.startPlayback({
        streamId: "stream-1",
        capabilities: {
          maxWidth: 1920,
          maxHeight: 1080,
          h264: true,
          hevc: false,
          aac: true,
          directPlay: true,
          hevcSdr: false,
        },
      }),
    ).resolves.toMatchObject({
      format: "hls",
      mode: "direct",
      position: 0,
      audioTracks: [],
      subtitleTracks: [],
    });
  });

  it("rejects a playback response URL that carries embedded credentials", async () => {
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
        id: "playback-1",
        url: "https://user:pass@upstream.invalid/private.m3u8",
        format: "hls",
        mode: "remux",
        video_mode: "copy",
        audio_mode: "copy",
        position: 0,
        live: false,
        duration: 120,
        audio_tracks: [],
        subtitle_tracks: [],
        subtitles_supported: false,
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(
      api.startPlayback({
        streamId: "stream-1",
        capabilities: {
          maxWidth: 1920,
          maxHeight: 1080,
          h264: true,
          hevc: false,
          aac: true,
          directPlay: true,
          hevcSdr: false,
        },
      }),
    ).rejects.toMatchObject({ name: "TvApiError", code: "invalid_response" });
  });

  it("accepts an original absolute source URL with its session authorization", async () => {
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
        id: "playback-1",
        url: "https://provider.invalid/stream.mkv",
        format: "mkv",
        mode: "direct",
        video_mode: "copy",
        audio_mode: "copy",
        position: 0,
        live: false,
        duration: 120,
        audio_tracks: [],
        subtitle_tracks: [],
        subtitles_supported: false,
        authorization: { cookie: "provider-session=1", user_agent: "VIPTV Desktop" },
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    const session = await api.startPlayback({
      streamId: "stream-1",
      capabilities: {
        maxWidth: 1920,
        maxHeight: 1080,
        h264: true,
        hevc: false,
        aac: true,
        directPlay: true,
        hevcSdr: false,
      },
    });
    expect(session.url).toBe("https://provider.invalid/stream.mkv");
    expect(session.authorization).toEqual({ cookie: "provider-session=1", userAgent: "VIPTV Desktop" });
  });

  it("decodes live categories as filters rather than pretending they are playable media", async () => {
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
        total: 1,
        categories: [{ id: "section:News", name: "News", count: 12 }],
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    await expect(api.liveCategories("us")).resolves.toEqual({
      total: 1,
      categories: [
        {
          id: "section:News",
          name: "News",
          count: 12,
          raw: { id: "section:News", name: "News", count: 12 },
        },
      ],
    });
  });

  it("retains the backend continuation episode title separately from its series name", async () => {
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
        status: "next",
        item: {
          id: "tt-series:1:2",
          type: "series",
          name: "Fixture Show",
          episodeTitle: "The Signal",
          series_id: "tt-series",
          season: 1,
          episode: 2,
        },
      }),
    );
    const api = apiFor(fake.fetcher, store);
    await api.restoreSession();
    const current = {
      id: "tt-series:1:1",
      type: "series",
      name: "Fixture Show",
      title: "Fixture Show",
      genres: [], episodes: [],
      raw: {},
    } as const;
    await expect(api.nextEpisode("3", current)).resolves.toMatchObject({
      item: { name: "Fixture Show", episodeTitle: "The Signal" },
    });
  });

  it("returns a sanitized error instead of a server or upstream error body", async () => {
    const fake = scripted(
      response(
        {
          error: "https://upstream.example/token=leak",
          error_code: "source_failed",
        },
        502,
      ),
    );
    const api = apiFor(fake.fetcher);
    await expect(api.beginPairing("TV")).rejects.toEqual(
      expect.objectContaining({
        name: "TvApiError",
        status: 502,
        message: "VIPTV could not complete that request",
        code: "source_failed",
      }),
    );
  });

  it("requires an HTTPS origin rather than accepting an arbitrary path or HTTP URL", () => {
    expect(() => new TvApi({ baseUrl: "http://viptv.example" })).toThrow(
      "HTTPS origin",
    );
    expect(() => new TvApi({ baseUrl: "https://viptv.example/api" })).toThrow(
      "HTTPS origin",
    );
  });

  it("binds the browser default fetch to its global receiver", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    let receiver: unknown;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: function (
        this: typeof globalThis,
        _input: RequestInfo | URL,
        _init?: RequestInit,
      ) {
        receiver = this;
        return Promise.resolve(response([]));
      },
    });
    try {
      await expect(
        new TvApi({ baseUrl: "https://viptv.example" }).catalogs(),
      ).resolves.toEqual([]);
      expect(receiver).toBe(globalThis);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "fetch", descriptor);
      else Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  it("passes a screen scope signal to fetch so a stale screen load can be aborted", async () => {
    let received: AbortSignal | null = null;
    const fetcher: typeof fetch = async (_input, init) => {
      received = init?.signal ?? null;
      return response([]);
    };
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fetcher });
    const scope = api.createScope();
    await api.catalogs(scope.request());
    expect(received).toBe(scope.signal);
    scope.abort();
    expect(scope.signal.aborted).toBe(true);
  });
});
