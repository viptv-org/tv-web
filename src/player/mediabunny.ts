import { Input, UrlSource, ALL_FORMATS, CanvasSink, AudioBufferSink, type InputVideoTrack, type WrappedCanvas, type WrappedAudioBuffer } from 'mediabunny';
import { SessionPlayer } from './session';
import { PlayerOperationError, growOnlyDuration, timelineDuration, type OpenPlayerRequest, type PlayerCapabilities } from './types';

/** Only opaque backend media capabilities may reach either browser or native HTTP. */
export function sessionMediaFetch(url: string): typeof fetch {
  const delivery = new URL(url, location.href);
  const prefix = delivery.pathname.slice(0, delivery.pathname.lastIndexOf('/') + 1);
  return async (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, delivery);
    if (target.origin !== delivery.origin || !target.pathname.startsWith(prefix) || !target.pathname.startsWith('/media/'))
      throw new PlayerOperationError('authorization-unsupported', 'The playlist contains a resource outside its playback session.');
    const native = '__TAURI_INTERNALS__' in window;
    const response = native
      ? await (await import('@tauri-apps/plugin-http')).fetch(target.href, { ...init, redirect: 'error', maxRedirections: 0 })
      : await fetch(target.href, { ...init, redirect: 'error' });
    return response;
  };
}

export const MEDIABUNNY_CAPABILITIES: PlayerCapabilities = {
  platform: 'html5', engine: 'Mediabunny / WebCodecs', directNative: 'probe-required', adaptiveStreaming: 'probe-required', drm: 'unsupported',
  canPause: true, canSeek: true, canSetVolume: true, canSelectAudioTrack: false, canSelectTextTrack: false, canDisableTextTrack: false,
  canUseCookies: false, canUseUserAgent: false,
  limitations: ['Actual tracks must pass WebCodecs decoding checks.', 'Track replacement is performed through the selected backend session.', 'Encrypted DRM media uses the compatible native fallback when available.'],
};

/** A bounded two-frame / half-second audio pipeline; no full-file buffering or local encoding. */
export class MediabunnyAdapter extends SessionPlayer {
  readonly capabilities = MEDIABUNNY_CAPABILITIES;
  private input?: Input;
  private context?: AudioContext;
  private gain?: GainNode;
  private videoSink?: CanvasSink;
  private videoTrack?: InputVideoTrack;
  private audioSink?: AudioBufferSink;
  private videoIterator?: AsyncGenerator<WrappedCanvas, void, unknown>;
  private audioIterator?: AsyncGenerator<WrappedAudioBuffer, void, unknown>;
  private nodes = new Set<AudioBufferSourceNode>();
  private request?: OpenPlayerRequest;
  private generation = 0;
  private playing = false;
  private position = 0;
  private firstTimestamp = 0;
  private duration: number | null = null;
  private observedTitleDuration: number | null = null;
  private anchor = 0;
  private volume = 1;
  private muted = false;
  private ticker?: ReturnType<typeof setInterval>;
  private videoDone = false;
  private audioDone = false;
  private live = false;
  private liveRefresh?: ReturnType<typeof setTimeout>;

  constructor(private readonly canvas: HTMLCanvasElement) { super(); }

