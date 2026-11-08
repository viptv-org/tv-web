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
  vi.useRealTimers();
});
function setup(presented = vi.fn()) {
  let snapshotListener: ((snapshot: any) => void) | undefined;
  const failure = vi.fn();
  const player = {
    snapshot: { ...IDLE_SNAPSHOT }, capabilities: { platform: "html5" },
    subscribe: vi.fn((listener: any) => { snapshotListener = listener; return () => {}; }), open: vi.fn(async () => {}),
    play: vi.fn(async () => { player.snapshot = { ...player.snapshot, state: "playing" }; }),
    pause: vi.fn(async () => { player.snapshot = { ...player.snapshot, state: "paused" }; }),
    stop: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
  };
  vi.stubGlobal("__viptvCreatePlayer", () => player as unknown as Player);
  let nextId = 0;
  const api = {
    admit: vi.fn(async (..._args: unknown[]) => lease(String(++nextId))),
    release: vi.fn(async () => {}), call: vi.fn(async (..._args: any[]) => ({})), serverNow: Date.now(),
  };
  const controller = new RemotePlayback(api as unknown as RemoteTvApi,
    "web", document.createElement("video"), vi.fn(), failure, presented);
  controllers.push(controller);
  return { controller, player, api, failure, presented, emit: () => snapshotListener?.(player.snapshot) };
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

  it.each([false, true])("server track replacement preserves paused=%s without native track APIs", async paused => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    if (paused) await player.pause();
    await controller.selectTrack("audio", 4);
    expect(api.admit.mock.calls[1][4]).toEqual({ audio_track: 4 });
    expect(api.admit.mock.calls[1][5]).toMatchObject({ playback_id: "1" });
    expect(player.open).toHaveBeenLastCalledWith(expect.objectContaining({ paused }));
    expect(player.snapshot.state).toBe(paused ? "paused" : "playing");
    expect(api.release).toHaveBeenCalledWith("/api/playback/1");
  });

  it("carries server-selected subtitle language and explicit Off to the decoder", async () => {
    const { controller, api, player } = setup();
    api.admit.mockResolvedValueOnce({ ...lease("subtitles"), delivery: {
      ...lease("subtitles").delivery!, subtitle_tracks: [
        { input_index: 7, language: "eng", selected: true, selectable: true, supported: true },
      ],
    } });
    await controller.start(card, { id: "source" }, false);
    expect(player.open).toHaveBeenLastCalledWith(expect.objectContaining({ preferredSubtitleLanguage: "eng" }));
    api.admit.mockResolvedValueOnce({ ...lease("off"), delivery: {
      ...lease("off").delivery!, subtitle_tracks: [
        { input_index: 7, language: "eng", selected: false, selectable: true, supported: true },
      ],
    } });
    await controller.selectTrack("text", null);
    expect(player.open).toHaveBeenLastCalledWith(expect.objectContaining({ textTrackId: null }));
  });

  it.each([false, true])("confirming current tracks never restarts playback with subtitles=%s", async subtitles => {
    const { controller, api, player } = setup();
    api.admit.mockResolvedValueOnce({ ...lease("current"), delivery: {
      ...lease("current").delivery!, subtitles_supported: true,
      audio_tracks: [{ input_index: 2, selected: true, selectable: true, supported: true }],
      subtitle_tracks: [{ input_index: 4, selected: subtitles, selectable: true, supported: true }],
    } });
    await controller.start(card, { id: "source" }, false);
    await controller.selectTrack("audio", 2);
    await controller.selectTrack("text", subtitles ? 4 : null);
    expect(api.admit).toHaveBeenCalledOnce();
    expect(player.open).toHaveBeenCalledOnce();
    expect(api.release).not.toHaveBeenCalled();
  });

  it("retries terminal playback failure with fresh discovery rather than a retired lease", async () => {
    const { controller, player, api, failure, emit } = setup();
    await controller.start(card, { id: "source" }, false);
    player.snapshot = { ...player.snapshot, state: "error", error: { message: "Media failed" },
      time: { ...player.snapshot.time, positionSeconds: 123 } } as typeof player.snapshot;
    emit();await Promise.resolve();
    expect(controller.canReplaceSource).toBe(false);
    expect(failure).toHaveBeenCalledWith(expect.any(Error), 123);
    expect(api.release).toHaveBeenCalledWith("/api/playback/1");
  });
  it("drops a replacement binding if admission succeeded but the new decoder failed", async () => {
    const { controller, player } = setup();
    await controller.start(card, { id: "source" }, false);
    player.open.mockRejectedValueOnce(new Error("Decoder failed"));
    await expect(controller.replaceSource({ id: "next" })).rejects.toThrow("Decoder failed");
    expect(controller.canReplaceSource).toBe(false);
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


it("observes a source only once after a presented frame, never from admission alone", async () => {
 const { controller,player,presented,emit }=setup();await controller.start(card,{id:"manual"},false);
 expect(presented).not.toHaveBeenCalled();
 player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",firstFrameMs:0}};emit();emit();
 expect(presented).toHaveBeenCalledOnce();expect(presented).toHaveBeenCalledWith("1",card,{id:"manual"});
});
it("cancels an incoming admission while retaining the outgoing lease and releases a late result", async () => {
 const { controller,api,player }=setup();await controller.start(card,{id:"outgoing"},false);player.stop.mockClear();
 let finish!:(value:Lease)=>void;api.admit.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const incoming=controller.start(card,{id:"incoming"},false);expect(controller.cancelPendingStart()).toBe(true);
 expect(controller.leaseId).toBe("1");expect(player.stop).not.toHaveBeenCalled();
 finish(lease("late"));await expect(incoming).rejects.toMatchObject({name:"AbortError"});
 expect(controller.leaseId).toBe("1");expect(api.release).toHaveBeenCalledWith("/api/playback/late");
});
it("keeps the final frame available after terminal authorization until Next or Back", async () => {
 vi.useFakeTimers();const {controller,api,player,emit,failure}=setup();await controller.start(card,{id:"source"},false);player.stop.mockClear();
 player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",firstFrameMs:0}};emit();
 player.snapshot={...player.snapshot,state:"ended"};emit();
 await vi.advanceTimersByTimeAsync(3601000);
 expect(api.call.mock.calls.filter(([path])=>String(path).endsWith("/heartbeat"))).toHaveLength(0);
 expect(failure).not.toHaveBeenCalled();expect(controller.leaseId).toBe("1");expect(player.stop).not.toHaveBeenCalled();
});

it("records completion once and does not overwrite it with an ordinary stop when advancing", async () => {
 const {controller,api,player,emit}=setup();
 Object.assign(api,{profile:"1",scopeEpoch:0,scoped:()=>"/api/profiles/1"});
 api.admit.mockResolvedValueOnce({...lease("completed"),actions:{...lease("completed").actions!,report_progress:true}});
 await controller.start(card,{id:"source"},false);
 player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",firstFrameMs:0}};emit();
 player.snapshot={...player.snapshot,state:"ended"};emit();
 await controller.stop();await Promise.resolve();await Promise.resolve();
 await vi.waitFor(() => {
  const events=api.call.mock.calls.filter(([path])=>String(path).endsWith("/playback-events")).map(([_path,_method,body])=>body);
  expect(events.filter(body=>body.event==="stop")).toEqual([expect.objectContaining({ended:true})]);
 });
});
