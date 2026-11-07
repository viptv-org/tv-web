export class FrameClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private previous: number | null = null;
  private deadline = 0;

  constructor(
    private update: (elapsedMs: number) => boolean,
    private now: () => number,
    private interval = 1000 / 60,
  ) {}

  start() {
    if (this.timer !== null) return;
    const now = this.now();
    if (this.previous === null) {
      this.previous = now;
      this.deadline = now + this.interval;
    } else if (this.deadline <= now) {
      this.deadline += (Math.floor((now - this.deadline) / this.interval) + 1) * this.interval;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      const now = this.now();
      const elapsed = Math.max(0, now - (this.previous ?? now));
      this.previous = now;
      this.deadline += this.interval;
      if (this.update(elapsed)) this.start();
      else this.stop();
    }, Math.max(0, this.deadline - now));
  }

  stop() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.previous = null;
  }
}
