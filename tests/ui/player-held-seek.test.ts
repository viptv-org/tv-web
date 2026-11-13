import { afterEach, expect, it, vi } from "vitest";
import { createPlayerNavigation } from "../../src/tv-solid/remote/navigation/player";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function fixture(position = 100, duration = 1000) {
  let preview: number | undefined, focused = true, allowed = true, scope: string | undefined = "lease-one";
  const options = {
    selection: {index: () => 0, set: vi.fn(), timeline: () => focused, setTimeline: (value: boolean) => {focused = value;}},
    timeline: {seeking: () => false, allowed: () => allowed, duration: () => duration, position: () => position,
      preview: () => preview, setPreview: (value: number | undefined) => {preview = value;}},
    controls: {count: () => 4, show: vi.fn(), activity: vi.fn()}, scope: () => scope,
  };
  const navigation = createPlayerNavigation(options as unknown as Parameters<typeof createPlayerNavigation>[0]);
  return {navigation, preview: () => preview, scope: (value: string | undefined) => {scope = value;},
    allowed: (value: boolean) => {allowed = value;}, focused: (value: boolean) => {focused = value;}};
}

it("continues a single native Right press smoothly after its tap step and releases without seeking media", () => {
  vi.useFakeTimers(); const f = fixture();
  const release = f.navigation.move(1, 0);
  expect(f.preview()).toBe(110);
  vi.advanceTimersByTime(400); expect(f.preview()).toBe(110);
  vi.advanceTimersByTime(1000); expect(f.preview()).toBeCloseTo(137.5, 5);
  if (typeof release === "function") release();
  const held = f.preview(); vi.advanceTimersByTime(1000); expect(f.preview()).toBe(held);
});

it("ramps by elapsed time to a capped rate and clamps both title boundaries", () => {
  vi.useFakeTimers(); const f = fixture();
  const release = f.navigation.move(1, 0);
  vi.advanceTimersByTime(4400); expect(f.preview()).toBeCloseTo(310, 5);
  vi.advanceTimersByTime(1000); expect(f.preview()).toBeCloseTo(390, 5);
  if (typeof release === "function") release();
  const end = fixture(990); end.navigation.move(1, 0); vi.advanceTimersByTime(5000); expect(end.preview()).toBe(1000);
  const start = fixture(5); start.navigation.move(-1, 0); vi.advanceTimersByTime(5000); expect(start.preview()).toBe(0);
});

it("preserves a short tap, cancels on direction/focus changes and rejects an outgoing release", () => {
  vi.useFakeTimers(); const f = fixture();
  const oldRelease = f.navigation.move(1, 0);
  vi.advanceTimersByTime(100);
  const release = f.navigation.move(-1, 0);
  if (typeof oldRelease === "function") oldRelease();
  vi.advanceTimersByTime(1400); expect(f.preview()).toBeCloseTo(72.5, 5);
  if (typeof release === "function") release();
  const held = f.preview(); vi.advanceTimersByTime(500); expect(f.preview()).toBe(held);
  f.navigation.move(1, 0); f.navigation.move(0, -1);
  vi.advanceTimersByTime(5000); expect(f.preview()).toBeUndefined();
});

it("cancels on session retirement and discards a suspended timer without a catch-up jump", () => {
  vi.useFakeTimers(); const f = fixture();
  f.navigation.move(1, 0); f.scope(undefined);
  vi.advanceTimersByTime(5000); expect(f.preview()).toBe(110);
  f.scope("lease-two"); f.navigation.move(1, 0);
  const at = performance.now(); vi.spyOn(performance, "now").mockReturnValue(at + 10000);
  vi.advanceTimersByTime(1000); expect(f.preview()).toBe(120);
});

it("retains a ten-second short tap and never starts a hold outside an admitted focused timeline", () => {
  vi.useFakeTimers(); const f = fixture();
  const release = f.navigation.move(1, 0); vi.advanceTimersByTime(200);
  if (typeof release === "function") release();
  vi.advanceTimersByTime(5000); expect(f.preview()).toBe(110);
  for (const disable of [(f: ReturnType<typeof fixture>) => f.scope(undefined),
    (f: ReturnType<typeof fixture>) => f.allowed(false), (f: ReturnType<typeof fixture>) => f.focused(false)]) {
    const inactive = fixture(); disable(inactive); inactive.navigation.move(1, 0);
    vi.advanceTimersByTime(5000); expect(inactive.preview()).toBeUndefined();
  }
});
