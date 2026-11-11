import { expect, it, vi } from "vitest";
import { installWindowInputs } from "../../src/tv-solid/remote/input/window-bindings";

it("disposing host input bindings removes event ownership and cancels a held selection", () => {
  const keyboard = vi.fn(), stop = vi.fn(async () => {}), cancelHold = vi.fn();
  const dispose = installWindowInputs({keyboard, screen: () => "player", overlay: () => undefined,
    loading: () => false, error: () => "", pair: async () => {}, stop,
    next: {advance: async () => {}, dismiss: vi.fn()}, cancelHold, cancelCountdown: vi.fn(), visible: vi.fn(), wake: vi.fn(), fail: vi.fn()});
  window.dispatchEvent(new KeyboardEvent("keydown", {key: "x"}));
  window.dispatchEvent(new Event("pagehide"));
  expect(keyboard).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
  expect(cancelHold).toHaveBeenCalledOnce();
  dispose();
  expect(cancelHold).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new KeyboardEvent("keydown", {key: "x"}));
  window.dispatchEvent(new Event("pagehide"));
  expect(keyboard).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
  expect(cancelHold).toHaveBeenCalledTimes(2);
});
