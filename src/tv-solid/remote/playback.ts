import { TizenAvplayAdapter } from "../../../vendor/video/src/tizen-avplay";
import type { Player, PlayerSnapshot } from "../../../vendor/video/src/types";
import { RemoteTvApi, RemoteError, segment } from "./api";
import { DeferredPlayer } from "./deferred-player";
import { inScope } from "./operation-scope";
import { ensureTizenSurface } from "../platform/tizen-host";
import type {
  Card,
  Lease,
  Source,
  PlaybackActions,
  SourceReplacement,
} from "./types";
const noActions: PlaybackActions = {
  pause: false,
  seek: false,
  restart: false,
  change_source: false,
  episodes: false,
  next_episode: false,
  tracks: false,
  subtitle_style: false,
  report_progress: false,
};

/** Decoder effects and lease lifetimes only. The server selects every source,
 * episode, resume position and output; this class never chooses a fallback. */
export class RemotePlayback {
  readonly player: Player;
  private lease?: Lease;
  private card?: Card;
  private source?: Source;
  private directMode = false;
  private seekView?: { time: PlayerSnapshot["time"]; actions: PlaybackActions; lease: Lease; opened: boolean };
  private sourceRetry?: { card: Card; request: SourceReplacement };
  private heartbeat?: ReturnType<typeof setTimeout>;
  private expiry?: ReturnType<typeof setTimeout>;
  private operation?: AbortController;
  private admitting = false;
  private generation = 0;
  private intentGeneration=0;
  private sequence = 0;
  private events: Promise<unknown> = Promise.resolve();
  private pendingEvents = 0;
  private first = false;
  private failing = false;
  private lastProgress = 0;
  private startPosition = 0;
  private activity = 0;
  private lastState: PlayerSnapshot["state"] = "idle";
  private unsubscribe: () => void;
  private selection: {
    audio_track?: number;
    subtitle_track?: number;
    subtitles_off?: boolean;
  } = {};

