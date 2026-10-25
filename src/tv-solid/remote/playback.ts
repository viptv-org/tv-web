import { VizioHtml5Adapter } from "../../../vendor/video/src/vizio-html5";
import { TizenAvplayAdapter } from "../../../vendor/video/src/tizen-avplay";
import type { Player, PlayerSnapshot } from "../../../vendor/video/src/types";
import { RemoteTvApi, RemoteError, segment } from "./api";
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
  private sourceRetry?: { card: Card; request: SourceReplacement };
  private heartbeat?: ReturnType<typeof setTimeout>;
  private expiry?: ReturnType<typeof setTimeout>;
  private operation?: AbortController;
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
    private failure: (error: Error) => void,
  ) {
    this.player =
      platform === "tizen" && "webapis" in window
        ? new TizenAvplayAdapter()
        : new VizioHtml5Adapter(video);
    this.unsubscribe = this.player.subscribe((snapshot) => {
      const previous = this.lastState;
      this.lastState = snapshot.state;
      publish(snapshot);
      const lease = this.lease;
      if (snapshot.state === "playing" && lease) {
        // HTML supplies measured decoded-frame evidence. AVPlay exposes an
        // advancing SDK media clock; physical video presentation is a device gate.
        const decoded =
          snapshot.diagnostics?.firstFrameMs !== undefined ||
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
          void api
            .call(`/api/playback/${segment(lease.id)}/first-frame`, "POST", {})
            .catch((error) => {
              if (this.lease?.id === lease.id) this.fail(error);
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
      if (snapshot.state === "ended" && previous !== "ended")
        this.event("stop", true);
      if (snapshot.error) this.fail(new Error(snapshot.error.message));
    });
    document.addEventListener("visibilitychange", this.foreground);
    window.addEventListener("keydown", this.interaction, true);
    window.addEventListener("pointerdown", this.interaction, true);
  }
  private interaction = () => {
    this.activity++;
  };
  get subtitleAppearance() {
    return this.lease?.delivery?.subtitle_appearance;
  }
  get leaseId() {
    return this.lease?.id;
  }
  get actions(): PlaybackActions {
    return this.lease?.actions ?? noActions;
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
    return !!(this.replacementObservation() ?? this.sourceRetry);
  }
  async replaceSource(source: Source) {
    const context = this.replacementObservation() ?? this.sourceRetry;
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
      );
    } catch (error) {
      if (
        this.sourceRetry === context &&
        error instanceof RemoteError &&
        [
          "playback_replacement_invalid",
          "playback_not_found",
          "playback_expired",
          "authorization_expired",
        ].includes(error.code)
      )
        this.sourceRetry = undefined;
      throw error;
    }
  }
  get tracks() {
    return {
      audio: this.lease?.delivery?.audio_tracks ?? [],
      text: this.lease?.delivery?.subtitle_tracks ?? [],
      subtitlesSupported: this.lease?.delivery?.subtitles_supported === true,
    };
  }
  async selectTrack(kind: "audio" | "text", index: number | null) {
    if (!this.card || !this.source) return;
    if (!this.actions.tracks)
      throw new Error("Track selection is unavailable for this playback.");
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
    if (document.visibilityState !== "visible" || !this.lease) return;
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
        this.publish({ ...this.player.snapshot });
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
        if (this.lease?.id === lease.id) this.fail(error);
      });
  };
  private fail(error: Error) {
    if (this.failing) return;
    this.failing = true;
    this.sourceRetry = this.replacementObservation() ?? this.sourceRetry;
    this.intentGeneration++;
    void this.stopCurrent(false).catch(() => {});
    this.failure(error);
  }
  private schedule() {
    clearTimeout(this.heartbeat);
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
            this.publish({ ...this.player.snapshot });
            this.schedule();
          })
          .catch((error) => {
            if (this.lease?.id === lease.id) this.fail(error);
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
  ) {
    const intent = ++this.intentGeneration;
    if (!replacement) this.sourceRetry = undefined;
    await this.stopCurrent(true);
    if (intent !== this.intentGeneration)
      throw new DOMException("Playback cancelled", "AbortError");
    this.failing = false;
    const generation = ++this.generation,
      scope = new AbortController();
    this.operation = scope;
    const lease = await this.api.admit(
      source,
      resume,
      scope.signal,
      position,
      selection,
      replacement,
    );
    if (generation !== this.generation) {
      void this.api.release(`/api/playback/${segment(lease.id)}`);
      throw new DOMException("Playback cancelled", "AbortError");
    }
    this.lease = lease;
    this.card = card;
    this.source = source;
    this.selection = selection;
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
        deliveryMode: "managed",
        deliveryFormat: delivery.format,
      });
      if (generation !== this.generation)
        throw new DOMException("Playback cancelled", "AbortError");
      await this.player.play();
      if (generation !== this.generation)
        throw new DOMException("Playback cancelled", "AbortError");
    } catch (error) {
      if (generation === this.generation) await this.stopCurrent(false);
      throw error;
    }
  }
  async stop() {
    this.intentGeneration++;
    this.sourceRetry = undefined;
    await this.stopCurrent(false);
  }
  private async stopCurrent(waitForControl: boolean) {
    this.generation++;
    this.operation?.abort();
    clearTimeout(this.heartbeat);
    clearTimeout(this.expiry);
    // Observation bookkeeping must never prevent the platform decoder stopping.
    try {
      this.event("stop");
    } catch {
      /* the view/auth scope may already be retired */
    }
    const lease = this.lease;
    this.lease = undefined;
    this.card = undefined;
    this.source = undefined;
    this.selection = {};
    try {
      await this.player.stop();
    } finally {
      const cleanup = async () => {
        if (lease) await this.api.release(`/api/playback/${segment(lease.id)}`);
        await this.events.catch(() => {});
      };
      // Back stops the decoder immediately; control cleanup has its own deadline.
      // A replacement waits for the outgoing record/release before admission.
      if (waitForControl) await cleanup();
      else void cleanup();
    }
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
