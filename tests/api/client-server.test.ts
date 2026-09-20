import { describe, expect, it } from "vitest";
import { MemoryDeviceSessionStore, TvApi } from "../../src/api";
import { apiFor, deviceTokens, response, scripted, type Call } from "./client-helpers";



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
