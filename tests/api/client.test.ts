import { describe, expect, it } from "vitest";
import { MemoryDeviceSessionStore, TvApi } from "../../src/api";

type Call = { readonly input: string; readonly init?: RequestInit };
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
    const fake = scripted(response({ device_code: "device-secret", user_code: "AB12CD34EF", verification_uri: "https://viptv.example/device", verification_uri_complete: "https://viptv.example/device?code=AB12CD34EF", qr_uri: "https://viptv.example/api/auth/device/qr?code=AB12CD34EF", expires_in: 600, interval: 5 }));
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher });
    await expect(api.beginPairing("Tizen Living Room")).resolves.toMatchObject({ deviceCode: "device-secret", intervalSeconds: 5 });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ input: "https://viptv.example/api/auth/device/code", init: { method: "POST" } });
    expect(fake.calls[0].init?.body).toBe('{"device_name":"Tizen Living Room"}');
  });

  it("rotates a device grant once and retries the protected request with the new bearer", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({ sessionId: "s1", accountId: "1", profileId: null, accessToken: "old-access", refreshToken: "old-refresh", expiresIn: 900 });
    const fake = scripted(
      response({ error: "expired" }, 401),
      response({ session_id: "s1", account_id: 1, profile_id: null, access_token: "new-access", refresh_token: "new-refresh", expires_in: 900 }),
      response([]),
    );
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher, sessionStore: store });
    await api.restoreSession();
    await expect(api.catalogs()).resolves.toEqual([]);
    expect(fake.calls.map((call) => call.input)).toEqual([
      "https://viptv.example/api/catalogs",
      "https://viptv.example/api/auth/device/refresh",
      "https://viptv.example/api/catalogs",
    ]);
    expect(new Headers(fake.calls[2].init?.headers).get("authorization")).toBe("Bearer new-access");
    await expect(store.load()).resolves.toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh" });
  });

  it("normalizes source cards while removing upstream URLs and authorization headers", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({ sessionId: "s1", accountId: "1", profileId: "3", accessToken: "access", refreshToken: "refresh", expiresIn: 900 });
    const fake = scripted(response({ events: [{ seq: 1, source: "addon:2", streams: [{ id: "stream-1", name: "1080p", title: "Movie 1080p", filename: "movie.mkv", source_addon_id: "addon:2", url: "https://upstream.example/secret.m3u8", headers: { authorization: "Bearer secret" }, behaviorHints: { proxyHeaders: { request: { Authorization: "Bearer secret" } } } }] }], done: true }));
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher, sessionStore: store });
    await api.restoreSession();
    const poll = await api.pollSources("job/1", 0);
    expect(fake.calls[0].input).toBe("https://viptv.example/api/streams/job%2F1?after=0");
    expect(poll.events[0].sources[0]).toMatchObject({ id: "stream-1", sourceAddonId: "addon:2" });
    expect(poll.events[0].sources[0].raw).not.toHaveProperty("url");
    expect(JSON.stringify(poll.events[0].sources[0].raw)).not.toContain("secret");
  });

  it("inherits the series identity for Stremio episode videos that omit it", async () => {
    const store = new MemoryDeviceSessionStore();
    await store.save({ sessionId: "s1", accountId: "1", profileId: "3", accessToken: "access", refreshToken: "refresh", expiresIn: 900 });
    const fake = scripted(response({ meta: { id: "tt-series", type: "series", name: "A Series", videos: [{ id: "tt-series:1:2", title: "Episode Two", season: 1, episode: 2 }] } }));
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher, sessionStore: store });
    await api.restoreSession();
    const detail = await api.detail({ id: "tt-series", type: "series" });
    expect(detail.episodes).toEqual([expect.objectContaining({ id: "tt-series:1:2", type: "series", seriesId: "tt-series" })]);
  });

  it("returns a sanitized error instead of a server or upstream error body", async () => {
    const fake = scripted(response({ error: "https://upstream.example/token=leak", error_code: "source_failed" }, 502));
    const api = new TvApi({ baseUrl: "https://viptv.example", fetch: fake.fetcher });
    await expect(api.beginPairing("TV")).rejects.toEqual(expect.objectContaining({ name: "TvApiError", status: 502, message: "VIPTV could not complete that request", code: "source_failed" }));
  });

  it("requires an HTTPS origin rather than accepting an arbitrary path or HTTP URL", () => {
    expect(() => new TvApi({ baseUrl: "http://viptv.example" })).toThrow("HTTPS origin");
    expect(() => new TvApi({ baseUrl: "https://viptv.example/api" })).toThrow("HTTPS origin");
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
