type PosterState = 'loaded' | 'failed';

export class PosterImage {
  private generation = 0;
  private source = '';
  ready = false;

  constructor(
    readonly poster: any,
    private write: (name: string, value: any) => void,
    private publish: (state: PosterState) => void,
  ) {}

  load(uri: string, width: number, height: number) {
    if (uri === this.source) return;
    this.source = uri;
    this.ready = false;
    const generation = ++this.generation;
    const cached = this.poster.uri === uri && this.isLoaded(this.poster.loadStatus) &&
      Number(this.poster.bitmapWidth) > 0 && Number(this.poster.bitmapHeight) > 0;
    if (!cached) {
      this.poster.bitmapWidth = 0;
      this.poster.bitmapHeight = 0;
    }
    let settled = false;
    const status = (value: any) => {
      if (generation !== this.generation || !uri || settled) return;
      if (this.isLoaded(value)) {
        settled = true;
        this.ready = true;
        this.publish('loaded');
      } else if (String(value) === 'failed') {
        settled = true;
        this.publish('failed');
      }
    };
    this.write('onLoadStatus', status);
    const dimension = (name: string, value: any) => {
      if (generation !== this.generation) return;
      // SDK handles do not mirror fields; retain dimensions from native observers.
      this.poster[name] = Number(value) || 0;
      if (this.ready) this.publish('loaded');
    };
    this.write('onBitmapWidth', (value: any) => dimension('bitmapWidth', value));
    this.write('onBitmapHeight', (value: any) => dimension('bitmapHeight', value));
    const remote = /^https?:\/\//.test(uri);
    this.write('loadWidth', remote && width > 0 ? Math.min(3840, Math.ceil(width)) : 0);
    this.write('loadHeight', remote && height > 0 ? Math.min(2160, Math.ceil(height)) : 0);
    this.write('uri', uri);
    if (cached) status(this.poster.loadStatus);
  }

  invalidate() {
    this.generation++;
    this.source = '';
    this.ready = false;
  }

  private isLoaded(value: any) {
    return value === 'loaded' || value === 'ready' || String(value) === '3';
  }
}
