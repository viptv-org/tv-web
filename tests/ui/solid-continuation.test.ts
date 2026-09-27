import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaItem, MediaSource, PlaybackPreferences } from "../../src/api";
import type { SolidTVPlaybackRuntime } from "../../src/tv-solid/playbackRuntime";
import { createSolidTVContinuation, type SolidTVContinuationOptions } from "../../src/tv-solid/continuationRuntime";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), capabilities: vi.fn(() => async () => ({ h264: true })) }));
vi.mock("../../src/ui/continuation", () => ({ resolveNext: mocks.resolve }));
vi.mock("@viptv/video", () => ({ deliveryCapabilitiesFor: mocks.capabilities }));

const first: MediaItem = { id: "first", type: "series", name: "Show", title: "First", episode: 1, season: 1, genres: [], episodes: [], raw: {} };
const next: MediaItem = { ...first, id: "next", episode: 2 };
const source: MediaSource = { id: "source", name: "Next source", sourceAddonId: "iptv:7", raw: { source_fingerprint: "exact-next" } };

function fixture(active = false) {
  const outgoing = { intent: { item: first, source, position: 12 }, session: { id: "session-first", duration: 120 } };
  const controller = {
    snapshot: { active: active ? outgoing : null, state: "playing" },
    prepareNext: vi.fn(async (resolve: () => Promise<unknown>) => {
      const intent = await resolve();
      if (intent) controller.snapshot.active = { ...outgoing, intent: intent as typeof outgoing.intent, session: { id: "session-next", duration: 120 } };
    }),
    cancelNext: vi.fn(),
  };
  const runtime = { controller, player: { snapshot: { time: { positionSeconds: 42, durationSeconds: 120 } } } } as unknown as SolidTVPlaybackRuntime;
  const api = { nextEpisode: vi.fn(async () => ({ status: "next", item: next })), sources: vi.fn(), pollSourcesStep: vi.fn(), saveProgress: vi.fn(async () => {}) };
  const options: SolidTVContinuationOptions = { api: api as unknown as SolidTVContinuationOptions["api"], platform: "webos", getRuntime: () => active ? runtime : undefined, profileId: () => "profile", preferences: () => ({ autoplay: true }) as PlaybackPreferences };
  return { flow: createSolidTVContinuation(options), api, controller, outgoing };
}

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("SolidTV explicit continuation", () => {
  it("returns enriched Home intent at zero with real platform capability mapping", async () => {
    mocks.resolve.mockResolvedValue({ item: next, source, position: 99 });
    const { flow } = fixture();
    const result = await flow.advance(first);
    expect(result).toMatchObject({ kind: "ready", intent: { position: 0, item: { sourceAddonId: "iptv:7", sourceFingerprint: "exact-next" } } });
    expect(mocks.capabilities).toHaveBeenCalledWith("html5");
    expect(flow.busy).toBe(false);
  });

  it("saves outgoing progress and updates the controller with enriched next identity", async () => {
    mocks.resolve.mockResolvedValue({ item: next, source });
    const { flow, api } = fixture(true);
    expect(await flow.advance(first)).toMatchObject({ kind: "started", active: { intent: { item: { id: "next", sourceFingerprint: "exact-next" } } } });
    expect(api.saveProgress).toHaveBeenCalledWith("profile", first, 42, 120, { signal: expect.any(AbortSignal) });
  });

  it("retains server caught-up reason without starting playback", async () => {
    mocks.resolve.mockImplementation(async (api) => { await api.nextEpisode("profile", first); return null; });
    const { flow, api, controller } = fixture(true);
    api.nextEpisode.mockResolvedValue({ status: "caught_up", item: next });
    expect(await flow.advance(first)).toEqual({ kind: "missing", status: "caught_up" });
    expect(controller.snapshot.active?.intent.item.id).toBe("first");
  });

  it("recognizes a successful transition when the backend reuses its opaque session id", async () => {
    mocks.resolve.mockResolvedValue({ item: next, source });
    const { flow, controller, outgoing } = fixture(true);
    controller.prepareNext.mockImplementation(async resolve => {
      const intent = await resolve();
      if (intent) controller.snapshot.active = { ...outgoing, intent: intent as typeof outgoing.intent };
    });
    expect(await flow.advance(first)).toMatchObject({ kind: "started", active: { session: { id: "session-first" }, intent: { item: { id: "next" } } } });
  });

  it("tries only three distinct candidates and reports preserved outgoing session", async () => {
    const excluded: string[][] = [];
    mocks.resolve.mockImplementation(async (_api, _profile, _item, _prefs, _signal, _caps, attempted: Set<string>) => {
      excluded.push([...attempted]);
      return { item: next, source: { ...source, id: `source-${attempted.size + 1}` } };
    });
    const { flow, controller } = fixture(true);
    controller.prepareNext.mockImplementation(async resolve => { await resolve(); throw new Error("unplayable"); });
    expect(await flow.advance(first)).toMatchObject({ kind: "failed", rollbackFailed: false, outgoingPosition: 42 });
    expect(excluded).toEqual([[], ["source-1"], ["source-1", "source-2"]]);
    expect(controller.prepareNext).toHaveBeenCalledTimes(3);
  });

  it("preserves React behavior when saving outgoing progress fails before preparation", async () => {
    const { flow, api, controller } = fixture(true);
    api.saveProgress.mockRejectedValue(new Error("Progress unavailable"));
    expect(await flow.advance(first)).toMatchObject({ kind: "failed", error: { message: "Progress unavailable" }, rollbackFailed: false });
    expect(controller.prepareNext).not.toHaveBeenCalled();
    expect(controller.snapshot.active?.intent.item.id).toBe("first");
  });

  it("cancels pending discovery and leaves the outgoing controller available", async () => {
    let entered!: () => void;
    const discovering = new Promise<void>(resolve => { entered = resolve; });
    mocks.resolve.mockImplementation((_api, _profile, _item, _prefs, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      entered();
    }));
    const { flow, controller } = fixture(true);
    const result = flow.advance(first);
    await discovering;
    flow.cancel();
    expect(await result).toEqual({ kind: "cancelled" });
    expect(controller.cancelNext).toHaveBeenCalledOnce();
    expect(controller.snapshot.active?.intent.item.id).toBe("first");
  });

  it("bounds discovery to 180 seconds and reports timeout instead of no-next", async () => {
    vi.useFakeTimers();
    mocks.resolve.mockImplementation((_api, _profile, _item, _prefs, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const { flow, controller } = fixture(true);
    const result = flow.advance(first);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await result).toMatchObject({ kind: "failed", error: { message: "Next episode preparation timed out." }, rollbackFailed: false });
    expect(controller.cancelNext).toHaveBeenCalledOnce();
    expect(flow.busy).toBe(false);
  });

  it("blocks a second Next until cancellation finishes restoring the outgoing session", async () => {
    mocks.resolve.mockResolvedValue({ item: next, source });
    const { flow, controller } = fixture(true);
    let entered!: () => void;
    let restore!: () => void;
    const preparing = new Promise<void>(resolve => { entered = resolve; });
    const restored = new Promise<void>(resolve => { restore = resolve; });
    controller.prepareNext.mockImplementationOnce(async resolve => {
      await resolve();
      entered();
      await restored;
    });
    const firstAttempt = flow.advance(first);
    await preparing;
    flow.cancel();
    expect(flow.busy).toBe(true);
    expect(await flow.advance(first)).toEqual({ kind: "cancelled" });
    expect(controller.prepareNext).toHaveBeenCalledTimes(1);
    restore();
    expect(await firstAttempt).toEqual({ kind: "cancelled" });
    expect(flow.busy).toBe(false);
    expect(await flow.advance(first)).toMatchObject({ kind: "started" });
    expect(controller.prepareNext).toHaveBeenCalledTimes(2);
  });
});
