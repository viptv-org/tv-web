import { afterEach, expect, it, vi } from "vitest";
import { FrameClock } from "../../roku/src/roku/frame-clock";

afterEach(() => vi.unstubAllGlobals());

function clock() {
  let now = 0, nextId = 0;
  const queue = new Map<number, { due: number; run: () => void }>();
  vi.stubGlobal("setTimeout", (run: () => void, delay: number) => {
    const id = ++nextId;
    queue.set(id, { due: now + delay, run });
    return id;
  });
  vi.stubGlobal("clearTimeout", (id: number) => queue.delete(id));
  return {
    now: () => now,
    work: (ms: number) => { now += ms; },
    step: () => {
      const [id, timer] = [...queue].sort((a, b) => a[1].due - b[1].due)[0];
      queue.delete(id); now = Math.max(now, timer.due); timer.run();
    },
    pending: () => queue.size,
  };
}

it.each([0, 4, 8, 30])("includes %s ms of frame work in animation time", cost => {
  const host = clock();
  let elapsed = 0, finished = 0;
  const ticker = new FrameClock(delta => {
    elapsed += delta;
    if (elapsed >= 320) finished = host.now();
    host.work(cost);
    return elapsed < 320;
  }, host.now);
  ticker.start();
  for (let frame = 0; host.pending() && frame < 100; frame++) host.step();
  expect(finished).toBeGreaterThanOrEqual(320);
  expect(finished).toBeLessThanOrEqual(350.001);
  expect(elapsed).toBeCloseTo(finished);
  expect(host.pending()).toBe(0);
});

it("does not tick while stopped or charge paused time on restart", () => {
  const host = clock(), frames: number[] = [];
  const ticker = new FrameClock(delta => { frames.push(delta); return true; }, host.now);
  ticker.start(); ticker.start();
  expect(host.pending()).toBe(1);
  host.step(); ticker.stop(); host.work(1000);
  expect(host.pending()).toBe(0);
  ticker.start(); host.step(); ticker.stop();
  expect(frames).toHaveLength(2);
  expect(frames[1]).toBeCloseTo(1000 / 60);
});
