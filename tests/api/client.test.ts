import { describe, expect, it } from "vitest";
import { MemoryDeviceSessionStore, TvApi } from "../../src/api";

type Call = { readonly input: string; readonly init?: RequestInit };
const deviceTokens = {
  sessionId: "s1",
  accountId: "1",
  profileId: null,
  accessToken: "access",
  refreshToken: "refresh",
  expiresIn: 900,
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function apiFor(
  fetcher: typeof fetch,
  sessionStore?: MemoryDeviceSessionStore,
) {
  return new TvApi({
    baseUrl: "https://viptv.example",
    fetch: fetcher,
    sessionStore,
  });
}
function scripted(...replies: Response[]) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    const next = replies.shift();
    if (!next) throw new Error("Unexpected request");
    return next;
  };
  return { calls, fetcher };
}

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
    const poll = await api.pollSources("job/1", 0);
    expect(fake.calls[0].input).toBe(
      "https://viptv.example/api/streams/job%2F1?after=0",
    );
    expect(poll.events[0].sources[0]).toMatchObject({
      id: "stream-1",
      sourceAddonId: "addon:2",
    });
    expect(poll.events[0].sources[0].raw).not.toHaveProperty("url");
    expect(JSON.stringify(poll.events[0].sources[0].raw)).not.toContain(
      "secret",
    );
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

  it("rejects a playback response that attempts to replace the same-origin media capability", async () => {
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
        url: "https://upstream.invalid/private.m3u8",
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

// Server-zone labels must survive the transport boundary: TV locale can differ.
it("preserves guide timeline and programme display labels from the server", async () => {
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
      timezone: "America/New_York",
      timeline: [{ start: 1800000000, display_time: "8:00 PM EDT" }],
      programs: [
        {
          title: "Evening news",
          start: 1800000000,
          end: 1800001800,
          display_time: "8:00 PM EDT",
        },
      ],
    }),
  );
  const api = new TvApi({
    baseUrl: "https://viptv.example",
    fetch: fake.fetcher,
    sessionStore: store,
  });
  await api.restoreSession();
  await expect(api.guide("news")).resolves.toMatchObject({
    timezone: "America/New_York",
    timeline: [{ time: 1800000000, displayTime: "8:00 PM EDT" }],
    programs: [{ raw: { display_time: "8:00 PM EDT" } }],
  });
});

it("preserves episode thumbnail artwork and season zero from metadata", async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({
    sessionId: "s",
    accountId: "1",
    profileId: "3",
    accessToken: "access",
    refreshToken: "refresh",
    expiresIn: 900,
  });
  const fake = scripted(
    response({
      meta: {
        id: "show",
        type: "series",
        name: "Show",
        videos: [
          {
            id: "show:0:1",
            title: "Special",
            season: 0,
            episode: 1,
            thumbnail: "https://images.example/special.jpg",
          },
        ],
      },
    }),
  );
  const api = new TvApi({
    baseUrl: "https://viptv.example",
    fetch: fake.fetcher,
    sessionStore: store,
  });
  await api.restoreSession();
  await expect(
    api.detail({ id: "show", type: "series" }),
  ).resolves.toMatchObject({
    episodes: [{ season: 0, thumbnail: "https://images.example/special.jpg" }],
  });
});