  constructor(
    private api: RemoteTvApi,
    platform: string,
    video: HTMLVideoElement,
    private publish: (snapshot: PlayerSnapshot) => void,
    private failure: (error: Error, position?: number) => void,
    private presented?: (leaseId: string, card: Card, source: Source) => void,
  ) {
    // AVPlay is a small SDK shim the platform needs from the first session, so
    // it stays in the boot graph. The HTML/HLS engine drags in hls.js (1450 KiB
    // of source, most of the TV entry's largest chunk) and is only reachable
    // from a session, so `playback.ts` fetches it through `import()` in
    // `hls-engine.ts` instead of importing it here.
    const nativePlayer = (globalThis as any).__viptvCreatePlayer;
    this.player =
      typeof nativePlayer === "function"
        ? nativePlayer()
        : platform === "tizen" && (window as any).webapis?.avplay
          ? (ensureTizenSurface(), new TizenAvplayAdapter())
          : new DeferredPlayer(async () =>
              (await import("./hls-engine")).createHtmlHlsPlayer(video),
            );
    this.unsubscribe = this.player.subscribe((snapshot) => {
      const previous = this.lastState;
      this.lastState = snapshot.state;
      this.present(snapshot);
      const lease = this.lease;
      if (snapshot.state === "playing" && lease) {
        // HTML supplies measured decoded-frame evidence. AVPlay exposes an
        // advancing SDK media clock; physical video presentation is a device gate.
        const decoded =
          snapshot.diagnostics?.firstFrameMs !== undefined ||
          snapshot.diagnostics?.presentationEvidence === "media-progress" ||
          (snapshot.diagnostics?.presentedFrames ?? 0) > 0 ||
          (snapshot.diagnostics?.presentedFrames === undefined &&
            this.player.capabilities.platform !== "tizen" &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            snapshot.time.positionSeconds > this.startPosition) ||
          (this.player.capabilities.platform === "tizen" &&
            snapshot.time.positionSeconds > this.startPosition);
        if (!this.first && decoded) {
          this.first = true;
          this.sourceRetry = undefined;
          this.lastProgress = Date.now();
          if (this.card && this.source) {
            try { this.presented?.(lease.id, this.card, this.source); } catch { /* persistence never interrupts video */ }
          }
          void api
            .call(`/api/playback/${segment(lease.id)}/first-frame`, "POST", {})
            .catch((error) => {
              if (this.lease?.id === lease.id && this.player.snapshot.state !== "ended") this.fail(error);
            });
          this.event("start");
        } else if (this.first && previous !== "playing") {
          this.lastProgress = Date.now();
          this.event("start");
        } else if (this.first && Date.now() - this.lastProgress > 15000) {
          this.lastProgress = Date.now();
          // Do not accumulate periodic observations behind a stalled request.
          if (!this.pendingEvents) this.event("start");
        }
      }
      if (snapshot.state === "paused" && previous !== "paused")
        this.event("pause");
      if (snapshot.state === "ended" && previous !== "ended") {
        clearTimeout(this.heartbeat);
        clearTimeout(this.expiry);
        this.event("stop", true);
      }
      // Once a seek retires its lease, late decoder/network errors belong
      // to that paused outgoing picture, not the incoming admission.
      if (snapshot.error && !(this.seekView && !this.lease)) this.fail(new Error(snapshot.error.message));
    });
    document.addEventListener("visibilitychange", this.foreground);
    window.addEventListener("keydown", this.interaction, true);
    window.addEventListener("pointerdown", this.interaction, true);
  }
  private present(snapshot: PlayerSnapshot) {
    let held = this.seekView;
    if (held && held.opened &&
        ["ready", "playing", "paused"].includes(snapshot.state) &&
        Math.abs(snapshot.time.positionSeconds - held.time.positionSeconds) < 2 &&
        (snapshot.time.durationSeconds !== null || held.time.durationSeconds === null)) {
      this.seekView = undefined;
      held = undefined;
    }
    this.publish(held && (!snapshot.error || !this.lease)
      ? { ...snapshot, error: null, state: snapshot.state === "paused" ? "paused" : "buffering", time: held.time }
      : snapshot);
  }
  private interaction = () => {
    this.activity++;
  };
  get subtitleAppearance() {
    return (this.lease ?? this.seekView?.lease)?.delivery?.subtitle_appearance;
  }
  get leaseId() {
    return this.lease?.id;
  }
  get hasPresentedFrame() { return this.first && !!this.lease; }
  get actions(): PlaybackActions {
    return this.lease?.actions ?? this.seekView?.actions ?? noActions;
  }
  private replacementObservation() {
    if (!this.lease || !this.card || !this.actions.change_source)
      return undefined;
    return {
      card: this.card,
      request: {
        playback_id: this.lease.id,
        observed_position: this.first
          ? this.player.snapshot.time.positionSeconds
          : this.startPosition,
      },
    };
  }
  get canReplaceSource() {
    return !!(this.sourceRetry ?? this.replacementObservation());
  }
  async replaceSource(source: Source) {
    const context = this.sourceRetry ?? this.replacementObservation();
    if (!context)
      throw new Error("Source changes are unavailable for this playback.");
    await this.replaceWith(source, context);
  }
  private async replaceWith(
    source: Source,
    context: { card: Card; request: SourceReplacement },
    selection: typeof this.selection = {},
  ) {
    this.sourceRetry = context;
    try {
      await this.start(
        context.card,
        source,
        false,
        undefined,
        selection,
        context.request,
        false,
        this.player.snapshot.state === "paused",
      );
      if (this.sourceRetry === context) this.sourceRetry = undefined;
    } catch (error) {
      if (
        this.sourceRetry === context &&
        (this.lease?.id !== context.request.playback_id ||
          (error instanceof RemoteError && [
            "playback_replacement_invalid", "playback_not_found",
            "playback_expired", "authorization_expired",
          ].includes(error.code)))
      )
        this.sourceRetry = undefined;
      throw error;
    }
  }
  get tracks() {
    const lease = this.lease ?? this.seekView?.lease;
    return {
      audio: lease?.delivery?.audio_tracks ?? [],
      text: lease?.delivery?.subtitle_tracks ?? [],
      subtitlesSupported: lease?.delivery?.subtitles_supported === true,
    };
  }
  async selectTrack(kind: "audio" | "text", index: number | null) {
    if (!this.card || !this.source) return;
    if (!this.actions.tracks)
      throw new Error("Track selection is unavailable for this playback.");
    const tracks = kind === "audio" ? this.tracks.audio : this.tracks.text;
    if (tracks.some(track => track.selected && track.input_index === index) ||
        (kind === "text" && index === null && this.tracks.subtitlesSupported &&
          !tracks.some(track => track.selected))) return;
    const selection = {
      ...this.selection,
      ...(kind === "audio"
        ? { audio_track: index ?? undefined }
        : {
            subtitle_track: index ?? undefined,
            subtitles_off: index === null,
          }),
    };
    await this.replaceWith(
      this.source,
      {
        card: this.card,
        request: {
          playback_id: this.lease!.id,
          observed_position: this.first
            ? this.player.snapshot.time.positionSeconds
            : this.startPosition,
        },
      },
      selection,
    );
  }
  private foreground = () => {
    if (document.visibilityState !== "visible" || !this.lease || this.player.snapshot.state === "ended") return;
    const lease = this.lease,
      activity = this.activity,
      playing = this.player.snapshot.state === "playing";
    void this.player
      .pause()
      .then(() =>
        this.api.call<Lease>(
          `/api/playback/${segment(lease.id)}/heartbeat`,
          "POST",
        ),
      )
      .then(async (value) => {
        if (this.lease?.id !== lease.id) return;
        if (value.status !== "ready")
          throw new Error("Playback authorization ended.");
        this.lease = value;
        this.present({ ...this.player.snapshot });
        this.schedule();
        if (
          this.lease?.id === lease.id &&
          playing &&
          activity === this.activity &&
          document.visibilityState === "visible"
        )
          await this.player.play();
      })
      .catch((error) => {
        if (this.lease?.id === lease.id && this.player.snapshot.state !== "ended") this.fail(error);
      });
  };
  private fail(error: Error) {
    if (this.failing) return;
    this.failing = true;
    const position = this.seekView?.time.positionSeconds ?? this.player.snapshot.time.positionSeconds;
    // A terminal decoder failure retires its lease. Only an admission failure
    // with a still-live outgoing lease can retain a replacement binding.
    this.sourceRetry = undefined;
    this.intentGeneration++;
    void this.stopCurrent(false).catch(() => {});
    this.failure(error, Number.isFinite(position) ? Math.max(0, position) : undefined);
  }
  private schedule() {
    clearTimeout(this.heartbeat);
    if (this.player.snapshot.state === "ended") return;
    clearTimeout(this.expiry);
    const lease = this.lease;
    if (!lease) return;
    const remaining =
      Number(lease.expires_at) * 1000 - this.api.serverNow - 1000;
    if (!Number.isFinite(remaining) || remaining <= 0) {
      this.fail(new Error("Playback authorization expired."));
      return;
    }
    // Expiry is independent of a heartbeat request, including a stalled network.
    this.expiry = setTimeout(() => {
      if (this.lease?.id === lease.id)
        this.fail(new Error("Playback authorization expired."));
    }, remaining);
    this.heartbeat = setTimeout(
      () => {
        void this.api
          .call<Lease>(`/api/playback/${segment(lease.id)}/heartbeat`, "POST")
          .then((value) => {
            if (this.lease?.id !== lease.id) return;
            if (value.status !== "ready")
              throw new Error("Playback authorization ended.");
            this.lease = value;
            this.present({ ...this.player.snapshot });
            this.schedule();
          })
          .catch((error) => {
            if (this.lease?.id === lease.id && this.player.snapshot.state !== "ended") this.fail(error);
          });
      },
      Math.max(1, lease.renew_after_seconds) * 1000,
    );
  }
  private event(event: string, ended = false) {
    if (
      !this.lease ||
      !this.card ||
      !this.first ||
      !this.api.profile ||
      !this.actions.report_progress
    )
      return;
    const card = this.card,
      time = this.player.snapshot.time,
      profilePath = this.api.scoped("");
    const epoch = this.api.scopeEpoch;
    const milliseconds = (value: number | null) =>
      Number.isFinite(value) ? Math.max(0, Math.round((value ?? 0) * 1000)) : 0;
    const body = {
      attempt_id: this.lease.id,
      sequence: ++this.sequence,
      identity: card.identity,
      parent_identity: card.parent_identity,
      event,
      position_millis: milliseconds(time.positionSeconds),
      duration_millis: milliseconds(time.durationSeconds),
      ended,
    };
    const record = {
      presentation: card,
      identity: card.identity,
      parent_identity: card.parent_identity,
      metadata_origin: card.metadata_origin,
      provider_id: card.provider_id,
      title: card.title,
      poster: card.poster ?? null,
      landscape: card.landscape ?? null,
      position_millis: body.position_millis,
      duration_millis: body.duration_millis,
      updated_at_millis: 0,
      completed_at_millis: null,
    };
    this.pendingEvents++;
    this.events = this.events
      .catch(() => {})
      .then(async () => {
        if (epoch !== this.api.scopeEpoch || !this.api.profile) return;
        await this.api.call(`${profilePath}/progress`, "PUT", {
          record,
          ended,
        });
        if (epoch === this.api.scopeEpoch && this.api.profile)
          await this.api.call(`${profilePath}/playback-events`, "POST", body);
      })
      .finally(() => {
        this.pendingEvents--;
      });
    void this.events.catch(() => {});
  }
  async start(
    card: Card,
    source: Source,
    resume: boolean,
    position?: number,
    selection: typeof this.selection = {},
    replacement?: SourceReplacement,
    direct = false,
    paused = false,
    retireForSeek = false,
  ) {
    this.seekView = undefined;
    const directMode = direct || (replacement ? this.directMode : false);
    const intent = ++this.intentGeneration;
    if (!replacement) this.sourceRetry = undefined;
    this.failing = false;
    // Admit the replacement while the current picture is still playing. A
    // gateway cut can take many seconds; stopping first left the viewer on a
    // black screen for the whole admission.
    // A new start supersedes any admission still polling for a previous one.
    this.operation?.abort();
    if (retireForSeek && this.lease) {
      // Hold the paused decoder picture while freeing the old gateway slot.
      // Managed seeks need a new producer; overlapping leases can exhaust it.
      if (this.player.snapshot.state !== "paused") await this.player.pause();
      if (intent !== this.intentGeneration) throw new DOMException("Playback cancelled", "AbortError");
      const outgoing = this.lease;
      this.event("stop");
      clearTimeout(this.heartbeat);clearTimeout(this.expiry);
      this.lease = undefined;
      if (outgoing) await this.api.release(`/api/playback/${segment(outgoing.id)}`);
      if (intent !== this.intentGeneration) throw new DOMException("Playback cancelled", "AbortError");
    }
    const admitScope = new AbortController();
    this.operation = admitScope;
    this.admitting = true;
    let lease: Lease;
    try {
      lease = await this.api.admit(source, resume, admitScope.signal, position, selection, replacement, directMode);
    } finally {
      if (this.operation === admitScope) this.admitting = false;
    }
    if (intent !== this.intentGeneration) {
      void this.api.release(`/api/playback/${segment(lease.id)}`);
      throw new DOMException("Playback cancelled", "AbortError");
    }
    const retiring = this.stopCurrent(true);
    const handoff = new AbortController();
    this.operation = handoff;
    this.admitting = true;
    try {
      await inScope(retiring, handoff.signal);
      if (intent !== this.intentGeneration)
        throw new DOMException("Playback cancelled", "AbortError");
    } catch (error) {
      void this.api.release(`/api/playback/${segment(lease.id)}`);
      throw error;
    } finally {
      if (this.operation === handoff) this.admitting = false;
    }
    const generation = ++this.generation,
      scope = new AbortController();
    this.operation = scope;
    this.lease = lease;
    this.card = card;
    this.source = source;
    this.selection = selection;
    this.directMode = directMode;
    this.sequence = 0;
    this.first = false;
    const delivery = lease.delivery!;
    this.startPosition =
      (delivery.position ?? 0) + (delivery.timeline_offset_seconds ?? 0);
    this.schedule();
    try {
      if (generation !== this.generation)
        throw new DOMException("Playback cancelled", "AbortError");
      await this.player.open({
        url: delivery.url,
        kind: delivery.live ? "live" : "vod",
        startAtSeconds: delivery.position ?? 0,
        timelineOffsetSeconds: delivery.timeline_offset_seconds ?? 0,
        timelineDurationSeconds: delivery.duration,
        deliveryMode: delivery.kind === "direct" ? "direct" : "managed",
        deliveryFormat: delivery.format === "original" ? undefined : delivery.format,
        paused,
        // The gateway publishes only the server-selected subtitle rendition.
        // Language carries that presentation intent without passing input-track
        // indices to a native output-track API.
        preferredSubtitleLanguage: delivery.subtitle_tracks?.find(track => track.selected)?.language
          ?? (delivery.subtitle_tracks?.some(track => track.selected) ? "und" : undefined),
        ...(delivery.subtitle_tracks && !delivery.subtitle_tracks.some(track => track.selected)
          ? { textTrackId: null } : {}),
      });
      if (generation !== this.generation)
        throw new DOMException("Playback cancelled", "AbortError");
      if (paused) await this.player.pause();
      else await this.player.play();
      if (generation !== this.generation)
        throw new DOMException("Playback cancelled", "AbortError");
    } catch (error) {
      if (generation === this.generation) await this.stopCurrent(false);
      throw error;
    }
  }
  /** Seek without losing the current track selection, direct-play mode, or
   * paused intent. */
  async seek(
    positionSeconds: number,
    paused = this.player.snapshot.state !== "playing",
  ): Promise<void> {
    if (!this.lease || !this.card || !this.source) return;
    const held = { time: { ...(this.seekView?.time ?? this.player.snapshot.time), positionSeconds }, actions: this.actions, lease: this.lease, opened: false };
    const opening = this.start(
      this.card, this.source, false, positionSeconds, this.selection,
      undefined, this.directMode, paused, true,
    );
    this.seekView = held;
    this.present(this.player.snapshot);
    let completed = false;
    try { await opening; completed = true; }
    finally {
      if (this.seekView === held) {
        if (!completed) this.seekView = undefined;
        held.opened = true;
        if (this.lease) this.present(this.player.snapshot);
        else this.seekView = undefined;
      }
    }
  }

