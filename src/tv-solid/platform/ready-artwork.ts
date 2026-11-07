export type ArtworkFrame = { id: number; src: string; alpha: number };

export class ReadyArtwork {
  private serial = 0;
  private requested = '';
  private shown?: ArtworkFrame;
  private incoming?: ArtworkFrame;
  private fading = false;
  private disposed = false;

  constructor(
    private publish: (frames: ArtworkFrame[]) => void,
    private fade: (id: number) => Promise<unknown>,
  ) {}

  request(src?: string | null) {
    if (this.disposed) return;
    this.requested = src ?? '';
    if (!this.requested && !this.fading) {
      this.shown = this.incoming = undefined;
      this.publish([]);
    } else if (!this.fading) this.reconcile();
  }

  ready(id: number) {
    if (this.disposed || this.fading || this.incoming?.id !== id) return;
    if (!this.shown) {
      this.shown = { ...this.incoming, alpha: 1 };
      this.incoming = undefined;
      this.publish([this.shown]);
      return;
    }
    this.fading = true;
    const finish = () => {
      if (this.disposed) return;
      this.shown = { ...this.incoming!, alpha: 1 };
      this.incoming = undefined;
      this.fading = false;
      this.publish([this.shown]);
      this.request(this.requested);
    };
    void this.fade(id).then(finish, finish);
  }

  failed(id: number) {
    if (this.disposed || this.fading || this.incoming?.id !== id) return;
    this.incoming = undefined;
    this.publish(this.shown ? [this.shown] : []);
  }

  dispose() {
    this.disposed = true;
  }

  private reconcile() {
    if (this.requested === this.shown?.src) {
      this.incoming = undefined;
      this.publish([this.shown]);
    } else if (this.requested && this.requested !== this.incoming?.src) {
      this.incoming = { id: ++this.serial, src: this.requested, alpha: 0 };
      this.publish(this.shown ? [this.shown, this.incoming] : [this.incoming]);
    }
  }
}
