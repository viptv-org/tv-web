import { describe, it, expect, vi } from "vitest";
import {
  RemoteTvApi,
  requestUuid,
  RemoteError,
  type SessionStore,
} from "../../src/tv-solid/remote/api";
import type { Tokens, Card } from "../../src/tv-solid/remote/types";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
it("retiring a profile rejects an in-flight response even without an AbortSignal", async () => {
  let finish!: (value: Response) => void;
  const api = new RemoteTvApi(
    "https://example.test",
    store(),
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  api.profile = "1";
  const pending = api.call("/api/discover");
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  api.retireProfile();
  finish(response({ cards: [card] }));
  await rejected;
  expect(api.profile).toBe("");
});
function store(
  initial: Tokens | null = { accessToken: "old", refreshToken: "refresh-old" },
) {
  let value = initial;
  return {
    load: vi.fn(async () => value),
    save: vi.fn(async (tokens: Tokens) => {
      value = tokens;
    }),
    clear: vi.fn(async () => {
      value = null;
    }),
  } satisfies SessionStore;
}
const card: Card = {
  identity: { kind: "movie", id: "title", ids: [] },
  provider_id: "stremio",
  title: "Title",
  badges: [],
};
it.each(["web", "tizen", "vizio", "webos"] as const)(
  "reports the %s platform in decoder admission facts",
  async (platform) => {
    const fetcher = vi.fn(async () =>
      response({
        id: "lease",
        status: "ready",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        renew_after_seconds: 20,
        delivery: {
          kind: "gateway",
          url: "https://media.example/video.m3u8",
          format: "hls",
        },
      }),
    );
    const api = new RemoteTvApi(
      "https://example.test",
      store(),
      fetcher,
      platform,
    );
    await api.admit(
      { id: "server-source" },
      false,
      new AbortController().signal,
    );
    const calls = fetcher.mock.calls as unknown as [
      RequestInfo | URL,
      RequestInit,
    ][];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.client.platform).toBe(platform);
    expect(body.client.native_torrent).toBeUndefined();
  },
);
it("stops reading an oversized streamed response before allocating the whole body", async () => {
  let pulls = 0,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(64 * 1024).fill(32));
        if (pulls === 100) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const body = new Response(stream);
  const api = new RemoteTvApi(
    "https://example.test",
    store(),
    vi.fn(async () => body),
  );
  await expect(api.call("/api/bootstrap")).rejects.toMatchObject({
    code: "invalid_response",
  });
  expect(cancelled).toBe(true);
  expect(pulls).toBeLessThanOrEqual(65);
});

