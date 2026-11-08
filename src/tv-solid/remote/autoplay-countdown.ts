export interface CountdownState { running: boolean; remaining: number | null; progress: number; }
interface Clock { now(): number; frame(callback: () => void): number; cancel(id: number): void; }
/** One cancellable countdown per ended scope; the caller owns eligibility. */
export class AutoplayCountdown {
  private used?: string;
  private frame?: number;
  private generation = 0;
  state: CountdownState = { running: false, remaining: null, progress: 0 };
  constructor(private changed: (state: CountdownState) => void,
    private clock: Clock = { now: () => performance.now(), frame: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id) }) {}
  private publish(state: CountdownState) {
    if (state.running === this.state.running && state.remaining === this.state.remaining && state.progress === this.state.progress) return;
    this.state = state;this.changed(state);
  }
  cancel() {
    this.generation++;if (this.frame !== undefined) this.clock.cancel(this.frame);
    this.frame = undefined;
    if (this.state.running) this.publish({ running: false, remaining: null, progress: 0 });
  }
  start(scope: string, enabled: boolean, valid: () => boolean, play: () => void) {
    if (this.used === scope) return;
    this.cancel();this.used = scope;
    if (!enabled || !valid()) return;
    const generation = this.generation, deadline = this.clock.now() + 10000;
    this.publish({ running: true, remaining: 10, progress: 1 });
    const tick = () => {
      if (generation !== this.generation || !valid()) { this.cancel();return; }
      const left = deadline - this.clock.now();
      this.publish({ running: true, remaining: Math.max(1, Math.ceil(left / 1000)), progress: Math.ceil(Math.max(0, left) / 100) / 100 });
      if (left > 0) this.frame = this.clock.frame(tick);
      else this.frame = this.clock.frame(() => {
        // Input/dismissal in the deadline frame wins before the handoff.
        if (generation !== this.generation) return;
        if (!valid()) { this.cancel();return; }
        this.frame = undefined;this.publish({ running: false, remaining: null, progress: 0 });play();
      });
    };
    this.frame = this.clock.frame(tick);
  }
}
