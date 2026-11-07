export interface CaptionAppearance { font_scale?: number; text_color?: string; background_color?: string; }
const colors: Record<string, string> = {
  FFFFFF: "White", "000000": "Black", FF0000: "Red", "00FF00": "Green",
  "0000FF": "Blue", FFFF00: "Yellow", FF00FF: "Magenta", "00FFFF": "Cyan",
};
export function nativeCaptionStyle(appearance: CaptionAppearance): Record<string, string> {
  const color = (value: string | undefined, fallback: string) => colors[(value ?? fallback).replace(/^#/, "").slice(0, 6).toUpperCase()] ?? "Default";
  const background = appearance.background_color ?? "#00000000";
  const alpha = background.length === 9 ? parseInt(background.slice(7, 9), 16) / 255 : 1;
  return {
    "Text/Size": (appearance.font_scale ?? 1) < 1 ? "Small" : (appearance.font_scale ?? 1) < 1.25 ? "Medium" : "Large",
    "Text/Color": color(appearance.text_color, "#FFFFFF"),
    "Background/Color": color(background, "#000000"),
    "Background/Opacity": alpha === 0 ? "Off" : `${Math.max(25, Math.min(100, Math.round(alpha * 4) * 25))}%`,
  };
}
