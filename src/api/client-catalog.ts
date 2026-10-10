/* TvApiClientBase: constructor, fields, session driver, device pairing,
   profiles and the catalog/detail/source request surface. */
import { normalizeCore as normalizeRust } from "../core";
import { TvApiError, normalizeResponse, profile, mediaItem, params, segment, expectObject, arrayValue, idAt, minimalItem } from "./client-shared";
import type { RequestOptions } from "./client-shared";
import type {
  Catalog,
  DiscoverPage,
  DiscoverRequest,
  JsonObject,
  MediaDetail,
  MediaItem,
  MediaSource,
  PlaybackSession,
  PlaybackStart,
  StreamDiscovery,
  SourcesPollState,
  SourcesPollStep,
  SourcesPollStepWithEvents,
  StreamPoll,
} from "./types";

import { TvApiClientBase } from "./client-base";
import { NativeTorrentTransport, type RuntimeEvent } from "./torrent-runtime";
import { PlaybackV2Transport } from "./playback-v2";
import type { PlaybackV2Request, PlaybackLease } from "../../vendor/core/typescript/wire";

export class TvApiCatalog extends TvApiClientBase {
  private readonly gatewayStages=new Set<(event:RuntimeEvent)=>void>();
  private readonly playbackV2 = new PlaybackV2Transport((input, options) => this.domainRequest(input, options), this.origin,
    (id,options)=>this.observeGatewayStage(id,options),(id,stage)=>{for(const listener of this.gatewayStages)listener({id,stage});});
  private async observeGatewayStage(id:string,options:RequestOptions) {
    const scope=new AbortController(),cancel=()=>scope.abort();
    options.signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(cancel,2000);
    try {
      if(options.signal?.aborted)return;
      const value=expectObject(await this.raw(`/api/v2/playback/${segment(id)}/progress`,{},true,{signal:scope.signal}));
      if(options.signal?.aborted || value.stage==null)return;
      const stage=normalizeResponse<string>('torrentRuntime',{operation:'stage',stage:value.stage});
      return stage;
    } catch { /* Advisory stages cannot extend authority or replace lease failures. */ }
    finally {clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
  }
  private readonly nativePlayback = this.torrentRuntimePort ? new NativeTorrentTransport(this.torrentRuntimePort,
    (input,options)=>this.privateControl(input,options),(request,options)=>this.playbackV2.start(request,options),this.origin) : undefined;
  protected override async revokeNative(clear=false) {await this.nativePlayback?.revoke(clear);}
  remainingStartupBudget(id:string) {return this.isNativePlayback(id) ? this.nativePlayback!.remainingStartup(id) : Promise.resolve(this.playbackV2.remainingStartup(id));}
  canConvertPlayback(id:string) {return !this.isNativePlayback(id);}
  isNativePlayback(id:string) {return this.nativePlayback?.has(id)??false;}
  nativePlaybackEvents(listener:(event:RuntimeEvent)=>void) {
    this.gatewayStages.add(listener);const native=this.nativePlayback?.subscribe(listener);
    return ()=>{this.gatewayStages.delete(listener);native?.();};
  }
  playbackFirstFrame(id:string) {return this.isNativePlayback(id) ? this.nativePlayback!.firstFrame(id) : this.playbackV2.firstFrame(id);}
  nativeFirstFrame(id:string) {return this.nativePlayback?.firstFrame(id)??Promise.resolve();}
  private readonly playbackLeases = new Map<string, PlaybackLease>();
  async startPlaybackV2(request: PlaybackV2Request, options?: RequestOptions) {
    const lease = await (this.nativePlayback ? this.nativePlayback.start(request,options) : this.playbackV2.start(request, options));
    this.playbackLeases.set(lease.id, lease);
    return lease;
  }
  playbackLease(id: string) { return this.playbackLeases.get(id); }
  playbackStatusV2(id: string, options?: RequestOptions) { return this.isNativePlayback(id) ? this.nativePlayback!.renew(id) : this.playbackV2.status(id, options); }
  async renewPlaybackV2(id: string, options?: RequestOptions) {
    const previous = this.playbackLeases.get(id);
    const lease = await (this.isNativePlayback(id) ? this.nativePlayback!.renew(id) : this.playbackV2.renew(id, options));
    if (previous && this.playbackLeases.get(id) === previous) this.playbackLeases.set(id, lease);
    return lease;
  }
  async stopPlaybackV2(id: string, options?: RequestOptions) {
    try { if(this.isNativePlayback(id)) await this.nativePlayback!.stop(id); else await this.playbackV2.stop(id, options); }
    finally { this.playbackLeases.delete(id); }
  }
  async selectProfile(profileId: string, options?: RequestOptions) {
    if (this.sessionEvent) {
      const view = await this.sessionEvent({ SelectProfile: { profileId } }, options);
      if (view.phase !== "Ready" || view.selectedProfileId !== profileId) throw new TvApiError(401, "Pairing required", "unauthorized");
      return;
    }
    await this.raw(
      "/api/auth/profile",
      { method: "POST", body: { profile_id: profileId } },
      true,
      options,
    );
    if (this.tokens) await this.saveTokens({ ...this.tokens, profileId });
  }
  async profiles(options?: RequestOptions) {
    if (this.sessionEvent) {
      const view = await this.sessionEvent("Retry", options);
      if (view.identity) return view.identity.profiles;
      throw new TvApiError(401, "Pairing required", "unauthorized");
    }
    return arrayValue(await this.raw("/api/profiles", {}, true, options)).map(
      profile,
    );
  }
  async createProfile(input: JsonObject, options?: RequestOptions) {
    return profile(
      expectObject(
        await this.raw(
          "/api/profiles",
          { method: "POST", body: input },
          true,
          options,
        ),
      ),
    );
  }
  async updateProfile(id: string, input: JsonObject, options?: RequestOptions) {
    return profile(
      expectObject(
        await this.raw(
          `/api/profiles/${segment(id)}`,
          { method: "PATCH", body: input },
          true,
          options,
        ),
      ),
    );
  }
  async deleteProfile(id: string, options?: RequestOptions) {
    await this.raw(
      `/api/profiles/${segment(id)}`,
      { method: "DELETE" },
      true,
      options,
    );
  }
  async catalogs(options?: RequestOptions) {
    return normalizeResponse<Catalog[]>("catalogs", await this.raw("/api/catalogs", {}, true, options));
  }
  async catalogRevision(options?: RequestOptions): Promise<string> {
    const value = expectObject(await this.raw("/api/catalogs/revision", {}, true, options)).revision;
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw new TvApiError(502, "The server returned an invalid catalog revision.", "invalid_catalog_revision");
    return value;
  }
  async discover(
    request: DiscoverRequest,
    options?: RequestOptions,
  ): Promise<DiscoverPage> {
    const query = params({
      type: request.type,
      catalog: request.catalog,
      addon_id: request.addonId,
      skip: request.skip,
      search: request.search,
      genre: request.genre,
      extras: request.extras ? JSON.stringify(request.extras) : undefined,
    });
    const v = expectObject(
      await this.raw(`/api/discover${query}`, {}, true, options),
    );
    const page = normalizeResponse<DiscoverPage>("discoverResponse", { response: v, type: request.type });
    if (!page.items.length && page.unsupportedCount) {
      throw new TvApiError(200, "This catalog returned a media type this app does not support.", "unsupported_media_type");
    }
    return page;
  }
  async detail(
    item: Pick<MediaItem, "id" | "type"> &
      Partial<Pick<MediaItem, "seriesId">>,
    options?: RequestOptions,
  ): Promise<MediaDetail> {
    const request = normalizeResponse<{ path: string }>("request", {
      operation: "metadata",
      item,
    });
    if (item.type === "live") return { item: minimalItem(item), episodes: [] };
    const envelope = expectObject(
      await this.raw(
        request.path,
        {},
        true,
        options,
      ),
    );
    return normalizeResponse<MediaDetail>("detailResponse", {
      response: envelope,
      item,
    });
  }

  async sources(
    item: MediaItem,
    options?: RequestOptions,
  ): Promise<StreamDiscovery> {
    const request = normalizeResponse<{ method: string; path: string; body: unknown }>(
      "request",
      { operation: "sourcesV2", item },
    );
    const v = expectObject(
      await this.raw(
        request.path,
        { method: request.method, body: request.body as JsonObject },
        true,
        options,
      ),
    );
    const id = idAt(v, "id");
    return { id };
  }
  /**
   * One polling step of stream discovery. Both the poll path (with its
   * cursor) and the cursor/dedup/budget/completion policy come from the
   * shared Rust core; the caller supplies its accumulated state and
   * transports one page at a time.
   */
  async pollSourcesStep(
    id: string,
    state: SourcesPollState,
    options?: RequestOptions & { readonly retainProducerFailures?: boolean },
  ): Promise<SourcesPollStepWithEvents> {
    const request = normalizeResponse<{ method: string; path: string }>(
      "request",
      { operation: "sourcesPollV2", id, after: state.after },
    );
    const v = expectObject(
      await this.raw(request.path, {}, true, options),
    );
    const step = normalizeResponse<SourcesPollStep>("sourcesPollStep", { state, poll: v });
    const events = normalizeResponse<StreamPoll>("streamPoll", v).events;
    const failure = step.state.errors?.[0];
    if (step.done && !step.sources.length && failure &&
        (!options?.retainProducerFailures || !events.some((event) => /^(addon|iptv):\d+$/.test(event.source)))) {
      throw new TvApiError(502, failure.message, failure.code ?? undefined);
    }
    return { ...step, events };
  }
  async startPlayback(
    request: PlaybackStart,
    options?: RequestOptions,
  ): Promise<PlaybackSession> {
    const {channelId,...playback}=request;
    if (channelId) {
      const source=await this.liveSourceV2(channelId,options);
      playback.streamId=source.id;
      playback.position=0;
    }
    const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    const canonical = normalizeResponse<PlaybackV2Request>('playbackV2Intent', { requestId, platform: this.playbackPlatform, playback });
    const lease = await this.startPlaybackV2(canonical, options);
    return lease.session!;
  }
  async liveSourceV2(channelId: string, options?: RequestOptions): Promise<MediaSource> {
    const value=await this.domainRequest({operation:'liveSourceV2',id:channelId},options);
    try { return normalizeRust<MediaSource>('liveSourceV2',value); }
    catch { throw new TvApiError(502,'The server returned invalid live source data. Update the app/server or retry.','invalid_catalog_response'); }
  }
  async heartbeat(id: string, options?: RequestOptions, position?: number) {
    await this.renewPlaybackV2(id, options);
  }
  async stopPlayback(id: string, options?: RequestOptions) {
    await this.stopPlaybackV2(id, options);
  }
  /** There is no separate seek route: restart the selected opaque stream at `position`. */
  async seek(
    request: PlaybackStart & { readonly position: number },
    options?: RequestOptions,
  ) {
    return this.startPlayback(request, options);
  }
  /** Track selection is applied at playback start; server transcodes/remuxes a new safe session. */
  async startWithTracks(
    request: PlaybackStart & {
      readonly audioTrackIndex?: number;
      readonly subtitleTrackIndex?: number;
      readonly subtitlesOff?: boolean;
    },
    options?: RequestOptions,
  ) {
    return this.startPlayback(request, options);
  }
  async progress(profileId: string, options?: RequestOptions) {
    return arrayValue(
      await this.raw(
        `/api/profiles/${segment(profileId)}/progress`,
        {},
        true,
        options,
      ),
    ).map(mediaItem);
  }
  async seriesProgress(
    profileId: string,
    seriesId: string,
    options?: RequestOptions,
  ): Promise<readonly MediaItem[]> {
    return arrayValue(
      await this.raw(
        `/api/profiles/${segment(profileId)}/progress/series${params({ series_id: seriesId })}`,
        {},
        true,
        options,
      ),
    ).map(mediaItem);
  }
  async saveProgress(
    profileId: string,
    item: MediaItem,
    position: number,
    duration: number,
    options?: RequestOptions,
  ) {
    if (!Number.isFinite(position) || !Number.isFinite(duration)) return;
    await this.domainRequest({ operation: "saveProgress", profileId, item, position: Math.max(0, position), duration: Math.max(0, duration) }, options);
  }
  async correctProgress(
    profileId: string,
    item: MediaItem,
    watched: boolean,
    options?: RequestOptions,
  ) {
    await this.domainRequest({ operation: "correctProgress", profileId, item, action: watched ? "watched" : "unwatched", duration: item.duration ?? 0 }, options);
  }
}
