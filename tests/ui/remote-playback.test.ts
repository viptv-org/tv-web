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
  const publish = vi.fn();
  const controller = new RemotePlayback(api as unknown as RemoteTvApi,
    "web", document.createElement("video"), publish, failure, presented);
  controllers.push(controller);
  return { controller, player, api, failure, presented, publish, emit: () => snapshotListener?.(player.snapshot) };
}

describe("remote playback lease transitions", () => {
  it("returns from Back and releases its lease while native Stop is pending", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    let finish!: () => void;
    player.stop.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    let returned = false;
    const stopping = controller.stop().then(() => { returned = true; });
    try {
      await vi.waitFor(() => expect(returned).toBe(true), { timeout: 100 });
      expect(controller.leaseId).toBeUndefined();
      expect(api.release).toHaveBeenCalledWith("/api/playback/1");
    } finally {
      finish();
      await stopping;
    }
  });

  it("releases before a pending native Stop but waits before opening the replacement decoder", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    let finish!: () => void;
    player.stop.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const opening = controller.start(card, { id: "second" }, false);
    try {
      await vi.waitFor(() => expect(api.release).toHaveBeenCalledWith("/api/playback/1"));
      expect(api.admit).toHaveBeenCalledTimes(2);
      expect(player.open).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await opening;
    }
    expect(player.open).toHaveBeenCalledTimes(2);
  });

  it("releases its lease even when native Stop throws synchronously", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    player.stop.mockImplementationOnce(() => { throw new Error("Native close failed"); });
    await controller.stop();
    expect(controller.leaseId).toBeUndefined();
    expect(api.release).toHaveBeenCalledWith("/api/playback/1");
  });

  it("releases an admitted replacement when Back cancels pending decoder cleanup", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    let finish!: () => void;
    player.stop.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const opening = controller.start(card, { id: "second" }, false);
    const outcome = opening.catch(error => error);
    try {
      await vi.waitFor(() => expect(api.release).toHaveBeenCalledWith("/api/playback/1"));
      expect(controller.cancelPendingStart()).toBe(true);
      await controller.stop();
      await vi.waitFor(() => expect(api.release).toHaveBeenCalledWith("/api/playback/2"));
      expect(await outcome).toMatchObject({ name: "AbortError" });
      expect(player.open).toHaveBeenCalledTimes(1);
    } finally {
      finish();
      await outcome;
    }
  });

  it("releases an admitted replacement if the outgoing decoder cannot stop", async () => {
    const { controller, api, player } = setup();
    await controller.start(card, { id: "source" }, false);
    player.stop.mockRejectedValueOnce(new Error("Native close failed"));
    await expect(controller.start(card, { id: "second" }, false)).rejects.toThrow("Native close failed");
    expect(api.release).toHaveBeenCalledWith("/api/playback/1");
    expect(api.release).toHaveBeenCalledWith("/api/playback/2");
    expect(player.open).toHaveBeenCalledTimes(1);
  });

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
    expect(player.pause).toHaveBeenCalledOnce(); // outgoing hold or incoming paused intent
    expect(player.play).toHaveBeenCalledTimes(paused ? 0 : 1);
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