it("loads profile-scoped series history with watched state and stable source intent", async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({
    sessionId: "s",
    accountId: "1",
    profileId: "3",
    accessToken: "access",
    refreshToken: "refresh",
    expiresIn: 900,
  });
  const fake = scripted(
    response([
      {
        id: "show:2:4",
        type: "series",
        series_id: "show / special",
        season: 2,
        episode: 4,
        position: 300,
        duration: 1200,
        watched: false,
        updated_at: 1700000000,
        source_addon_id: "addon-7",
        source_fingerprint: "opaque-fingerprint",
        source_binge_group: "release-family",
      },
    ]),
  );
  const api = new TvApi({
    baseUrl: "https://viptv.example",
    fetch: fake.fetcher,
    sessionStore: store,
  });
  await api.restoreSession();
  const scope = api.createScope();
  await expect(
    api.seriesProgress("3", "show / special", scope.request()),
  ).resolves.toMatchObject([
    {
      id: "show:2:4",
      season: 2,
      episode: 4,
      position: 300,
      duration: 1200,
      watched: false,
      sourceAddonId: "addon-7",
      sourceFingerprint: "opaque-fingerprint",
      sourceBingeGroup: "release-family",
      raw: { updated_at: 1700000000 },
    },
  ]);
  const request = new URL(fake.calls[0].input);
  expect(request.pathname).toBe("/api/profiles/3/progress/series");
  expect(request.searchParams.get("series_id")).toBe("show / special");
  expect(fake.calls[0].init?.signal).toBe(scope.signal);
  expect(new Headers(fake.calls[0].init?.headers).get("authorization")).toBe(
    "Bearer access",
  );
});


describe("LAN preview origin boundary", () => {
  it("keeps HTTP forbidden by default and permits only an explicit same-origin development preview", () => {
    expect(() => new TvApi({ baseUrl: location.origin })).toThrow("HTTPS");
    expect(new TvApi({ baseUrl: location.origin, allowInsecurePreview: true }).serverOrigin).toBe(location.origin);
    expect(() => new TvApi({ baseUrl: "http://different-host.example", allowInsecurePreview: true })).toThrow("HTTPS");
  });
});


describe("shared Rust catalog normalization", () => {
  it("retains catalogs in addon-defined namespaces alongside known media kinds", async () => {
    const fake = scripted(response([
      { id: "extras", type: "other", name: "Other content" },
      { id: "movies", type: "movie", name: "Movies", addon_id: 4 },
      { id: "shows", type: "series", addon_id: 4 },
    ]));
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher });
    const catalogs = await api.catalogs();
    expect(catalogs.map(catalog => catalog.id)).toEqual(["extras", "movies", "shows"]);
    expect(catalogs[2].name).toBe("shows");
  });
});

it('reuses a completed rotation when an older concurrent request returns a late 401', async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 });
  let oldCalls = 0;
  let rotations = 0;
  let releaseLate!: () => void;
  const late = new Promise<void>(resolve => { releaseLate = resolve; });
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: async (input, init) => {
    if (String(input).endsWith('/refresh')) {
      rotations++;
      return response({ session_id: 's', account_id: 1, profile_id: 7, access_token: 'fresh', refresh_token: 'rotated', expires_in: 900 });
    }
    if (new Headers(init?.headers).get('authorization') === 'Bearer old') {
      if (++oldCalls === 2) await late;
      return response({}, 401);
    }
    return response([]);
  } });
  await api.restoreSession();
  const first = api.catalogs();
  const second = api.catalogs();
  await first;
  releaseLate();
  await expect(second).resolves.toEqual([]);
  expect(rotations).toBe(1);
});

it('preserves the durable grant when refresh is forbidden without a definitive revocation', async () => {
  const store = new MemoryDeviceSessionStore();
  const tokens = { sessionId: 's', accountId: '1', profileId: '7', accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 };
  await store.save(tokens);
  const fake = scripted(response({}, 401), response({}, 403));
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: fake.fetcher });
  await api.restoreSession();
  await expect(api.catalogs()).rejects.toMatchObject({ status: 403 });
  await expect(store.load()).resolves.toEqual(tokens);
});