it("decodes UTF-8 split across streamed chunks without changing snapshot text", async () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ title: "映画 · Épisodes" }),
  );
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length)
        controller.enqueue(bytes.slice(offset, ++offset));
      else controller.close();
    },
  });
  const api = new RemoteTvApi(
    "https://example.test",
    store(),
    vi.fn(async () => new Response(stream)),
  );
  await expect(api.call("/api/bootstrap")).resolves.toEqual({
    title: "映画 · Épisodes",
  });
});
describe("server-only TV transport", () => {
  it("requires an HTTPS origin and rejects API URL escapes", async () => {
    expect(() => new RemoteTvApi("http://example.test", store())).toThrow();
    const api = new RemoteTvApi("https://example.test", store(), vi.fn());
    await expect(api.call("https://other.test/api")).rejects.toThrow(
      "Invalid API path",
    );
  });
  it("coalesces concurrent refreshes and retries with the rotated bearer", async () => {
    const storage = store();
    let rotations = 0;
    const fetcher = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).endsWith("/refresh")) {
          rotations++;
          await Promise.resolve();
          return response({
            access_token: "new",
            refresh_token: "refresh-new",
          });
        }
        return (init?.headers as Record<string, string>).Authorization ===
          "Bearer new"
          ? response({ ok: true })
          : response({}, 401);
      },
    );
    const api = new RemoteTvApi("https://example.test", storage, fetcher);
    await api.restore();
    expect(
      await Promise.all([api.call("/api/one"), api.call("/api/two")]),
    ).toEqual([{ ok: true }, { ok: true }]);
    expect(rotations).toBe(1);
    expect(storage.save).toHaveBeenCalledTimes(1);
  });
  it("preserves durable authentication when refresh fails transiently", async () => {
    const storage = store();
    const api = new RemoteTvApi(
      "https://example.test",
      storage,
      vi.fn(async (url) =>
        String(url).endsWith("/refresh")
          ? response({}, 503)
          : response({}, 401),
      ),
    );
    await api.restore();
    await expect(api.call("/api/bootstrap")).rejects.toBeInstanceOf(
      RemoteError,
    );
    expect(storage.clear).not.toHaveBeenCalled();
  });
  it("clears rejected refresh credentials but does not erase them on denied sign-out", async () => {
    const storage = store();
    const api = new RemoteTvApi(
      "https://example.test",
      storage,
      vi.fn(async () => response({}, 403)),
    );
    await api.restore();
    await expect(api.signOut()).rejects.toMatchObject({ status: 403 });
    expect(storage.clear).not.toHaveBeenCalled();
    const rejected = new RemoteTvApi(
      "https://example.test",
      storage,
      vi.fn(async () => response({}, 401)),
    );
    await rejected.restore();
    await expect(rejected.call("/api/bootstrap")).rejects.toMatchObject({
      status: 401,
    });
    expect(storage.clear).toHaveBeenCalledTimes(1);
  });
  it("passes explicit intent to the server without deriving an episode or resume offset", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        response({
          card,
          label: "Resume",
          resume: true,
          source_selection: "best",
        }),
    );
    const api = new RemoteTvApi("https://example.test", store(), fetcher);
    api.profile = "3";
    const result = await api.titleAction(card);
    expect(result.resume).toBe(true);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://example.test/api/profiles/3/viewing-action",
    );
    expect(
      JSON.parse(
        (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .body as string,
      ),
    ).toEqual({ card, restart: false });
  });
  it("preserves server source ranking and cancels an unfinished discovery", async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const fetcher = vi.fn(
      async (url: RequestInfo | URL, _init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        calls.push(path);
        if (path === "/api/streams") return response({ id: "job" });
        if (path.endsWith("/source-ranking"))
          return response({ streams: [{ id: "b" }, { id: "a" }] });
        return response({
          events: [{ streams: [{ id: "a" }, { id: "b" }] }],
          done: false,
        });
      },
    );
    const api = new RemoteTvApi("https://example.test", store(), fetcher);
    api.profile = "1";
    let ranked: string[] = [];
    await expect(
      api.sources(
        card,
        (value) => {
          ranked = value.map((s) => s.id);
          controller.abort();
        },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(ranked).toEqual(["b", "a"]);
    expect(
      fetcher.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(true);
  });
  it("releases ambiguous playback admission using its request id", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const api = new RemoteTvApi(
      "https://example.test",
      store(),
      vi.fn(async (url, init) => {
        calls.push({ url: String(url), init });
        if (init?.method === "POST") throw new TypeError("Network failed");
        return response({});
      }),
    );
    await expect(
      api.admit({ id: "source" }, true, new AbortController().signal),
    ).rejects.toThrow("Network failed");
    expect(calls[1].url).toMatch(/\/api\/playback-requests\//);
    expect(calls[1].init?.method).toBe("DELETE");
    const request = JSON.parse(calls[0].init?.body as string);
    expect(request.client.can_play_direct).toBe(false);
    expect(request.client.native_torrent).toBeUndefined();
    expect(request.resume).toBe(true);
  });
  it("never follows a media capability for lease control", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        response({
          id: "lease",
          status: "ready",
          renew_after_seconds: 20,
          delivery: { kind: "gateway", url: "http://insecure.test/media" },
        }),
    );
    const api = new RemoteTvApi("https://example.test", store(), fetcher);
    await expect(
      api.admit({ id: "source" }, true, new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_delivery" });
    expect(
      fetcher.mock.calls.every(([url]) =>
        String(url).startsWith("https://example.test/api/"),
      ),
    ).toBe(true);
  });
});

