import { TorrentRuntimeBridge } from '../../vendor/core/wasm/viptv_core';
import type { NativeTorrentState, PlaybackLease, PlaybackV2Request } from '../../vendor/core/typescript/wire';
import { normalizeResponse, throwIfAborted, TvApiError, type RequestOptions } from './client-shared';

/** Private native effect port. Hosted browser and TV clients never receive one. */
export interface TorrentRuntimePort {
  available(): Promise<boolean>;
  clock(): Promise<number>;
  call(command: Record<string, unknown>): Promise<RuntimeReply>;
}
export interface RuntimeReply {
  version: number; ok: boolean; terminate?: boolean; error?: string;
  handle?: string; media_url?: string;
  progress?: {stage: string; ready: boolean; error?: string; file_index: number; archive_index?: number; length: number};
}
export interface PrivateResponse { status: number; bytes: Uint8Array }
type Control = (input: unknown, options?: RequestOptions) => Promise<PrivateResponse>;
type Ordinary = (request: PlaybackV2Request, options?: RequestOptions) => Promise<PlaybackLease>;
export type RuntimeEvent = {id?: string; stage?: string; error?: TvApiError};
const text = new TextDecoder('utf-8', {fatal: true});
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
const invalid = () => new TvApiError(502,'The server returned an invalid playback session.','invalid_playback_response');
const expired = () => new TvApiError(410,'This playback session has expired. Start playback again.','native_authorization_expired');
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve,reject)=> {
    const cancel=()=> {clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Aborted','AbortError'));};
    const timer=setTimeout(()=> {signal?.removeEventListener('abort',cancel);resolve();},ms);
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  });
}

/** A slow response body is still part of preparation, not a new startup budget. */
async function startupControl(control:Control,input:unknown,options:RequestOptions|undefined,remaining:number):Promise<PrivateResponse> {
  throwIfAborted(options?.signal);
  const abort=new AbortController();
  const cancel=()=>abort.abort();
  options?.signal?.addEventListener('abort',cancel,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;abort.abort();},Math.max(1,remaining));
  try {
    if(remaining<=0)throw new TvApiError(408,'Playback did not reach its first frame within the startup deadline.','native_acquisition_timeout');
    const result=await control(input,{signal:abort.signal});
    if(timedOut)throw new TvApiError(408,'Playback did not reach its first frame within the startup deadline.','native_acquisition_timeout');
    throwIfAborted(options?.signal);
    return result;
  } catch(error) {
    if(timedOut)throw new TvApiError(408,'Playback did not reach its first frame within the startup deadline.','native_acquisition_timeout');
    throwIfAborted(options?.signal);throw error;
  } finally {clearTimeout(timer);options?.signal?.removeEventListener('abort',cancel);}
}

