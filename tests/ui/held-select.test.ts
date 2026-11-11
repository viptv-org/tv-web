import { afterEach, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import { createHeldSelect } from "../../src/tv-solid/remote/held-select";

afterEach(() => vi.useRealTimers());

function setup() {
  let target = "card", layer: object | undefined;
  const hold = vi.fn(), activate = vi.fn();
  let dispose!: () => void;
  const control = createRoot(stop => { dispose = stop; return createHeldSelect({ target: () => target, layer: () => layer,
    allowed: () => true, blocked: () => false, onTimer: () => {}, hold, activate }); });
  return { control, hold, activate, dispose, replaceTarget: () => { target = "next"; }, replaceLayer: () => { layer = {}; } };
}

it("a held select fires once before release and never also activates", () => {
  vi.useFakeTimers();
  const value = setup(), release = value.control.press();
  vi.advanceTimersByTime(700);
  expect(value.hold).toHaveBeenCalledTimes(1);
  release();
  expect(value.activate).not.toHaveBeenCalled();
  value.dispose();
});
it("target/layer changes fence a release and disposal cancels the pending hold", () => {
  vi.useFakeTimers();
  const value = setup(), release = value.control.press();
  value.replaceTarget(); value.replaceLayer(); release();
  expect(value.activate).not.toHaveBeenCalled();
  value.control.press(); value.dispose(); vi.advanceTimersByTime(700);
  expect(value.hold).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
