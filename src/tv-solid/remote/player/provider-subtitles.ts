import { parseWebVtt } from "../../../../vendor/video/src/captions";
import { SubtitleSyncView, type SubtitleSyncRecord } from "../../../../vendor/video/src/subtitle-sync";
export interface ProviderSubtitle { id: string; label: string; language: string }
export interface ProviderSubtitleIntent {
  selected: ProviderSubtitle;
  subtitleHash: string;
  manual: boolean;
  delaySeconds: number;
  audioIdentity?: string;
}
type Request = <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
class SubtitleIdentityMismatch extends Error {}
const providerTracks = new WeakMap<HTMLVideoElement, TextTrack>();
export class ProviderSubtitles {
  private abort = new AbortController();
  private track?: TextTrack;
  private cue?: TextTrackCue;
  private view?: SubtitleSyncView;
  private canonical?: ReturnType<typeof parseWebVtt>;
  private record?: SubtitleSyncRecord;
  private hash = "";
  private delay = 0;
  private manualMode = false;
  private timer?: ReturnType<typeof setTimeout>;
  private text = "";
  private lastTitle = 0;
  private retired = false;
  private generation = 0;
  state = "Original timing";
  constructor(private readonly video: HTMLVideoElement, private readonly request: Request, private readonly path: string, readonly selected: ProviderSubtitle) {}
  async attach(retained?: ProviderSubtitleIntent): Promise<void> {
    const asset = await this.request<{ canonical_vtt: string; subtitle_hash: string }>(`${this.path}/subtitles`, "POST", { subtitle_id: this.selected.id }, this.abort.signal);
    if (this.retired) return;
    if (typeof asset.canonical_vtt !== "string" || asset.canonical_vtt.length > 2 * 1024 * 1024 || (asset.canonical_vtt.match(/-->/g)?.length ?? 0) > 4096 || !/^[a-f0-9]{64}$/.test(asset.subtitle_hash)) throw new Error("Subtitle file exceeds browser limits.");
    if (retained && asset.subtitle_hash !== retained.subtitleHash) throw new SubtitleIdentityMismatch("Subtitle selection changed.");
    this.canonical = parseWebVtt(asset.canonical_vtt).sort((a, b) => a.start - b.start);
    this.hash = asset.subtitle_hash;
    this.manualMode = retained?.manual ?? false; this.delay = retained?.delaySeconds ?? 0;
    this.view = new SubtitleSyncView(this.canonical, "original", this.hash);
    if (this.manualMode) this.view.manualDelay(this.delay);
    this.state = this.manualMode ? "Manual timing" : "Original timing";
    this.track = providerTracks.get(this.video);
    if (!this.track) { this.track = this.video.addTextTrack("subtitles", "Provider subtitles", ""); providerTracks.set(this.video, this.track); }
    this.track.mode = "showing";
    this.tick(this.lastTitle);
    if (retained) {
      try { await this.start(retained.audioIdentity); }
      catch (error) {
        const status = (error as { status?: number } | null)?.status;
        if (error instanceof SubtitleIdentityMismatch || [401, 403, 410].includes(status ?? 0) || (error as Error)?.name === "AbortError") throw error;
        if (!this.retired) this.state = this.manualMode ? "Manual timing" : "Automatic timing unavailable";
      }
    } else void this.start().catch(() => { if (!this.retired && !this.manualMode) this.state = "Automatic timing unavailable"; });
  }
  private async start(expectedAudioIdentity?: string): Promise<void> {
    const generation = ++this.generation;
    let record: SubtitleSyncRecord;
    try { record = await this.request<SubtitleSyncRecord>(`${this.path}/subtitle-sync`, "POST", { subtitle_id: this.selected.id }, this.abort.signal); }
    catch (error) { if (this.retired || generation !== this.generation) return; throw error; }
    if (this.retired || generation !== this.generation) return;
    if (record.subtitle_hash !== this.hash) throw new SubtitleIdentityMismatch("Subtitle selection changed.");
    if (!this.canonical || typeof record.playback_generation !== "string" || record.version !== 1 || !Number.isSafeInteger(record.revision)) throw new Error("Subtitle timing unavailable.");
    if (expectedAudioIdentity && record.audio_identity !== expectedAudioIdentity) {
      this.record = record;
      throw new SubtitleIdentityMismatch("Subtitle audio selection changed.");
    }
    const view = new SubtitleSyncView(this.canonical, record.playback_generation, this.hash);
    if (this.manualMode) view.manualDelay(this.delay);
    this.view?.dispose(); this.view = view;
    this.adopt(record);
    if (this.manualMode && !record.manual) await this.manual(this.delay);
    if (!this.retired && generation === this.generation && !this.manualMode && !record.manual && record.state === "observing") this.schedule();
  }
  private schedule(): void {
    const generation = this.generation;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.request<SubtitleSyncRecord>(`${this.path}/subtitle-sync`, "GET", undefined, this.abort.signal)
        .then(record => { if (!this.retired && generation === this.generation && record.playback_generation === this.record?.playback_generation) { this.adopt(record); if (record.state === "observing" && !this.manualMode && !record.manual) this.schedule(); } })
        .catch(() => { if (!this.retired && generation === this.generation && !this.manualMode && !this.record?.manual) this.state = "Automatic timing unavailable"; });
    }, 2000);
  }
  private adopt(record: SubtitleSyncRecord): void {
    if (this.record && (record.revision < this.record.revision || record.playback_generation !== this.record.playback_generation || record.media_identity !== this.record.media_identity || record.audio_identity !== this.record.audio_identity)) return;
    if (record.subtitle_hash !== this.hash || record.version !== 1 || !Number.isSafeInteger(record.revision)) return;
    this.record = record;
    this.view?.accept(record);
    this.state = this.manualMode || record.manual ? "Manual timing" : record.state === "accepted" ? "Automatic timing (prototype)" : record.state === "observing" ? "Checking automatic timing" : "Automatic timing unavailable";
    this.tick(this.lastTitle);
  }
  async manual(seconds: number): Promise<void> {
    if (!Number.isFinite(seconds) || Math.abs(seconds) > 120) return;
    clearTimeout(this.timer);
    this.manualMode = true; this.delay = seconds; this.view?.manualDelay(seconds); this.state = "Manual timing";
    this.tick(this.lastTitle);
    const generation = this.generation;
    let record = this.record;
    if (!record) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const updated = await this.request<SubtitleSyncRecord>(`${this.path}/subtitle-sync`, "PUT", { revision: record.revision, manual: true }, this.abort.signal);
        if (!this.retired && generation === this.generation) this.adopt(updated);
        return;
      } catch (error) {
        if (this.retired || generation !== this.generation) return;
        if (attempt) throw error;
        record = await this.request<SubtitleSyncRecord>(`${this.path}/subtitle-sync`, "GET", undefined, this.abort.signal);
        if (generation !== this.generation || record.playback_generation !== this.record?.playback_generation) return;
      }
    }
  }
  get ready(): boolean { return !!this.track && !this.retired; }
  get intent(): ProviderSubtitleIntent | undefined {
    return this.ready ? { selected: { ...this.selected }, subtitleHash: this.hash, manual: this.manualMode,
      delaySeconds: this.delay, audioIdentity: this.record?.audio_identity } : undefined;
  }
  get manualSeconds(): number { return this.delay; }
  async reset(): Promise<void> {
    clearTimeout(this.timer); this.manualMode = false; this.delay = 0; this.record = undefined; this.state = "Original timing";
    if (this.canonical) { this.view?.dispose(); this.view = new SubtitleSyncView(this.canonical, "original", this.hash); }
    this.tick(this.lastTitle);
    if (this.canonical) await this.start();
  }
  tick(titleSeconds: number): void {
    this.lastTitle = titleSeconds;
    if (this.retired || !this.view || !this.track || !Number.isFinite(this.video.currentTime)) return;
    const window = this.view.at(titleSeconds, 0);
    if (window.deferred) return;
    const text = window.texts.join("\n").slice(0, 8192);
    if (text === this.text && this.cue) {
      const cue = this.cue as VTTCue;
      if (this.video.currentTime >= cue.startTime && this.video.currentTime < cue.endTime) { cue.endTime = this.video.currentTime + 1; return; }
    }
    this.text = text;
    if (this.cue) { this.track.removeCue(this.cue); this.cue = undefined; }
    if (text) { this.cue = new VTTCue(Math.max(0, this.video.currentTime), this.video.currentTime + 1, text); this.track.addCue(this.cue); }
  }
  dispose(): void {
    if (this.record) void this.request(`${this.path}/subtitle-sync`, "DELETE", { playback_generation: this.record.playback_generation }).catch(() => {});
    this.retired = true; this.generation++; this.abort.abort(); clearTimeout(this.timer); this.view?.dispose();
    if (this.cue && this.track) this.track.removeCue(this.cue);
    if (this.track) this.track.mode = "disabled";
    this.cue = undefined; this.view = undefined;
  }
}
