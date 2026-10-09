import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NativeTorrentTransport, type PrivateResponse, type RuntimeReply, type TorrentRuntimePort} from '../../src/api/torrent-runtime';
import type {PlaybackV2Request} from '../../vendor/core/typescript/wire';

const request:PlaybackV2Request={conversion:'auto',audioLanguage:null,preferredAudioLanguage:null,preferredSubtitleLanguage:null,subtitlesOff:false,
  requestId:'request_fixture',streamId:'source_fixture',position:12,forceGateway:false,audioTrack:null,subtitleTrack:null,
  client:{platform:'desktop',canPlayDirect:true,maxWidth:1920,maxHeight:1080,videoCodecs:['h264'],audioCodecs:['aac']}};
const hash='0'.repeat(40),tracker='udp://tracker.example:1337/announce';
const body=(renewed=false)=>({id:'playback_fixture',status:'ready',expires_at:1700000060+(renewed?20:0),renew_after_seconds:20,error_code:null,error:null,
  delivery:{kind:'native_torrent',position:12,live:false,format:'original',preferences:{audio_language:null,subtitle_language:null,subtitles_enabled:false},
    grant:{version:2,network_policy:'public_discovery_verified_v2',id:'grant_fixture',server_time:1700000000+(renewed?20:0),expires_at:1700000060+(renewed?20:0),
      info_hash:hash,file_index:null,archive_index:null,trackers:[tracker],input:{kind:'magnet',uri:`magnet:?xt=urn:btih:${hash}`}}}});
const response=(value:unknown,status=200):PrivateResponse=>({status,bytes:new TextEncoder().encode(JSON.stringify(value))});
function harness() {
  let now=100_000;
  const commands:Record<string,unknown>[]=[];
  const controlCalls:Record<string,unknown>[]=[];
  let observe:RuntimeReply={version:2,ok:true,media_url:`http://127.0.0.1:1234/media/${'a'.repeat(64)}`,progress:{stage:'buffering',ready:true,file_index:2,length:20*1024**3}};
  const port:TorrentRuntimePort={available:async()=>true,clock:async()=>now,call:async command=> {
    commands.push(command);
    if(command.op==='prepare')return {version:2,ok:true,handle:'1:1'};
    if(command.op==='observe')return observe;
    return {version:2,ok:true};
  }};
  const control=vi.fn(async(input:unknown)=> {
    const command=input as Record<string,unknown>;controlCalls.push(command);
    if(command.operation==='torrentRuntimeProtocol')return response({version:2,native_torrent_versions:[2]});
    if(command.operation==='playbackV2Stop'||command.operation==='playbackV2CancelRequest')return response({ok:true});
    return response(body(command.operation==='playbackV2Heartbeat'));
  });
  const ordinary=vi.fn();
  const runtime=new NativeTorrentTransport(port,control,ordinary,'https://fixture.invalid');
  return {runtime,commands,controlCalls,ordinary,control,port,setNow:(value:number)=>{now=value;},setObserve:(value:RuntimeReply)=>{observe=value;}};
}
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
describe('native runtime client effects with actual WASM authority',()=> {
  it('preserves hints, auto selection and large media without projecting a grant',async()=> {
    const h=harness();
    const lease=await h.runtime.start(request);
    expect(lease.session?.url).toContain('/media/');expect(JSON.stringify(lease)).not.toContain(hash);expect(JSON.stringify(lease)).not.toContain(tracker);
    expect(h.commands.find(command=>command.op==='prepare')).toMatchObject({source:{magnet:`magnet:?xt=urn:btih:${hash}`,trackers:[tracker]}});
    expect(h.commands.find(command=>command.op==='prepare')?.source).not.toHaveProperty('file_index');
    expect(h.commands.some(command=>command.op==='first_frame')).toBe(false);
    await h.runtime.firstFrame(lease.id);expect(h.commands.some(command=>command.op==='first_frame')).toBe(true);
    h.setNow(120_000);await h.runtime.renew(lease.id);
    await h.runtime.stop(lease.id);
    expect(h.commands.some(command=>command.op==='close')).toBe(true);expect(h.controlCalls.at(-1)).toEqual({operation:'playbackV2Stop',id:lease.id});
  });
  it('stops local media and reports the failed stage without a gateway retry',async()=> {
    const h=harness();const errors:unknown[]=[];h.runtime.subscribe(event=>{if(event.error)errors.push(event.error);});
    const lease=await h.runtime.start(request);
    h.setObserve({version:2,ok:true,progress:{stage:'opening_archive',ready:false,error:'compressed_archive_unsupported',file_index:2,length:0}});
    await vi.advanceTimersByTimeAsync(500);
    expect(errors).toEqual([expect.objectContaining({code:'native_archive_compressed'})]);expect(h.ordinary).not.toHaveBeenCalled();
    await h.runtime.stop(lease.id);
  });
  it('revokes every handle and clears content only on explicit principal retirement',async()=> {
    const h=harness();await h.runtime.start(request);await h.runtime.revoke(true);
    expect(h.commands.at(-1)).toEqual({op:'clear'});expect(h.commands.some(command=>command.op==='close')).toBe(true);
  });
  it('closes a preparation that returns after its caller cancels',async()=> {
    const h=harness();let finish!:(reply:RuntimeReply)=>void;
    const original=h.port.call;
    h.port.call=async(command)=>command.op==='prepare'?new Promise(resolve=>{finish=resolve;}):original(command);
    const abort=new AbortController(),pending=h.runtime.start(request,{signal:abort.signal});
    const rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});
    await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
    abort.abort();finish({version:2,ok:true,handle:'1:late'});await rejected;
    expect(h.commands).toContainEqual({op:'close',handle:'1:late'});
    expect(h.controlCalls.some(command=>command.operation==='playbackV2Stop')).toBe(true);
  });
  it('reuses one rendered-frame acknowledgement while it is pending',async()=> {
    const h=harness();const lease=await h.runtime.start(request);let finish!:(reply:RuntimeReply)=>void;
    const original=h.port.call;let calls=0;
    h.port.call=async(command)=> {if(command.op==='first_frame'){calls++;return new Promise(resolve=>{finish=resolve;});}return original(command);};
    const first=h.runtime.firstFrame(lease.id),second=h.runtime.firstFrame(lease.id);
    await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));finish({version:2,ok:true});await Promise.all([first,second]);
    expect(calls).toBe(1);await h.runtime.stop(lease.id);
  });
  it('keeps v2 capability on an unavailable runtime so torrents cannot become gateway delivery',async()=> {
    const h=harness();h.port.available=async()=>false;h.ordinary.mockResolvedValue({id:'http',status:'ready'});
    await h.runtime.start(request);
    expect(h.ordinary).toHaveBeenCalledWith(expect.objectContaining({client:expect.objectContaining({nativeTorrent:{version:2,networkPolicy:'public_discovery_verified_v2'}})}),undefined);
  });
});
