/** Home-only, foreground-only revision checks. The token is acknowledged only
 * after its catalogs have been published, so a failed load stays retryable. */
export class CatalogRevisionMonitor {
  private controller = new AbortController();
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private queued = false;
  private externalQueued = false;
  private unsupported = false;
  private stopped = false;
  private revision: string | undefined;

  constructor(
    private read: (signal: AbortSignal) => Promise<string>,
    private refresh: (signal: AbortSignal) => Promise<void>,
    initialRevision?: string,
  ) { this.revision = initialRevision; }

  get revisionToken() { return this.revision; }

  start() {
    document.addEventListener("visibilitychange", this.visibility);
    this.timer = setInterval(() => this.check(), 15_000);
    this.check();
  }

  private visibility = () => {
    if (document.visibilityState === "visible") this.check();
    else this.controller.abort();
  };

  check() {
    if (this.stopped || this.unsupported || document.visibilityState !== "visible") return;
    if (this.controller.signal.aborted) this.controller = new AbortController();
    if (this.running) { this.queued = true; this.externalQueued = true; return; }
    void this.run(this.controller.signal);
  }

  private async run(signal: AbortSignal) {
    this.running = true;
    try {
      do {
        this.queued = false;
        this.externalQueued = false;
        const next = await this.read(signal);
        if (signal.aborted) return;
        if (this.revision === undefined) { this.revision = next; continue; }
        if (next === this.revision) continue;
        await this.refresh(signal);
        if (signal.aborted) return;
        this.revision = next;
        // Bracket the load: changes committed while catalogs were fetched
        // trigger another reconciliation in this same check.
        this.queued = true;
      } while (this.queued && !signal.aborted);
    } catch (error) {
      if ((error as { status?: number }).status === 404) this.unsupported = true;
      // Other failures leave the previous revision in place for the next tick.
      this.queued = this.externalQueued;
    } finally {
      this.running = false;
      if (this.queued && !this.stopped && !this.unsupported && document.visibilityState === "visible") this.check();
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.visibility);
    this.controller.abort();
    this.queued = false;
    this.externalQueued = false;
  }
}