  async open(request: OpenPlayerRequest): Promise<void> {
    await this.release();
    const session = this.startSession(request.kind);
    this.request = request;
    this.observedTitleDuration = null;
    const token = ++this.generation;
    if (request.authorization?.cookie || request.authorization?.userAgent)
      throw new PlayerOperationError('authorization-unsupported', 'Playback requires a backend-compatible media URL.');
    const input = this.input = new Input({
      // Readahead and bounded retries stay the library defaults: disabling
      // retries turned one evicted segment of a rolling playlist into a hard
      // read failure, and a 32 MiB cache still bounds memory per session.
      source: new UrlSource(request.url, { fetchFn: sessionMediaFetch(request.url), maxCacheSize: 32 * 1024 * 1024 }),
      formats: ALL_FORMATS,
      formatOptions: { hls: { offsetTimestampsByDateTime: false } },
    });
    const video = await input.getPrimaryVideoTrack();
    if (!this.isCurrent(session) || token !== this.generation) return;
    if (!video || !(await video.canDecode())) throw new PlayerOperationError('unsupported-format', 'Mediabunny cannot decode this video track.');
    const audio = await video.getPrimaryPairableAudioTrack();
    if (audio && !(await audio.canDecode())) throw new PlayerOperationError('unsupported-format', 'Mediabunny cannot decode this audio track.');
    // The example creates the context at the track's own sample rate; mismatched
    // rates resample and drift against the picture.
    const sampleRate = audio ? await audio.getSampleRate() : undefined;
    if (!this.isCurrent(session) || token !== this.generation) return;
    this.context = new AudioContext(sampleRate ? { sampleRate } : undefined);
    this.gain = this.context.createGain(); this.gain.connect(this.context.destination); this.applyVolume();
    if (!this.isCurrent(session) || token !== this.generation) return;
    const [videoConfig, audioConfig, width, height, start] = await Promise.all([
      video.getDecoderConfig(), audio?.getDecoderConfig(), video.getDisplayWidth(), video.getDisplayHeight(), video.getFirstTimestamp(),
    ]);
    if (!this.isCurrent(session) || token !== this.generation) return;
    this.firstTimestamp = start;
    // Managed output is a rolling playlist until the source ends, so it is a
    // live stream even for a movie: the example reads the window, refreshes its
    // end and never waits for ENDLIST. The session owns the title duration.
    this.live = request.kind === 'live' || await video.isLive();
    this.duration = this.live ? null : await video.getDurationFromMetadata({ skipLiveWait: true });
    if (this.duration != null) this.duration = Math.max(0, this.duration - start);
    if (this.live) void this.refreshLiveWindow(token);
    this.canvas.width = width; this.canvas.height = height;
    this.videoTrack = video;
    // Pool of two: only the current and next frame are ever alive (example).
    this.videoSink = new CanvasSink(video, { poolSize: 2, fit: 'contain' });
    this.audioSink = audio ? new AudioBufferSink(audio) : undefined;
    this.position = Math.max(0, request.startAtSeconds ?? 0);
    const frame = await this.videoSink.getCanvas(start + this.position);
    if (!this.isCurrent(session) || token !== this.generation) return;
    if (!frame) throw new PlayerOperationError('unsupported-format', 'Mediabunny did not decode an initial video frame.');
    this.draw(frame);
    this.update(session, { state: 'ready', diagnostics: { engine: 'mediabunny', networkTransport: '__TAURI_INTERNALS__' in window ? 'native-http' : new URL(request.url, location.href).pathname.startsWith('/media/') ? 'browser-proxy' : 'direct', transport: /\.m3u8(?:[?#]|$)/i.test(request.url) ? 'hls' : 'file', videoCodec: videoConfig?.codec, audioCodec: audioConfig?.codec, width, height }, volume: { level: this.volume, muted: this.muted }, time: this.time() });
    if (request.paused) this.update(session, { state: 'paused' });
    else await this.play();
  }

  async play(): Promise<void> {
    if (this.playing) return;
    if (!this.context || !this.videoSink) throw new PlayerOperationError('invalid-state', 'No prepared MediaBunny session.');
    await this.context.resume();
    if (this.context.state !== 'running') throw new PlayerOperationError('prepare-failed', 'Select Play to enable browser audio.');
    this.playing = true;
    this.anchor = this.context.currentTime - this.position;
    const token = ++this.generation;
    const session = this.snapshot.sessionId;
    this.videoDone = false; this.audioDone = !this.audioSink;
    this.videoIterator = this.videoSink.canvases(this.firstTimestamp + this.position);
    this.audioIterator = this.audioSink?.buffers(this.firstTimestamp + this.position);
    this.update(session, { state: 'playing', error: null });
    void this.videoLoop(token).catch(error => this.decoderFailed(token, error));
    if (this.audioIterator) void this.audioLoop(token).catch(error => this.decoderFailed(token, error));
    this.ticker = setInterval(() => {
      if (token !== this.generation) return;
      this.update(session, { time: this.time() });
      if (this.videoDone && this.audioDone && this.nodes.size === 0) {
        this.position = this.currentPosition(); this.playing = false; this.cancelLoops();
        this.update(session, { state: 'ended', time: this.time() });
      }
    }, 200);
  }

  async pause(): Promise<void> {
    this.position = this.currentPosition(); this.playing = false; this.cancelLoops();
    this.update(this.snapshot.sessionId, { state: 'paused', time: this.time() });
  }
  async seek(position: number): Promise<void> {
    if (this.request?.kind === 'live') throw new PlayerOperationError('unsupported-operation', 'Live playback does not expose VOD seeking.');
    if (!Number.isFinite(position) || position < 0) throw new PlayerOperationError('seek-failed', 'Invalid seek position.');
    const resume = this.playing;
    await this.pause();
    this.position = Math.max(0, position - (this.request?.timelineOffsetSeconds ?? 0));
    if (this.duration != null) this.position = Math.min(this.position, this.duration);
    const token = this.generation;
    const frame = await this.videoSink?.getCanvas(this.firstTimestamp + this.position);
    if (token !== this.generation) return;
    if (frame) this.draw(frame);
    this.update(this.snapshot.sessionId, { time: this.time() });
    if (resume) await this.play();
  }
  async setVolume(level: number): Promise<void> { this.volume = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 1)); if (this.volume > 0) this.muted = false; this.applyVolume(); }
  async setMuted(muted: boolean): Promise<void> { this.muted = muted; this.applyVolume(); }
  async stop(): Promise<void> { this.invalidateSession(); await this.release(); this.terminal('stopped'); }
  async dispose(): Promise<void> { await this.stop(); this.terminal('disposed'); }
  async selectAudioTrack(): Promise<void> { throw new PlayerOperationError('unsupported-operation', 'Select audio through the playback session.'); }
  async selectTextTrack(): Promise<void> { throw new PlayerOperationError('unsupported-operation', 'Select subtitles through the playback session.'); }

  /** Keeps a rolling window fresh so the read cursor can follow its edge. */
  private async refreshLiveWindow(token: number): Promise<void> {
    const track = this.videoTrack;
    if (!track || token !== this.generation) return;
    const interval = await track.getLiveRefreshInterval().catch(() => null);
    if (token !== this.generation) return;
    this.liveRefresh = setTimeout(() => {
      if (token !== this.generation) return;
      void track.isLive().catch(() => false).then(stillLive => {
        if (stillLive && token === this.generation) return this.refreshLiveWindow(token);
        return undefined;
      });
    }, Math.max(1, interval ?? 4) * 1000);
  }

  private draw(frame: WrappedCanvas): void { this.canvas.getContext('2d')?.drawImage(frame.canvas, 0, 0, this.canvas.width, this.canvas.height); }
  private currentPosition(): number { return this.playing && this.context ? Math.max(0, this.context.currentTime - this.anchor) : this.position; }
  private time() {
    const offset = this.request?.timelineOffsetSeconds ?? 0;
    const engine = this.duration == null ? null : this.duration + offset;
    // A managed delivery is a rolling window; the server total is authoritative
    // and the reported length only ever grows.
    const next = timelineDuration(this.request?.timelineDurationSeconds, engine, this.request?.adoptEngineDuration === true);
    return { positionSeconds: this.currentPosition() + offset, durationSeconds: (this.observedTitleDuration = growOnlyDuration(this.observedTitleDuration, next)) };
  }
  private applyVolume(): void {
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
    this.update(this.snapshot.sessionId, { volume: { level: this.volume, muted: this.muted } });
  }
  private async videoLoop(token: number): Promise<void> {
    const iterator = this.videoIterator!;
    for await (const frame of iterator) {
      if (token !== this.generation) return;
      while (frame.timestamp - this.firstTimestamp > this.currentPosition() && token === this.generation)
        await delay(8);
      if (token !== this.generation) return;
      this.draw(frame);
    }
    if (token === this.generation) this.videoDone = true;
  }
  private async audioLoop(token: number): Promise<void> {
    const iterator = this.audioIterator!;
    for await (const packet of iterator) {
      if (token !== this.generation || !this.context || !this.gain) return;
      const relative = packet.timestamp - this.firstTimestamp;
      while (relative - this.currentPosition() > 0.5 && token === this.generation) await delay(20);
      if (token !== this.generation) return;
      const offset = Math.max(0, this.currentPosition() - relative);
      if (offset >= packet.buffer.duration) continue;
      const node = this.context.createBufferSource(); node.buffer = packet.buffer; node.connect(this.gain);
      this.nodes.add(node); node.onended = () => { this.nodes.delete(node); node.disconnect(); };
      node.start(Math.max(this.context.currentTime, this.anchor + relative), offset);
    }
    if (token === this.generation) this.audioDone = true;
  }
  private decoderFailed(token: number, _cause: unknown): void {
    if (token !== this.generation) return;
    this.position = this.currentPosition(); this.playing = false; this.cancelLoops();
    this.update(this.snapshot.sessionId, { time: this.time() });
    this.fail(this.snapshot.sessionId, { code: 'unsupported-format', message: 'Mediabunny could not continue decoding the selected source.' });
  }
  private cancelLoops(): void {
    this.generation++;
    clearInterval(this.ticker); this.ticker = undefined;
    clearTimeout(this.liveRefresh); this.liveRefresh = undefined;
    // return() may wait for a live read; disposal below aborts the source on stop.
    void this.videoIterator?.return().catch(() => undefined);
    void this.audioIterator?.return().catch(() => undefined);
    this.videoIterator = undefined; this.audioIterator = undefined;
    for (const node of this.nodes) { node.onended = null; try { node.stop(); } catch { /* already ended */ } node.disconnect(); }
    this.nodes.clear();
  }
  private async release(): Promise<void> {
    this.playing = false; this.cancelLoops(); this.input?.dispose(); this.input = undefined;
    this.videoSink = undefined; this.videoTrack = undefined; this.audioSink = undefined;
    const context = this.context; this.context = undefined; this.gain = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
}
function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
