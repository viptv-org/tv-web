import { afterEach, describe, expect, it, vi } from "vitest";
import { RemotePlayback } from "../../src/tv-solid/remote/playback";
import type { RemoteTvApi } from "../../src/tv-solid/remote/api";
import type { Card, Lease } from "../../src/tv-solid/remote/types";
import { IDLE_SNAPSHOT, type Player } from "../../vendor/video/src/types";

const card: Card = {
  identity: { kind: "movie", id: "title", ids: [] },
  provider_id: "stremio", title: "Title", badges: [],
};
function lease(id: string): Lease {
  return {
    id, status: "ready", expires_at: Date.now() / 1000 + 3600,
    renew_after_seconds: 1200,
    actions: { pause: true, seek: true, restart: true, change_source: true,
      episodes: false, next_episode: false, tracks: true,
      subtitle_style: false, report_progress: false },
    delivery: { kind: "gateway", url: "https://media.example/video.m3u8", format: "hls" },
  };
}
const controllers: RemotePlayback[] = [];
afterEach(async () => {
  await Promise.all(controllers.splice(0).map(controller => controller.dispose()));
  vi.unstubAllGlobals();
});
function setup() {
  const player = {
    snapshot: { ...IDLE_SNAPSHOT }, capabilities: { platform: "html5" },
    subscribe: vi.fn(() => () => {}), open: vi.fn(async () => {}),
    play: vi.fn(async () => { player.snapshot = { ...player.snapshot, state: "playing" }; }),
    pause: vi.fn(async () => { player.snapshot = { ...player.snapshot, state: "paused" }; }),
    stop: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
  };
  vi.stubGlobal("__viptvCreatePlayer", () => player as unknown as Player);
  let nextId = 0;
  const api = {
    admit: vi.fn(async (..._args: unknown[]) => lease(String(++nextId))),
    release: vi.fn(async () => {}), serverNow: Date.now(),
  };
  const controller = new RemotePlayback(api as unknown as RemoteTvApi,
    "web", document.createElement("video"), vi.fn(), vi.fn());
  controllers.push(controller);
  return { controller, player, api };
}

describe("remote playback lease transitions", () => {
  it.each([false, true])("seeking preserves tracks and direct mode with paused=%s", async paused => {
    const { controller, api, player } = setup();
    const selection = { audio_track: 2, subtitle_track: 3 };
    await controller.start(card, { id: "source" }, false, 0, selection, undefined, true);
    if (paused) await player.pause();
    player.play.mockClear();
    player.pause.mockClear();
    await controller.seek(120);
    expect(api.admit.mock.calls[1]).toEqual([
      { id: "source" }, false, expect.any(AbortSignal), 120, selection, undefined, true,
    ]);
    expect(player.open).toHaveBeenLastCalledWith(expect.objectContaining({ paused }));
    expect(paused ? player.pause : player.play).toHaveBeenCalledOnce();
    expect(paused ? player.play : player.pause).not.toHaveBeenCalled();
    expect(api.release).toHaveBeenCalledWith("/api/playback/1");
  });

  it("keeps the outgoing lease on replacement failure and uses the new lease on the next replacement", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false, 0, {}, undefined, true);
    player.stop.mockClear();
    api.admit.mockRejectedValueOnce(new Error("Source unavailable"));
    await expect(controller.replaceSource({ id: "failed" })).rejects.toThrow("Source unavailable");
    expect(controller.leaseId).toBe("1");
    expect(controller.canReplaceSource).toBe(true);
    expect(player.stop).not.toHaveBeenCalled();
    expect(api.release).not.toHaveBeenCalled();
    await controller.replaceSource({ id: "replacement" });
    await controller.replaceSource({ id: "another" });
    expect(api.admit.mock.calls[3][5]).toEqual({ playback_id: "2", observed_position: 0 });
    expect(api.admit.mock.calls[3][6]).toBe(true);
    await controller.stop();
    await controller.start(card, { id: "fresh" }, false);
    expect(api.admit.mock.calls[4][6]).toBe(false);
  });

  it("aborts superseded admission and releases a late lease without opening it", async () => {
    const { controller, api, player } = setup();
    let finish!: (value: Lease) => void;
    api.admit.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = controller.start(card, { id: "old" }, false);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    const signal = api.admit.mock.calls[0][2] as AbortSignal;
    await controller.start(card, { id: "new" }, false);
    expect(signal.aborted).toBe(true);
    finish(lease("late"));
    await rejected;
    expect(api.release).toHaveBeenCalledWith("/api/playback/late");
    expect(player.open).toHaveBeenCalledOnce();
    expect(controller.leaseId).toBe("1");
  });
});