  async stop() {
    this.seekView = undefined;
    this.intentGeneration++;
    this.sourceRetry = undefined;
    this.directMode = false;
    await this.stopCurrent(false);
  }
  /** Cancel an incoming admission without stopping its outgoing picture. */
  cancelPendingStart(): boolean {
    if (!this.admitting) return false;
    this.intentGeneration++;
    this.operation?.abort();
    return true;
  }
  private async stopCurrent(waitForControl: boolean) {
    this.generation++;
    this.operation?.abort();
    clearTimeout(this.heartbeat);
    clearTimeout(this.expiry);
    // Observation bookkeeping must never prevent the platform decoder stopping.
    try {
      if (this.player.snapshot.state !== "ended") this.event("stop");
    } catch {
      /* the view/auth scope may already be retired */
    }
    const lease = this.lease;
    this.lease = undefined;
    this.card = undefined;
    this.source = undefined;
    this.selection = {};
    let stopping: Promise<void>;
    try { stopping = this.player.stop(); }
    catch (error) { stopping = Promise.reject(error); }
    const cleanup = async () => {
      if (lease) await this.api.release(`/api/playback/${segment(lease.id)}`);
      await this.events.catch(() => {});
    };
    const complete = Promise.all([stopping, cleanup()]);
    // Native Stop may wait for a pending seek; Back must still retire its lease and view.
    if (waitForControl) await complete;
    else void complete.catch(() => {});
  }
  async dispose() {
    document.removeEventListener("visibilitychange", this.foreground);
    window.removeEventListener("keydown", this.interaction, true);
    window.removeEventListener("pointerdown", this.interaction, true);
    this.unsubscribe();
    await this.stop();
    await this.player.dispose();
  }
}