it('keeps addon namespaces distinct from returned playable media types', async () => {
  const fake = scripted(
    response([{ id: 'top', name: 'Anime', type: 'anime.series', addon_id: 4, addon_name: 'AIOMetadata' }]),
    response({ metas: [{ id: 'tt123', name: 'Example', type: 'series' }], has_more: false }),
  );
  const api = new TvApi({ baseUrl: 'https://viptv.example', fetch: fake.fetcher });
  const catalogs = await api.catalogs();
  expect(catalogs).toHaveLength(1);
  expect(catalogs[0]).toMatchObject({ type: 'anime.series', addonName: 'AIOMetadata' });
  const page = await api.discover({ type: catalogs[0].type, catalog: catalogs[0].id, addonId: catalogs[0].addonId });
  expect(new URL(fake.calls[1].input).searchParams.get('type')).toBe('anime.series');
  expect(page.items[0].type).toBe('series');
});

it('approves this browser grant through cookie login and CSRF without storing login credentials', async () => {
  const store = new MemoryDeviceSessionStore();
  const fake = scripted(response({ csrf_token: 'csrf-fixture' }), response({ approved: true }));
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: fake.fetcher });
  await api.browserSignIn(' viewer ', 'password-fixture', 'AB12CD34');
  expect(fake.calls.map(call => new URL(call.input).pathname)).toEqual(['/api/auth/login', '/api/auth/device/approve']);
  expect(JSON.parse(String(fake.calls[0].init?.body))).toEqual({ username: 'viewer', password: 'password-fixture' });
  expect(JSON.parse(String(fake.calls[1].init?.body))).toEqual({ user_code: 'AB12CD34' });
  for (const call of fake.calls) {
    expect(call.init?.credentials).toBe('include');
    expect(call.init?.redirect).toBe('error');
    expect(new Headers(call.init?.headers).has('authorization')).toBe(false);
  }
  expect(new Headers(fake.calls[1].init?.headers).get('x-csrf-token')).toBe('csrf-fixture');
  await expect(store.load()).resolves.toBeNull();
});

it('does not approve a grant after rejected browser login', async () => {
  const fake = scripted(response({ error: 'private upstream details' }, 401));
  const api = new TvApi({ baseUrl: 'https://viptv.example', fetch: fake.fetcher });
  await expect(api.browserSignIn('viewer', 'bad-password', 'AB12CD34')).rejects.toMatchObject({ status: 401, message: 'The username or password is incorrect.' });
  expect(fake.calls).toHaveLength(1);
});

it.each([['anime', 'series'], ['anime.series', 'series'], ['anime.movie', 'movie'], ['collection', 'movie']] as const)(
  'opens %s results using the addon-returned %s metadata type', async (namespace, mediaType) => {
    const fake = scripted(
      response({ metas: [{ id: 'item-fixture', name: 'Example', type: mediaType }], has_more: false }),
      response({ meta: { id: 'item-fixture', name: 'Example', type: mediaType, videos: [{ id: 'child-fixture', title: 'Child', season: 1, episode: 1 }] } }),
    );
    const api = new TvApi({ baseUrl: 'https://viptv.example', fetch: fake.fetcher });
    const page = await api.discover({ type: namespace, catalog: 'fixture', search: 'example' });
    const detail = await api.detail(page.items[0]);
    expect(new URL(fake.calls[0].input).searchParams.get('type')).toBe(namespace);
    expect(new URL(fake.calls[1].input).pathname).toBe(`/api/meta/${mediaType}/item-fixture`);
    expect(detail.episodes[0]).toMatchObject({ id: 'child-fixture', type: mediaType });
  },
);

it('reports unsupported catalog media explicitly and retains valid rows in mixed responses', async () => {
  const fake = scripted(
    response({ metas: [{ id: 'unknown', type: 'custom' }], has_more: false }),
    response({ metas: [{ id: 'unknown', type: 'custom' }, { id: 'known', type: 'movie' }], has_more: false }),
  );
  const api = new TvApi({ baseUrl: 'https://viptv.example', fetch: fake.fetcher });
  await expect(api.discover({ type: 'custom' })).rejects.toMatchObject({ code: 'unsupported_media_type' });
  await expect(api.discover({ type: 'custom' })).resolves.toMatchObject({ items: [{ id: 'known' }], unsupportedCount: 1 });
});
