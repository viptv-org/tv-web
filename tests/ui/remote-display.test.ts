import { describe, it, expect, beforeEach, vi } from "vitest";

const accent = vi.fn();
const motion = vi.fn();
let scale = 1;
vi.mock("../../src/tv-solid/remote/visuals", () => ({
  applyAccentColor: (value: string) => accent(value),
}));
vi.mock("../../src/tv-solid/remote/motion", () => ({
  setMotionOverride: (value: boolean | null) => motion(value),
}));
vi.mock("../../src/tv-solid/runtime", () => ({
  setTextScale: (value: number) => {
    scale = value;
  },
}));

describe("remote display preferences", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    accent.mockClear();
    motion.mockClear();
    scale = 1;
  });

  it("applies the server snapshot to accent, text, motion, saver and inset", async () => {
    const {
      applyDisplayPreferences,
      applyScreenInset,
      screenSaverMinutes,
      screenInset,
    } = await import("../../src/tv-solid/remote/display");
    applyDisplayPreferences({
      accent_color: "#62D9BC",
      show_ratings: true,
      text_size: "large",
      reduce_motion: "on",
      screen_saver_minutes: 10,
      screen_inset: 4,
    });
    expect(accent).toHaveBeenCalledWith("#62D9BC");
    expect(scale).toBe(1.25);
    expect(motion).toHaveBeenCalledWith(true);
    expect(screenSaverMinutes()).toBe(10);
    expect(screenInset()).toBe(4);
    expect(document.getElementById("app")!.style.transform).toBe(
      "scale(0.92)",
    );
    applyDisplayPreferences({
      accent_color: "#F5C542",
      show_ratings: false,
      text_size: "small",
      reduce_motion: "off",
      screen_saver_minutes: 0,
      screen_inset: 0,
    });
    expect(scale).toBe(0.875);
    expect(motion).toHaveBeenCalledWith(false);
    expect(screenSaverMinutes()).toBe(0);
    expect(document.getElementById("app")!.style.transform).toBe("");
    // Follow restores device authority over motion.
    applyScreenInset(0);
    applyDisplayPreferences({
      accent_color: "#F5C542",
      show_ratings: true,
      text_size: "default",
      reduce_motion: "follow",
      screen_saver_minutes: 5,
      screen_inset: 0,
    });
    expect(motion).toHaveBeenCalledWith(null);
  });
});
