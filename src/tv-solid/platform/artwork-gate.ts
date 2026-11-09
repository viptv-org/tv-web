export type ArtworkRequest<T> = { id: number; key: string; value: T; waiting: Set<string>; failed: Set<string> };

/** One displayed presentation and one pending replacement; no metadata history. */
export class ArtworkGate<T> {
  private serial = 0;
  private currentKey = "";
  private currentFailed: ReadonlySet<string> = new Set();
  private scope = "";
  private pending?: ArtworkRequest<T>;
  constructor(private show: (value: T | undefined, failed: ReadonlySet<string>) => void,
    private prepare: (request: ArtworkRequest<T> | undefined) => void) {}

  hold(scope: string) {
    if (scope !== this.scope) {
      this.scope=scope;this.currentKey="";this.currentFailed=new Set();this.show(undefined,new Set());
    }
    this.pending=undefined;this.prepare(undefined);
  }

  request(scope: string, key: string, value: T | undefined, resources: string[]) {
    if (scope !== this.scope) { this.scope=scope;this.currentKey="";this.currentFailed=new Set();this.pending=undefined;this.show(undefined,new Set()); }
    if (value === undefined) { this.currentKey="";this.pending=undefined;this.prepare(undefined);this.show(undefined,new Set());return; }
    if (key === this.currentKey) { this.pending=undefined;this.prepare(undefined);this.show(value,this.currentFailed);return; }
    if (key === this.pending?.key) { this.pending.value=value;return; }
    const request = this.pending = { id: ++this.serial, key, value, waiting: new Set(resources), failed: new Set<string>() };
    this.prepare(request);
    if (!request.waiting.size) this.finish(request.id);
  }
  settled(id: number, resource: string, failed = false) {
    const request=this.pending;
    if (!request || request.id !== id || !request.waiting.delete(resource)) return;
    if (failed) request.failed.add(resource);
    if (!request.waiting.size) this.finish(id);
  }
  finish(id: number) {
    const request=this.pending;
    if (!request || request.id !== id) return;
    for (const resource of request.waiting) request.failed.add(resource);
    this.pending=undefined;this.currentKey=request.key;
    this.currentFailed=request.failed;
    this.show(request.value,request.failed);this.prepare(undefined);
  }
}
