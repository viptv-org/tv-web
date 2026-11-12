import { afterEach, describe, expect, it, vi } from "vitest";
import { RemotePlayback } from "../../src/tv-solid/remote/playback";
import { RemoteError, type RemoteTvApi } from "../../src/tv-solid/remote/api";
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
    selectTextTrack: vi.fn(async () => {}),
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
  it("publishes newly admitted actions before decoder open resolves", async () => {
    const {controller,player,publish}=setup();
    let finish!:()=>void;
    player.open.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const actions: boolean[]=[];
    publish.mockImplementation(()=>{actions.push(controller.actions.seek);});
    const starting=controller.start(card,{id:"source"},false);
    await vi.waitFor(()=>expect(finish).toBeDefined());
    expect(actions).toContain(true);
    finish();await starting;
  });

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
    api.admit.mockResolvedValueOnce({ ...lease('provider-only'), delivery: { ...lease('provider-only').delivery!, external_subtitles_supported: true, provider_subtitles_version: 1, subtitles_supported: false } });
    await controller.start(card, { id: 'source' }, false);
    vi.stubGlobal('__viptvCreatePlayer', undefined);
    expect(controller.tracks.subtitlesSupported).toBe(false);
    expect(controller.providerSubtitleSupport).toBe(true);
    api.call.mockResolvedValueOnce({ candidates: [{ id: 'scoped-id', label: 'English', language: 'eng' }] });
    expect(await controller.providerSubtitles()).toEqual([{ id: 'scoped-id', label: 'English', language: 'eng' }]);
    expect(api.call).toHaveBeenCalledWith('/api/subtitles/movie/title?metadata_provider_id=stremio');
  });
  it('does not advertise new provider controls against a backend without the canonical-caption version', async () => {
    const {controller,api}=setup();
    api.admit.mockResolvedValueOnce({...lease('old-backend'),delivery:{...lease('old-backend').delivery!,external_subtitles_supported:true}});
    await controller.start(card,{id:'source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
    expect(controller.providerSubtitleSupport).toBe(false);
  });
  it('does not advertise browser timing on unsupported native hosts or deliveries', async () => {
    const { controller, api } = setup();
    api.admit.mockResolvedValueOnce({ ...lease('native'), delivery: { ...lease('native').delivery!, external_subtitles_supported: true, provider_subtitles_version: 1 } });
    await controller.start(card, { id: 'source' }, false);
    expect(controller.providerSubtitleSupport).toBe(false);
    vi.stubGlobal('__viptvCreatePlayer', undefined);
    await controller.start(card, { id: 'other' }, false);
    expect(controller.providerSubtitleSupport).toBe(false);
  });
});