it.each([200, 401, 403, 409, 503])(
  "rejects a late HTTP %i response from a retired profile scope",
  async (status) => {
    let resolveSlow!: (value: Response) => void;
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith("/slow")
        ? new Promise<Response>((resolve) => {
            resolveSlow = resolve;
          })
        : String(url).endsWith("/bootstrap")
          ? response({
              contract_version: 3,
              identity: { profile_id: "2" },
              profile_management: { profiles: [] },
            })
          : response({}),
    );
    const api = new RemoteTvApi("https://example.test", store(), fetcher);
    await api.restore();
    const pending = api.call("/api/slow");
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await api.selectProfile("2");
    resolveSlow(response({ private: "old-profile" }, status));
    await rejected;
  },
);

it("ignores a failed refresh after its initiating profile is retired", async () => {
  let finishRefresh!: (value: Response) => void;
  let started!: () => void;
  const refreshStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const storage = store();
  const api = new RemoteTvApi(
    "https://example.test",
    storage,
    vi.fn(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/slow") return response({}, 401);
      if (path.endsWith("/refresh"))
        return new Promise<Response>((resolve) => {
          finishRefresh = resolve;
          started();
        });
      if (path.endsWith("/bootstrap"))
        return response({
          contract_version: 3,
          identity: { profile_id: "2" },
          profile_management: { profiles: [] },
        });
      return response({});
    }),
  );
  await api.restore();
  const pending = api.call("/api/slow");
  const assertion = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await refreshStarted;
  await api.selectProfile("2");
  finishRefresh(response({}, 503));
  await assertion;
  expect(storage.clear).not.toHaveBeenCalled();
  expect(api.profile).toBe("2");
});

it("persists a consumed refresh rotation across a profile change while rejecting its old data request", async () => {
  let finishRefresh!: (value: Response) => void;
  let started!: () => void;
  const refreshStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const storage = store();
  const api = new RemoteTvApi(
    "https://example.test",
    storage,
    vi.fn(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/api/slow") return response({}, 401);
      if (path.endsWith("/refresh"))
        return new Promise<Response>((resolve) => {
          finishRefresh = resolve;
          started();
        });
      if (path.endsWith("/bootstrap"))
        return response({
          contract_version: 3,
          identity: { profile_id: "2" },
          profile_management: { profiles: [] },
        });
      return response({});
    }),
  );
  await api.restore();
  const assertion = expect(api.call("/api/slow")).rejects.toMatchObject({
    name: "AbortError",
  });
  await refreshStarted;
  await api.selectProfile("2");
  finishRefresh(
    response({
      access_token: "rotated",
      refresh_token: "consumed-old-replacement",
    }),
  );
  await assertion;
  expect(await storage.load()).toMatchObject({
    accessToken: "rotated",
    refreshToken: "consumed-old-replacement",
  });
});

it.each([200, 401])(
  "a retired authentication session's HTTP %i refresh cannot overwrite a new pairing grant",
  async (status) => {
    let finishRefresh!: (value: Response) => void;
    let started!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const storage = store();
    const api = new RemoteTvApi(
      "https://example.test",
      storage,
      vi.fn(async (url) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/refresh"))
          return new Promise<Response>((resolve) => {
            finishRefresh = resolve;
            started();
          });
        if (path.endsWith("/token"))
          return response({
            access_token: "new-session",
            refresh_token: "new-session-refresh",
          });
        return response({}, 401);
      }),
    );
    await api.restore();
    const assertion = expect(api.call("/api/slow")).rejects.toMatchObject({
      name: "AbortError",
    });
    await refreshStarted;
    await api.claim("pairing-code");
    finishRefresh(
      response(
        { access_token: "retired-session", refresh_token: "retired-refresh" },
        status,
      ),
    );
    await assertion;
    expect(await storage.load()).toMatchObject({
      accessToken: "new-session",
      refreshToken: "new-session-refresh",
    });
    expect(storage.clear).not.toHaveBeenCalled();
  },
);

