import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { createHeroCycle } from "../../src/tv-solid/remote/hero-cycle-controller";
import { setMotionOverride } from "../../src/tv-solid/remote/motion";

const stops: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.stubGlobal("matchMedia", () => ({matches: false}));
  Object.defineProperty(document, "visibilityState", {configurable: true, value: "visible"});
});
afterEach(() => { stops.splice(0).forEach(stop => stop()); setMotionOverride(null); vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup(count = 5) {
  const [size, setCount] = createSignal(count), [enabled, setEnabled] = createSignal(true);
  const cycle = createRoot(stop => { stops.push(stop); return createHeroCycle({count: size, enabled}); });
  return {cycle, setCount, setEnabled};
}

it("wraps last to first repeatedly with one eligible advance timer", () => {
  const {cycle} = setup();
  for (let i = 0; i < 12; i++) {
    expect(cycle.slide()).toBe(i % 5);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(9000);
  }
});

it("cancels hidden/noneligible timers and restarts a full idle deadline on return", () => {
  const {cycle, setEnabled, setCount} = setup();
  vi.advanceTimersByTime(8999); cycle.setVisible(false);
  expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(60000); expect(cycle.slide()).toBe(0);
  cycle.setVisible(true); vi.advanceTimersByTime(8999); expect(cycle.slide()).toBe(0);
  vi.advanceTimersByTime(1); expect(cycle.slide()).toBe(1);
  setEnabled(false); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(60000);
  expect(cycle.slide()).toBe(1);
  setEnabled(true); cycle.restart(); vi.advanceTimersByTime(8999); expect(cycle.slide()).toBe(1);
  vi.advanceTimersByTime(1); expect(cycle.slide()).toBe(2);
  setCount(1); cycle.clamp(1); expect(cycle.slide()).toBe(0); expect(vi.getTimerCount()).toBe(0);
});

it("keeps title timing under effective reduced motion without an animated indicator", () => {
  setMotionOverride(true);
  const {cycle} = setup(2);
  expect(cycle.animated()).toBe(false);
  vi.advanceTimersByTime(9000); expect(cycle.slide()).toBe(1);
  vi.advanceTimersByTime(9000); expect(cycle.slide()).toBe(0);
});

it("waits for committed artwork and gives interrupted visible content a full new deadline", () => {
  const {cycle} = setup();
  cycle.setReady(false); expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(60000); expect(cycle.slide()).toBe(0);
  cycle.setReady(true); vi.advanceTimersByTime(9000); expect(cycle.slide()).toBe(1);
  cycle.interrupt(0); expect(cycle.slide()).toBe(0);
  vi.advanceTimersByTime(8999); expect(cycle.slide()).toBe(0);
  vi.advanceTimersByTime(1); expect(cycle.slide()).toBe(1);
});

it("releases its only deadline when disposed", () => {
  const {cycle} = setup();
  stops.splice(0).forEach(stop => stop()); expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(60000); expect(cycle.slide()).toBe(0);
});
