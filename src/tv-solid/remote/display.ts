/** Applies the server-owned display preferences (Tv3SetDisplay) to the
 * running UI. Values arrive only from the producer's preferences snapshot;
 * nothing here is a local policy decision. */
import { createSignal } from "solid-js";
import { setTextScale } from "../runtime";
import { setMotionOverride } from "./motion";
import { applyAccentColor } from "./visuals";
import type { DisplayPreferences } from "./types";

const textScales = { small: 0.875, default: 1, large: 1.25 } as const;

const [screenSaverMinutes, setScreenSaverMinutes] = createSignal(5);
const [screenInset, setScreenInset] = createSignal(0);
export { screenSaverMinutes, screenInset };

/** Overscan compensation shrinks the rendered stage inside the physical
 * viewport so cropped edges become visible; layout is unchanged. */
export function applyScreenInset(percent: number) {
  setScreenInset(percent);
  const scale = 1 - (2 * percent) / 100;
  const app = document.getElementById("app");
  if (app) {
    app.style.transformOrigin = "center center";
    app.style.transform = percent > 0 ? `scale(${scale})` : "";
  }
}

export const defaultDisplayPreferences: DisplayPreferences = {
  accent_color: "#F5C542",
  show_ratings: true,
  text_size: "default",
  reduce_motion: "follow",
  screen_saver_minutes: 5,
  screen_inset: 0,
};

export function applyDisplayPreferences(display: DisplayPreferences) {
  applyAccentColor(display.accent_color);
  setTextScale(textScales[display.text_size] ?? 1);
  setMotionOverride(
    display.reduce_motion === "on"
      ? true
      : display.reduce_motion === "off"
        ? false
        : null,
  );
  setScreenSaverMinutes(display.screen_saver_minutes);
  applyScreenInset(display.screen_inset);
}