it("ignores a failed request from an aborted navigation even when the transport has already received it", async () => {
  let finish!: (value: Response) => void;
  const api = new RemoteTvApi(
    "https://example.test",
    store(),
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const scope = new AbortController();
  const pending = api.call("/api/catalog", "GET", undefined, scope.signal);
  const assertion = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  scope.abort();
  finish(response({}, 403));
  await assertion;
});

it("cancels a view immediately while its shared refresh finishes and persists independently", async () => {
  let finish!: (value: Response) => void, started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const storage = store(),
    scope = new AbortController();
  const api = new RemoteTvApi(
    "https://example.test",
    storage,
    vi.fn(async (url) => {
      if (String(url).endsWith("/refresh"))
        return new Promise<Response>((resolve) => {
          finish = resolve;
          started();
        });
      return response({}, 401);
    }),
  );
  await api.restore();
  const assertion = expect(
    api.call("/api/old-view", "GET", undefined, scope.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  await began;
  scope.abort();
  await assertion;
  finish(
    response({ access_token: "rotated", refresh_token: "rotated-refresh" }),
  );
  await vi.waitFor(() => expect(storage.save).toHaveBeenCalledOnce());
  expect(await storage.load()).toMatchObject({
    refreshToken: "rotated-refresh",
  });
}, 1000);
it("consumes the Live action and server ranking without inventing a discovery job", async () => {
  const action = {
    card,
    label: "Watch live",
    resume: false,
    source_selection: "best",
  };
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/source-ranking")
      ? response({
          streams: [{ id: "live-b" }, { id: "live-a" }],
          best_match_id: "live-a",
          quality_filters: [],
          total: 2,
        })
      : response({
          streams: [{ id: "live-a" }, { id: "live-b" }],
          live: true,
          action,
        }),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  api.profile = "1";
  const publish = vi.fn();
  expect(
    await api.sources(card, publish, new AbortController().signal, "channel"),
  ).toEqual([{ id: "live-b" }, { id: "live-a" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls[0][1]).toMatchObject({
    action,
    best_match_id: "live-a",
  });
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
    "https://example.test/api/profiles/1/live/channel/sources",
    "https://example.test/api/profiles/1/source-ranking",
  ]);
});

it("does not invent a Live resume or selection policy for an older response", async () => {
  const api = new RemoteTvApi("https://example.test", store(), async () =>
    response({ streams: [{ id: "live-a" }], live: true }),
  );
  api.profile = "1";
  const publish = vi.fn();
  await expect(
    api.sources(card, publish, new AbortController().signal, "channel"),
  ).rejects.toMatchObject({ code: "unsupported_live_action" });
  expect(publish).not.toHaveBeenCalled();
});

it("release has an independent deadline while shared authentication refresh continues", async () => {
  vi.useFakeTimers();
  try {
    let rotate!: (response: Response) => void;
    const storage = store();
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith("/refresh")
        ? new Promise<Response>((resolve) => {
            rotate = resolve;
          })
        : response({}, 401),
    );
    const api = new RemoteTvApi("https://example.test", storage, fetcher);
    await api.restore();
    let released = false;
    const task = api.release("/api/playback/old").then(() => {
      released = true;
    });
    await vi.advanceTimersByTimeAsync(5000);
    await task;
    expect(released).toBe(true);
    expect(storage.clear).not.toHaveBeenCalled();
    rotate(response({ access_token: "new", refresh_token: "rotated" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.save).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("creates secure request ids on Chrome 87 without randomUUID", () => {
  const original = globalThis.crypto;
  try {
    vi.stubGlobal("crypto", {
      getRandomValues: original.getRandomValues.bind(original),
    });
    expect(requestUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(requestUuid()).not.toBe(requestUuid());
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps metadata lookup selectors free of artwork and long synopsis fields", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    response({}),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  const origin = {
    provider_id: "stremio",
    connection_id: "addon:1",
    incarnation: "a".repeat(32),
  };
  await api.detail({
    ...card,
    metadata_origin: origin,
    description: "Long synopsis ".repeat(1000),
    landscape: "https://images.example/private-path.jpg",
  });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  const selector = JSON.parse(url.searchParams.get("card")!);
  expect(selector.identity).toEqual(card.identity);
  expect(selector.metadata_origin).toEqual(origin);
  expect(selector.description).toBeUndefined();
  expect(selector.landscape).toBeUndefined();
  expect(url.href.length).toBeLessThan(1500);
});

it("Live pages require an opaque server snapshot and retain it unchanged", async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
    response({
      channels: [],
      groups: [],
      complete: true,
      availability: "Available",
    }),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  api.profile = "1";
  await expect(api.live()).rejects.toThrow("channel snapshot");
  fetcher.mockImplementation(async (input) => {
    const url = new URL(String(input));
    return response({
      snapshot_id: "server-owned-scope",
      channels: [],
      groups: [],
      complete: true,
      availability: "Available",
      paging: {
        origin: url.searchParams.get("offset"),
        limit: 40,
        page_size: 40,
        previous: null,
        next: null,
      },
    });
  });
  expect((await api.live()).snapshot_id).toBe("server-owned-scope");
  await api.live("10040", "news", undefined, "Large");
  const url = new URL(String(fetcher.mock.calls.at(-1)?.[0]));
  expect(url.searchParams.get("offset")).toBe("10040");
  expect(url.searchParams.get("search")).toBe("Large");
});

it("copies server channel request limits and navigation budgets without cursor arithmetic", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    return response({
      snapshot_id: "server-scope",
      channels: [],
      groups: [],
      complete: true,
      availability: "Available",
      next_cursor: "unused-legacy-value",
      paging: {
        origin: url.searchParams.get("offset"),
        limit: Number(url.searchParams.get("limit")),
        page_size: Number(url.searchParams.get("page_size")),
        previous: null,
        next: null,
      },
    });
  });
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  api.profile = "1";
  await api.live("4294967295", "server-group", undefined, "News", {
    limit: 2,
    page_size: 40,
  });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    offset: "4294967295",
    group_id: "server-group",
    search: "News",
    limit: "2",
    page_size: "40",
  });
});

it("rejects a late response from a retired profile scope", async () => {
  let resolveSlow!: (value: Response) => void;
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/slow")
      ? new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        })
      : String(url).endsWith("/bootstrap")
        ? response({
            contract_version: 3,
            identity: { profile_id: "2" },
            profile_management: { profiles: [] },
          })
        : response({}),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  await api.restore();
  const pending = api.call("/api/slow");
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await api.selectProfile("2");
  resolveSlow(response({ private: "old-profile" }));
  await rejected;
});
it("consumes the Live action and server ranking without inventing a discovery job", async () => {
  const action = {
    card,
    label: "Watch live",
    resume: false,
    source_selection: "best",
  };
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/source-ranking")
      ? response({
          streams: [{ id: "live-b" }, { id: "live-a" }],
          best_match_id: "live-a",
          quality_filters: [],
          total: 2,
        })
      : response({
          streams: [{ id: "live-a" }, { id: "live-b" }],
          live: true,
          action,
        }),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  api.profile = "1";
  const publish = vi.fn();
  expect(
    await api.sources(card, publish, new AbortController().signal, "channel"),
  ).toEqual([{ id: "live-b" }, { id: "live-a" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls[0][1]).toMatchObject({
    action,
    best_match_id: "live-a",
  });
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
    "https://example.test/api/profiles/1/live/channel/sources",
    "https://example.test/api/profiles/1/source-ranking",
  ]);
});

