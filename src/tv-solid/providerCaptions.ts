import { parseWebVtt, type CaptionCue } from '@viptv/video';
import type { MediaItem, TvApi } from '../api';
import type { SubtitleCandidate } from '../../vendor/engine/wire';

/** Original-timeline cues survive managed seeks; they are never rebased twice. */
export class ProviderCaptions {
  private scope = new AbortController();
  private generation = 0;
  private item?: MediaItem;
  private candidates?: readonly SubtitleCandidate[];
  private flight?: Promise<readonly SubtitleCandidate[]>;
  private loadedAt = 0;
  private cues: readonly CaptionCue[] = [];
  private selected: string | null = null;
  private selecting = 0;
  constructor(private readonly api: TvApi) {}
  get selectedId() { return this.selected; }
  get tracks() { return this.candidates; }
  get supported() { return this.api.supportsProviderSubtitles && this.item != null && this.item.type !== 'live'; }
  reset(item?: MediaItem) {
    this.scope.abort(); this.scope = new AbortController(); this.generation++; this.selecting++;
    this.item = item; this.candidates = undefined; this.flight = undefined; this.clear();
  }
  clear() { this.selecting++; this.selected = null; this.cues = []; }
  async discover() {
    if (!this.supported || !this.item) return [];
    if (this.candidates && Date.now() - this.loadedAt < 9 * 60_000) return this.candidates;
    if (this.flight) return this.flight;
    const generation = this.generation;
    const flight = this.api.providerSubtitles(this.item, { signal: this.scope.signal }).then(values => {
      if (generation !== this.generation) throw new DOMException('Aborted', 'AbortError');
      const retained = this.candidates?.find(candidate => candidate.id === this.selected);
      this.loadedAt = Date.now();
      return this.candidates = retained && !values.some(candidate => candidate.id === retained.id) ? [...values, retained] : values;
    }).finally(() => { if (this.flight === flight) this.flight = undefined; });
    return this.flight = flight;
  }
  async select(id: string, disableEmbedded: () => Promise<void>) {
    if (id === this.selected) return;
    if (!this.candidates?.some(candidate => candidate.id === id)) throw new Error('Subtitle is unavailable.');
    const generation = this.generation, selecting = ++this.selecting;
    const content = await this.api.providerSubtitleContent(id, { signal: this.scope.signal });
    if (generation !== this.generation || selecting !== this.selecting) throw new DOMException('Aborted', 'AbortError');
    const cues = parseWebVtt(content);
    if (!cues.length) throw new Error('This subtitle has no readable cues.');
    await disableEmbedded();
    if (generation !== this.generation || selecting !== this.selecting) throw new DOMException('Aborted', 'AbortError');
    this.cues = cues; this.selected = id;
  }
  at(position: number): readonly string[] | undefined {
    if (!this.selected) return undefined;
    return this.cues.filter(cue => cue.start <= position && position < cue.end).map(cue => cue.text);
  }
}