/** Rust validates authority and selection; this object executes network, IPC and timers. */
export class NativeTorrentTransport {
  private readonly owners = new Set<Owner>();
  private readonly sessions = new Map<string,Owner>();
  private readonly listeners = new Set<(event: RuntimeEvent)=>void>();
  constructor(private readonly port: TorrentRuntimePort,private readonly control: Control,private readonly ordinary: Ordinary,private readonly origin: string) {}
  subscribe(listener:(event:RuntimeEvent)=>void) {this.listeners.add(listener);return ()=> {this.listeners.delete(listener);};}
  private emit(event:RuntimeEvent) {for(const listener of this.listeners)listener(event);}
  has(id:string) {return this.sessions.has(id);}
  async start(input:PlaybackV2Request,options?:RequestOptions):Promise<PlaybackLease> {
    const request:PlaybackV2Request={...input,client:{...input.client,nativeTorrent:{version:2,networkPolicy:'public_discovery_verified_v2'}}};
    const started=await this.port.clock().catch(()=>undefined);
    const qualified=started!==undefined && await this.port.available().catch(()=>false);
    throwIfAborted(options?.signal);
    if(!qualified)return this.ordinary(request,options);
    const protocol=await startupControl(this.control,{operation:'torrentRuntimeProtocol'},options,started!+120_000-await this.port.clock());
    const decision=normalizeResponse<string>('torrentRuntime',{operation:'negotiation',platform:request.client.platform,qualified,
      scopeMatches:!options?.signal?.aborted,status:protocol.status,authorizationRefused:[401,403].includes(protocol.status),body:text.decode(protocol.bytes)});
    if(decision==='authRecovery')throw new TvApiError(403,'Your session is no longer authorized.','unauthorized');
    if(decision!=='advertise')return this.ordinary(request,options);
    const scope=id();
    let bridge:TorrentRuntimeBridge;
    try {bridge=new TorrentRuntimeBridge(JSON.stringify({origin:this.origin,scope,generation:1,qualified:true,negotiated:true,vod:true,request}));}
    catch {return this.ordinary(request,options);}
    const owner=new Owner(bridge,scope,request,started!,this.port,this.control,this.origin,event=>this.emit(event));
    this.owners.add(owner);
    const cancel=()=> {void owner.stop();};
    options?.signal?.addEventListener('abort',cancel,{once:true});
    try {
      const result=await owner.start(options?.signal);
      if(result.ordinary) {
        await owner.closeLocal();this.owners.delete(owner);
        return result.ordinary;
      }
      const lease=result.lease!;
      this.sessions.set(lease.id,owner);
      owner.monitor(error=>this.emit({id:lease.id,error}));
      return lease;
    } catch(error) {await owner.stop();this.owners.delete(owner);throw error;}
    finally {options?.signal?.removeEventListener('abort',cancel);}
  }
  async renew(id:string):Promise<PlaybackLease> {const owner=this.sessions.get(id);if(!owner)throw expired();return owner.renew();}
  async firstFrame(id:string) {await this.sessions.get(id)?.firstFrame();}
  async remainingStartup(id:string) {return this.sessions.get(id)?.remainingStartup();}
  async stop(id:string) {const owner=this.sessions.get(id);if(!owner)return;this.sessions.delete(id);this.owners.delete(owner);await owner.stop();}
  async revoke(clear=false) {
    const owners=[...this.owners];this.sessions.clear();this.owners.clear();
    await Promise.all(owners.map(owner=>owner.stop()));
    await this.port.call({op:clear?'clear':'shutdown'});
  }
}