it("does not invent a Live resume or selection policy for an older response", async () => {
  const api = new RemoteTvApi("https://example.test", store(), async () =>
    response({ streams: [{ id: "live-a" }], live: true }),
  );
  api.profile = "1";
  const publish = vi.fn();
  await expect(
    api.sources(card, publish, new AbortController().signal, "channel"),
  ).rejects.toMatchObject({ code: "unsupported_live_action" });
  expect(publish).not.toHaveBeenCalled();
});

it("creates secure request ids on Chrome 87 without randomUUID", () => {
  const original = globalThis.crypto;
  try {
    vi.stubGlobal("crypto", {
      getRandomValues: original.getRandomValues.bind(original),
    });
    expect(requestUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(requestUuid()).not.toBe(requestUuid());
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps metadata lookup selectors free of artwork and long synopsis fields", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    response({}),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  const origin = {
    provider_id: "stremio",
    connection_id: "addon:1",
    incarnation: "a".repeat(32),
  };
  await api.detail({
    ...card,
    metadata_origin: origin,
    description: "Long synopsis ".repeat(1000),
    landscape: "https://images.example/private-path.jpg",
  });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  const selector = JSON.parse(url.searchParams.get("card")!);
  expect(selector.identity).toEqual(card.identity);
  expect(selector.metadata_origin).toEqual(origin);
  expect(selector.description).toBeUndefined();
  expect(selector.landscape).toBeUndefined();
  expect(url.href.length).toBeLessThan(1500);
});

it("rejects a late response from a retired profile scope", async () => {
  let resolveSlow!: (value: Response) => void;
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith("/slow")
      ? new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        })
      : String(url).endsWith("/bootstrap")
        ? response({
            contract_version: 3,
            identity: { profile_id: "2" },
            profile_management: { profiles: [] },
          })
        : response({}),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  await api.restore();
  const pending = api.call("/api/slow");
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await api.selectProfile("2");
  resolveSlow(response({ private: "old-profile" }));
  await rejected;
});
it("consumes the Live action and server ranking without inventing a discovery job", async () => {
  const action = {card,label:"Watch live",resume:false,source_selection:"best"};
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).endsWith('/source-ranking')
    ? response({streams:[{id:"live-b"},{id:"live-a"}],best_match_id:"live-a",quality_filters:[],total:2})
    : response({ streams: [{ id: "live-a" },{id:"live-b"}], live: true, action }),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  api.profile = "1";
  const publish=vi.fn();
  expect(
    await api.sources(card, publish, new AbortController().signal, "channel"),
  ).toEqual([{ id: "live-b" },{id:"live-a"}]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls[0][1]).toMatchObject({action,best_match_id:"live-a"});
  expect(fetcher.mock.calls.map(([url])=>String(url))).toEqual(['https://example.test/api/profiles/1/live/channel/sources','https://example.test/api/profiles/1/source-ranking']);
});