function providerSeekFixture(changedHash = false, changedAudio = false) {
  const f=setup();
  let number=0;
  f.api.admit.mockImplementation(async()=> {
    const id=String(++number), value=lease(id);
    value.delivery={...value.delivery!,external_subtitles_supported:true,provider_subtitles_version:1,
      audio_tracks:[{input_index:changedAudio && number>1?2:1,language:'en',title:'English',selected:true}],timeline_offset_seconds:number>1?70:0};
    return value;
  });
  const track={mode:'disabled',addCue:vi.fn(),removeCue:vi.fn()};
  vi.spyOn(HTMLMediaElement.prototype,'addTextTrack').mockReturnValue(track as any);
  vi.stubGlobal('VTTCue',class {constructor(public startTime:number,public endTime:number,public text:string){}});
  const asset={canonical_vtt:'WEBVTT\n\n00:00:10.000 --> 00:00:11.000\nDialogue\n',subtitle_hash:'a'.repeat(64)};
  const record=(id:string,manual=false)=>({version:1,playback_generation:`generation-${id}`,media_identity:`session-${id}`,audio_identity:'same-audio',subtitle_hash:asset.subtitle_hash,algorithm_version:'activity-offset-affine-v1',revision:manual?2:1,state:'unavailable',manual,correction:null});
  f.api.call.mockImplementation(async(path:string,method?:string)=> {
    const id=/playback\/(\d+)/.exec(path)?.[1] ?? '1';
    if(path.endsWith('/subtitles'))return {...asset,subtitle_hash:changedHash && id==='2'?'b'.repeat(64):asset.subtitle_hash};
    return record(id,method==='PUT');
  });
  return {...f,asset,record,track};
}
const selectedProvider={id:'scoped-provider',label:'English',language:'en'};
it('same-source managed seek preserves provider/manual intent after playback starts and revalidation',async()=> {
  const f=providerSeekFixture();await f.controller.start(card,{id:'same-source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
  await f.controller.selectProviderSubtitle(selectedProvider);await f.controller.adjustProviderSubtitle(1.5);
  let resolveAsset!: (value:typeof f.asset)=>void;
  const previous=f.api.call.getMockImplementation()!;
  f.api.call.mockImplementation(async(path:string,method?:string)=>path==='/api/playback/2/subtitles'?new Promise(resolve=>{resolveAsset=resolve;}):previous(path,method));
  await f.controller.seek(70,false);
  expect(f.player.open).toHaveBeenCalledTimes(2);expect(f.controller.leaseId).toBe('2');
  await vi.waitFor(()=>expect(resolveAsset).toBeTypeOf('function'));
  expect(f.controller.providerSubtitleSelected).toBeUndefined();
  resolveAsset(f.asset);
  await vi.waitFor(()=>expect(f.controller.providerSubtitleSelected).toBe(selectedProvider.id));
  expect(f.controller.providerSubtitleDelay).toBe(1.5);expect(f.controller.providerSubtitleTiming).toBe('Manual timing');
  expect(f.api.call).toHaveBeenCalledWith('/api/playback/2/subtitle-sync','PUT',{revision:1,manual:true},expect.any(AbortSignal));
});
it('changed subtitle hash or selected audio invalidates managed-seek retention',async()=> {
  for(const [changedHash,changedAudio] of [[true,false],[false,true]]) {
    const f=providerSeekFixture(changedHash,changedAudio);await f.controller.start(card,{id:'same-source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
    await f.controller.selectProviderSubtitle(selectedProvider);await f.controller.adjustProviderSubtitle(1);
    await f.controller.seek(70,false);await new Promise(resolve=>setTimeout(resolve,10));
    expect(f.controller.providerSubtitleSelected).toBeUndefined();expect(f.controller.providerSubtitleDelay).toBe(0);
    expect(f.api.call.mock.calls.some(([path,method])=>path==='/api/playback/2/subtitle-sync' && method==='PUT')).toBe(false);
  }
});
it('new source and Off retire pending seek reattachment without reviving old captions',async()=> {
  const f=providerSeekFixture();await f.controller.start(card,{id:'same-source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
  await f.controller.selectProviderSubtitle(selectedProvider);await f.controller.adjustProviderSubtitle(1);
  let resolveAsset!: (value:typeof f.asset)=>void;const previous=f.api.call.getMockImplementation()!;
  f.api.call.mockImplementation(async(path:string,method?:string)=>path==='/api/playback/2/subtitles'?new Promise(resolve=>{resolveAsset=resolve;}):previous(path,method));
  await f.controller.seek(70,false);await vi.waitFor(()=>expect(resolveAsset).toBeTypeOf('function'));
  await f.controller.selectProviderSubtitle(null);resolveAsset(f.asset);await new Promise(resolve=>setTimeout(resolve,10));
  expect(f.controller.providerSubtitleSelected).toBeUndefined();expect(f.controller.providerSubtitleDelay).toBe(0);
  f.api.call.mockImplementation(previous);
  await f.controller.selectProviderSubtitle(selectedProvider);
  await f.controller.start(card,{id:'different-source'},false);await new Promise(resolve=>setTimeout(resolve,10));
  expect(f.controller.providerSubtitleSelected).toBeUndefined();
  expect(f.api.call.mock.calls.some(([path])=>path==='/api/playback/3/subtitles')).toBe(false);
});

it('a newer explicit provider selection wins over a pending seek reattachment',async()=> {
  const f=providerSeekFixture();await f.controller.start(card,{id:'same-source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
  await f.controller.selectProviderSubtitle(selectedProvider);await f.controller.adjustProviderSubtitle(1);
  let resolveAsset!: (value:typeof f.asset)=>void;const previous=f.api.call.getMockImplementation()!;
  f.api.call.mockImplementation(async(path:string,method?:string,body?:any)=>path==='/api/playback/2/subtitles' && body?.subtitle_id===selectedProvider.id?new Promise(resolve=>{resolveAsset=resolve;}):previous(path,method,body));
  await f.controller.seek(70,false);await vi.waitFor(()=>expect(resolveAsset).toBeTypeOf('function'));
  const newer={...selectedProvider,id:'newer-provider'};await f.controller.selectProviderSubtitle(newer);
  resolveAsset(f.asset);await new Promise(resolve=>setTimeout(resolve,10));
  expect(f.controller.providerSubtitleSelected).toBe(newer.id);expect(f.controller.providerSubtitleDelay).toBe(0);
});

it('old gateway without sync preserves provider/manual intent across a managed seek',async()=> {
  const f=providerSeekFixture();const previous=f.api.call.getMockImplementation()!;
  f.api.call.mockImplementation(async(path:string,method?:string,body?:any)=> {
    if(path.endsWith('/subtitle-sync'))throw new Error('404: optional subtitle sync unavailable');
    return previous(path,method,body);
  });
  await f.controller.start(card,{id:'same-source'},false);vi.stubGlobal('__viptvCreatePlayer',undefined);
  await f.controller.selectProviderSubtitle(selectedProvider);await f.controller.adjustProviderSubtitle(1.5);
  expect(f.controller.providerSubtitleTiming).toBe('Manual timing');
  await f.controller.seek(70,false);
  await vi.waitFor(()=>expect(f.controller.providerSubtitleSelected).toBe(selectedProvider.id));
  expect(f.controller.providerSubtitleDelay).toBe(1.5);expect(f.controller.providerSubtitleTiming).toBe('Manual timing');
  expect(f.player.open).toHaveBeenCalledTimes(2);expect(f.controller.leaseId).toBe('2');
});


it("does not acknowledge an all-dropped video total as first-frame evidence", async () => {
  const {controller,player,api,emit,presented}=setup();await controller.start(card,{id:"source"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",videoFrames:3,droppedFrames:3}};emit();
  expect(presented).not.toHaveBeenCalled();expect(api.call.mock.calls.some(([path])=>String(path).endsWith('/first-frame'))).toBe(false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",videoFrames:3,droppedFrames:2}};emit();
  expect(presented).toHaveBeenCalledOnce();
});


it("keeps clock-only startup usable without verifying a source while acknowledging the legacy transport", async () => {
  const {controller,player,api,emit,presented}=setup();await controller.start(card,{id:"source"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",presentationEvidence:"media-progress"},time:{positionSeconds:2,durationSeconds:100}};emit();
  expect(controller.hasPlaybackProgress).toBe(true);expect(controller.hasPresentedFrame).toBe(false);
  expect(presented).not.toHaveBeenCalled();expect(api.call.mock.calls.filter(([path])=>String(path).endsWith('/first-frame'))).toHaveLength(1);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",presentedFrames:2,presentedPositionSeconds:2}};emit();emit();
  expect(controller.hasPresentedFrame).toBe(true);expect(presented).toHaveBeenCalledOnce();
  expect(api.call.mock.calls.filter(([path])=>String(path).endsWith('/first-frame'))).toHaveLength(1);
  await controller.start(card,{id:"next"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",presentationEvidence:"media-progress"}};emit();
  expect(controller.hasPlaybackProgress).toBe(true);expect(controller.hasPresentedFrame).toBe(false);
  expect(presented).toHaveBeenCalledOnce();
});

it.each([0,3])("does not promote decoded-only progress over valid all-dropped quality counters (total=%s)",async total=>{
  const {controller,player,api,emit,presented}=setup();await controller.start(card,{id:"source"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",decodedFrames:3,videoFrames:total,droppedFrames:total}};emit();emit();
  expect(controller.hasPlaybackProgress).toBe(true);expect(controller.hasPresentedFrame).toBe(false);expect(controller.firstVideoEvidence).toBeUndefined();
  expect(presented).not.toHaveBeenCalled();expect(api.call.mock.calls.filter(([path])=>String(path).endsWith('/first-frame'))).toHaveLength(1);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",decodedFrames:3,videoFrames:3,droppedFrames:2}};emit();emit();
  expect(controller.hasPresentedFrame).toBe(true);expect(controller.firstVideoEvidence).toBe("playback-quality");expect(presented).toHaveBeenCalledOnce();
  expect(api.call.mock.calls.filter(([path])=>String(path).endsWith('/first-frame'))).toHaveLength(1);
});


it("prioritizes compositor evidence over conflicting quality counters",async()=>{
  const {controller,player,emit,presented}=setup();await controller.start(card,{id:"source"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",presentedFrames:1,decodedFrames:3,videoFrames:3,droppedFrames:3}};emit();emit();
  expect(controller.hasPresentedFrame).toBe(true);expect(controller.firstVideoEvidence).toBe("compositor");expect(presented).toHaveBeenCalledOnce();
});

it("labels decoded-only fallback without claiming compositor evidence when quality is unavailable",async()=>{
  const {controller,player,emit,presented}=setup();await controller.start(card,{id:"source"},false);
  player.snapshot={...player.snapshot,diagnostics:{engine:"native-html",transport:"hls",decodedFrames:3}};emit();emit();
  expect(controller.hasPresentedFrame).toBe(true);expect(controller.firstVideoEvidence).toBe("decoded-counter");expect(presented).toHaveBeenCalledOnce();
  expect(player.snapshot.diagnostics?.presentedFrames).toBeUndefined();
  await controller.start(card,{id:"next"},false);expect(controller.hasPresentedFrame).toBe(false);expect(controller.firstVideoEvidence).toBeUndefined();
});


it("keeps a valid lease through a transient heartbeat timeout and renews before expiry", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const { controller, api, player, failure } = setup();
  Object.defineProperty(api, "serverNow", { get: () => Date.now() });
  const authorized = { ...lease("heartbeat"), expires_at: 60, renew_after_seconds: 20 };
  api.admit.mockResolvedValueOnce(authorized);
  api.call.mockRejectedValueOnce(new RemoteError(502, "gateway_unavailable", "Temporary gateway timeout"));
  api.call.mockResolvedValueOnce({ ...authorized, expires_at: 90 });
  await controller.start(card, { id: "source" }, false);
  player.stop.mockClear();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(api.call).toHaveBeenCalledTimes(1);
  expect(failure).not.toHaveBeenCalled();
  expect(player.stop).not.toHaveBeenCalled();
  expect(api.release).not.toHaveBeenCalled();
  expect(controller.leaseId).toBe("heartbeat");
  await vi.advanceTimersByTimeAsync(1_000);
  expect(api.call).toHaveBeenCalledTimes(2);
  expect(failure).not.toHaveBeenCalled();
  expect(api.release).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(38_000);
  expect(controller.leaseId).toBe("heartbeat");
});
