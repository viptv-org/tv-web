import { afterEach, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import { createIdleScreenSaver } from "../../src/tv-solid/remote/idle-screen-saver";

afterEach(() => vi.useRealTimers());

it("releases its idle timer when its owning screen is disposed", () => {
  vi.useFakeTimers();
  const wake = vi.fn();
  let dispose!: () => void;
  const saver = createRoot(stop => { dispose = stop; return createIdleScreenSaver({ minutes: () => 2, playing: () => false, onWake: wake }); });
  vi.advanceTimersByTime(120000);
  expect(saver.active()).toBe(true);
  expect(saver.dismiss()).toBe(true);
  expect(wake).toHaveBeenCalledTimes(1);
  dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(120000);
  expect(saver.active()).toBe(false);
});