it("does not invent a Live resume or selection policy for an older response", async () => {
  const api=new RemoteTvApi('https://example.test',store(),async()=>response({streams:[{id:'live-a'}],live:true}));
  api.profile='1';
  const publish=vi.fn();
  await expect(api.sources(card,publish,new AbortController().signal,'channel')).rejects.toMatchObject({code:'unsupported_live_action'});
  expect(publish).not.toHaveBeenCalled();
});

it("creates secure request ids on Chrome 87 without randomUUID", () => {
  const original = globalThis.crypto;
  try {
    vi.stubGlobal("crypto", {
      getRandomValues: original.getRandomValues.bind(original),
    });
    expect(requestUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(requestUuid()).not.toBe(requestUuid());
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps metadata lookup selectors free of artwork and long synopsis fields", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    response({}),
  );
  const api = new RemoteTvApi("https://example.test", store(), fetcher);
  const origin = {
    provider_id: "stremio",
    connection_id: "addon:1",
    incarnation: "a".repeat(32),
  };
  await api.detail({
    ...card,
    metadata_origin: origin,
    description: "Long synopsis ".repeat(1000),
    landscape: "https://images.example/private-path.jpg",
  });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  const selector = JSON.parse(url.searchParams.get("card")!);
  expect(selector.identity).toEqual(card.identity);
  expect(selector.metadata_origin).toEqual(origin);
  expect(selector.description).toBeUndefined();
  expect(selector.landscape).toBeUndefined();
  expect(url.href.length).toBeLessThan(1500);
});