it("holds seek target/duration and controls through stopped/preparing decoder snapshots", async () => {
 const {controller,player,publish,emit,api}=setup();api.admit.mockResolvedValueOnce({...lease("tracks"),delivery:{...lease("tracks").delivery!,audio_tracks:[{input_index:2,language:"en",selected:true,supported:true,selectable:true}]}});await controller.start(card,{id:"source"},false);
 player.snapshot={...player.snapshot,time:{positionSeconds:30,durationSeconds:600}};
 let finish!:()=>void;player.open.mockImplementationOnce(async()=>{player.snapshot={...player.snapshot,state:"opening",time:{positionSeconds:0,durationSeconds:null}};emit();await new Promise<void>(resolve=>{finish=resolve});player.snapshot={...player.snapshot,state:"ready",time:{positionSeconds:120,durationSeconds:600}};emit();});
 player.stop.mockImplementationOnce(async()=>{player.snapshot={...player.snapshot,state:"stopped",time:{positionSeconds:0,durationSeconds:null}};emit();expect(controller.actions.seek).toBe(true);expect(controller.tracks.audio).toHaveLength(1);});
 publish.mockClear();const seeking=controller.seek(120,false);await vi.waitFor(()=>expect(finish).toBeDefined());
 expect(publish.mock.calls.every(([snapshot])=>snapshot.time.positionSeconds===120&&snapshot.time.durationSeconds===600)).toBe(true);
 finish();await seeking;expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({time:{positionSeconds:120,durationSeconds:600}}));
});

it("keeps the seek presentation after open resolves until real position metadata arrives", async()=>{
 const {controller,player,publish,emit}=setup();await controller.start(card,{id:"source"},false);player.snapshot={...player.snapshot,time:{positionSeconds:30,durationSeconds:600}};
 player.open.mockImplementationOnce(async()=>{player.snapshot={...player.snapshot,state:"opening",time:{positionSeconds:0,durationSeconds:null}};emit();});
 await controller.seek(120,false);expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({time:{positionSeconds:120,durationSeconds:600}}));
 await controller.seek(180,false);expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({time:{positionSeconds:180,durationSeconds:600}}));
 player.snapshot={...player.snapshot,time:{positionSeconds:180,durationSeconds:600}};emit();expect(publish).toHaveBeenLastCalledWith(player.snapshot);
});

it("releases the outgoing seek lease before admission without stopping its decoder picture",async()=>{
 const {controller,player,api,emit,failure}=setup();await controller.start(card,{id:"source"},false);player.stop.mockClear();api.admit.mockImplementationOnce(async()=>{expect(api.release).toHaveBeenCalledWith("/api/playback/1");expect(player.pause).toHaveBeenCalledOnce();expect(player.stop).not.toHaveBeenCalled();player.snapshot={...player.snapshot,state:"error",error:{code:"connection-failed",message:"Retired stream closed"}};emit();expect(failure).not.toHaveBeenCalled();return lease("seek");});await controller.seek(60,false);expect(player.stop).toHaveBeenCalledOnce();
});

describe('provider-only subtitle capability', () => {
  it('exposes browser provider selection independently of embedded subtitle availability', async () => {
    const { controller, api } = setup();
    api.admit.mockResolvedValueOnce({ ...lease('provider-only'), delivery: { ...lease('provider-only').delivery!, external_subtitles_supported: true, subtitles_supported: false } });
    await controller.start(card, { id: 'source' }, false);
    vi.stubGlobal('__viptvCreatePlayer', undefined);
    expect(controller.tracks.subtitlesSupported).toBe(false);
    expect(controller.providerSubtitleSupport).toBe(true);
    api.call.mockResolvedValueOnce({ candidates: [{ id: 'scoped-id', label: 'English', language: 'eng' }] });
    expect(await controller.providerSubtitles()).toEqual([{ id: 'scoped-id', label: 'English', language: 'eng' }]);
    expect(api.call).toHaveBeenCalledWith('/api/subtitles/movie/title?metadata_provider_id=stremio');
  });
  it('does not advertise browser timing on unsupported native hosts or deliveries', async () => {
    const { controller, api } = setup();
    api.admit.mockResolvedValueOnce({ ...lease('native'), delivery: { ...lease('native').delivery!, external_subtitles_supported: true } });
    await controller.start(card, { id: 'source' }, false);
    expect(controller.providerSubtitleSupport).toBe(false);
    vi.stubGlobal('__viptvCreatePlayer', undefined);
    await controller.start(card, { id: 'other' }, false);
    expect(controller.providerSubtitleSupport).toBe(false);
  });
});
