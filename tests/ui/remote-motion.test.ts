import { describe, it, expect, afterEach } from "vitest";
import { reducedMotion, setMotionOverride } from "../../src/tv-solid/remote/motion";

describe("remote motion policy", () => {
  afterEach(() => setMotionOverride(null));
  it("follows the device setting until the server preference overrides it", () => {
    // jsdom reports no device preference.
    expect(reducedMotion()).toBe(false);
    setMotionOverride(true);
    expect(reducedMotion()).toBe(true);
    setMotionOverride(false);
    expect(reducedMotion()).toBe(false);
    setMotionOverride(null);
    expect(reducedMotion()).toBe(false);
  });
});