class Owner {
  private readonly cancelled=new AbortController();
  private sequence=0;
  private chain:Promise<unknown>=Promise.resolve();
  private state:NativeTorrentState={status:'idle',deadlineMillis:null,expiresAtUnixMillis:null,position:null,audioLanguage:null,subtitleLanguage:null,subtitlesEnabled:null,error:null};
  private anchorElapsed=0;private anchorWall=0;
  private handle?:string;private playbackId?:string;private url?:string;
  private released=false;private localClosed=false;private frame=false;private closedHandle?:string;
  private lastAuthority=0;private lastStage?:string;
  private frameFlight?:Promise<void>;
  private pulse?:ReturnType<typeof setInterval>;private tick?:ReturnType<typeof setTimeout>;
  private readonly startupDeadline:number;
  constructor(private readonly bridge:TorrentRuntimeBridge,private readonly scope:string,private readonly request:PlaybackV2Request,
    started:number,private readonly port:TorrentRuntimePort,private readonly control:Control,private readonly origin:string,private readonly emit:(event:RuntimeEvent)=>void) {this.startupDeadline=started+120_000;}
  private async requestControl(operation:string):Promise<PrivateResponse> {
    const execute=async()=> {
      throwIfAborted(this.cancelled.signal);
      const sent=await this.port.clock();
      const command={operation,...(operation==='playbackV2'?{playback:this.request}:{id:this.playbackId})};
      const response=this.frame ? await this.control(command,{signal:this.cancelled.signal}) : await startupControl(this.control,command,{signal:this.cancelled.signal},this.startupDeadline-sent);
      const received=await this.port.clock();throwIfAborted(this.cancelled.signal);
      if(![200,202].includes(response.status)) {
        let code:unknown;
        if(response.bytes.length<=4096) {try {const envelope:unknown=JSON.parse(text.decode(response.bytes));if(envelope&&typeof envelope==='object'&&!Array.isArray(envelope))code=(envelope as Record<string,unknown>).error_code;}catch { /* Only closed status/code facts may leave private control. */ }}
        const failure=normalizeResponse<{message:string;code?:string}>('apiError',{status:response.status,error_code:typeof code==='string'?code:undefined});
        throw new TvApiError(response.status,failure.message,failure.code);
      }
      this.state=JSON.parse(this.bridge.acceptMeasuredBytes(response.status,response.bytes,JSON.stringify({scope:this.scope,generation:1,sequence:++this.sequence,
        operation:operation==='playbackV2'?'start':operation==='playbackV2Heartbeat'?'heartbeat':'poll',receivedAtMillis:received,
        roundTripMillis:received-sent,uncertaintyMillis:0,maxUncertaintyMillis:0,trustedWallUpperUnixMillis:null,suspendAware:true}))) as NativeTorrentState;
      this.playbackId=this.bridge.playbackId()??undefined;
      const wall=this.bridge.trustedWallUpperUnixMillis();
      if(wall!==undefined){this.anchorWall=Number(wall);this.anchorElapsed=received;}
      return response;
    };
    const result=this.chain.then(execute,execute);this.chain=result.catch(()=>undefined);return result;
  }
  private async facts():Promise<{text:string;now:number;remaining:number}> {
    const now=await this.port.clock();throwIfAborted(this.cancelled.signal);
    const facts=JSON.stringify({scope:this.scope,generation:1,nowMillis:now,trustedWallUpperUnixMillis:this.anchorWall+now-this.anchorElapsed,
      backendRevalidated:true,suspendAware:true});
    this.state=JSON.parse(this.bridge.authorize(facts)) as NativeTorrentState;
    return {text:facts,now,remaining:Math.min(60_000,(this.state.deadlineMillis??0)-now)};
  }
  async start(signal?:AbortSignal):Promise<{lease?:PlaybackLease;ordinary?:PlaybackLease}> {
    let response=await this.requestControl('playbackV2');
    this.pulse=setInterval(()=> {void this.renew().catch(async(error)=> {
      if(this.cancelled.signal.aborted)return;
      if(error instanceof TvApiError && (error.status===0 || error.status>=500&&error.code!=='invalid_playback_response'))return;
      await this.stop();this.emit({id:this.playbackId,error:error instanceof TvApiError?error:invalid()});
    });},20_000);
    while(this.state.status==='starting') {
      throwIfAborted(signal);await this.checkStartup();
      response=await this.requestControl('playbackV2Status');if(this.state.status==='starting')await wait(250,this.cancelled.signal);
    }
    if(this.state.status==='legacy') {
      // Only the private holder can authorize projection of an ordinary response.
      clearInterval(this.pulse);this.playbackId=undefined;this.released=true;
      return {ordinary:normalizeResponse<PlaybackLease>('playbackV2',JSON.parse(text.decode(response.bytes)),this.origin)};
    }
    if(this.state.status!=='ready')throw new TvApiError(409,this.state.error??'Playback preparation failed.','native_playback_failed');
    const facts=await this.facts();
    const kind=this.bridge.privateInputKind(facts.text),value=this.bridge.privateInputValue(facts.text);
    const source:Record<string,unknown>={...(kind==='magnet'?{magnet:value}:{metainfo:value}),trackers:this.bridge.privateTrackers(facts.text)};
    const file=this.bridge.privateFileIndex(facts.text),archive=this.bridge.privateArchiveIndex(facts.text),size=this.bridge.privateExpectedFileSize(facts.text);
    if(file!==undefined)source.file_index=file;if(archive!==undefined)source.archive_index=archive;if(size!==undefined)source.expected_file_size=Number(size);
    const prepared=await this.port.call({op:'prepare',source,authority_ms:facts.remaining});
    if(!prepared.ok||!prepared.handle)throw invalid();this.handle=prepared.handle;
    if(this.cancelled.signal.aborted){await this.closeLocal();throw new DOMException('Aborted','AbortError');}
    for(;;) {
      await this.checkStartup();throwIfAborted(signal);
      const reply=await this.observe();
      if(reply.progress?.ready) {
        const progress=reply.progress,clock=await this.facts();
        this.bridge.bindResolution(progress.file_index,progress.archive_index,BigInt(progress.length),clock.text);
        const uri=new URL(reply.media_url??'');
        if(uri.protocol!=='http:'||uri.hostname!=='127.0.0.1'||!uri.port||uri.username||uri.password||uri.search||uri.hash||!/^\/media\/[a-f0-9]{64}$/.test(uri.pathname))throw invalid();
        this.url=uri.href;return {lease:this.lease()};
      }
      await wait(100,this.cancelled.signal);
    }
  }
  private async checkStartup() {if(await this.port.clock()>=this.startupDeadline)throw new TvApiError(408,'Playback did not reach its first frame within the startup deadline.','native_acquisition_timeout');}
  private async observe():Promise<RuntimeReply> {
    const clock=await this.facts();
    if(clock.remaining<=0)throw expired();
    if(clock.now+clock.remaining>this.lastAuthority+1000) {
      const renewed=await this.port.call({op:'renew',handle:this.handle,authority_ms:clock.remaining});if(!renewed.ok)throw expired();this.lastAuthority=clock.now+clock.remaining;
    }
    const reply=await this.port.call({op:'observe',handle:this.handle});
    if(!reply.ok||!reply.progress)throw invalid();
    const progress=reply.progress;
    if(progress.error) {
      const failure=normalizeResponse<{message:string;code:string}>('torrentRuntime',{operation:'failure',stage:progress.stage,reason:progress.error});
      throw new TvApiError(409,failure.message,failure.code);
    }
    if(progress.stage!==this.lastStage){this.lastStage=progress.stage;this.emit({id:this.playbackId,stage:normalizeResponse<string>('torrentRuntime',{operation:'stage',stage:progress.stage})});}
    return reply;
  }
  private lease():PlaybackLease {
    if(!this.playbackId||!this.url)throw invalid();
    return {id:this.playbackId,status:'ready',errorCode:null,error:null,expiresAt:this.state.expiresAtUnixMillis!,renewAfterSeconds:20,
      session:{id:this.playbackId,url:this.url,headers:{},format:'original',mode:'direct',videoMode:'copy',audioMode:'copy',position:this.state.position??0,
        live:false,duration:0,audioTracks:[],subtitleTracks:[],subtitlesSupported:true,deliveryKind:'direct',preferredAudioLanguage:this.state.audioLanguage??undefined,
        preferredSubtitleLanguage:this.state.subtitleLanguage??undefined}};
  }
  async renew():Promise<PlaybackLease> {await this.requestControl('playbackV2Heartbeat');if(this.state.status!=='ready')throw expired();return this.url?this.lease():{id:this.playbackId!,status:'starting',expiresAt:0,renewAfterSeconds:20,session:null,errorCode:null,error:null};}
  monitor(failed:(error:TvApiError)=>void) {
    const next=async()=> {
      try {if(this.cancelled.signal.aborted)return;if(!this.frame)await this.checkStartup();await this.observe();this.tick=setTimeout(()=>{void next();},200);}
      catch(error){if(this.cancelled.signal.aborted)return;await this.stop();failed(error instanceof TvApiError?error:expired());}
    };
    void next();
  }
  async firstFrame() {
    if(this.frame||this.cancelled.signal.aborted)return;
    if(this.frameFlight)return this.frameFlight;
    const acknowledge=async()=> {await this.checkStartup();await this.facts();const reply=await this.port.call({op:'first_frame',handle:this.handle});if(!reply.ok)throw expired();this.frame=true;};
    this.frameFlight=acknowledge().finally(()=>{this.frameFlight=undefined;});
    return this.frameFlight;
  }
  async remainingStartup() {return this.frame?undefined:Math.max(0,this.startupDeadline-await this.port.clock());}
  async closeLocal() {
    if(!this.localClosed){this.localClosed=true;clearInterval(this.pulse);clearTimeout(this.tick);this.bridge.invalidate();}
    if(this.handle&&this.closedHandle!==this.handle){this.closedHandle=this.handle;await this.port.call({op:'close',handle:this.handle}).catch(()=>undefined);}
  }
  async stop() {
    this.cancelled.abort();await this.closeLocal();
    if(this.released)return;this.released=true;
    const cleanup=new AbortController(),timer=setTimeout(()=>cleanup.abort(),5000);
    try {await this.control(this.playbackId?{operation:'playbackV2Stop',id:this.playbackId}:{operation:'playbackV2CancelRequest',requestId:this.request.requestId},{signal:cleanup.signal});}
    catch {/* Independent backend expiry bounds failed remote cleanup. */}finally{clearTimeout(timer);}
  }
}
