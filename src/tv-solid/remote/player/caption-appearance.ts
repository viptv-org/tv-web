import { onCleanup } from "solid-js";
import type { RemotePlayback } from "../playback";
import type { Preferences } from "../types";

export function applyCaptionAppearance(appearance: RemotePlayback["subtitleAppearance"], preferencesValue: Preferences["preferences"] | undefined) {
  const nativeAppearance = (globalThis as any).__viptvApplyCaptionAppearance;
  if (typeof nativeAppearance === "function") {
    nativeAppearance({
      font_scale: appearance?.font_scale ?? preferencesValue?.subtitle_font_scale ?? 1,
      text_color: appearance?.text_color ?? preferencesValue?.subtitle_text_color ?? "#FFFFFF",
      background_color: appearance?.background_color ?? preferencesValue?.subtitle_background_color ?? "#00000000",
    });
    return;
  }
  let style = document.getElementById("tv-caption-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "tv-caption-style";
    document.head.append(style);
  }
  style.textContent = `#tv-video::cue { font-size: ${2.2 * Number(appearance?.font_scale ?? preferencesValue?.subtitle_font_scale ?? 1)}vw; color: ${String(appearance?.text_color ?? preferencesValue?.subtitle_text_color ?? "#FFFFFF")}; background-color: ${String(appearance?.background_color ?? preferencesValue?.subtitle_background_color ?? "#00000000")}; }`;
  onCleanup(() => style?.remove());
}
