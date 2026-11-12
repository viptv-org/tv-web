export type NativeVisualLayer = "modal" | "chrome" | "scrim" | "backdrop" | "qr" | "visual";

type Visual = {
  kind: "poster" | "rect" | "qr";
  width: number;
  height: number;
  src?: string;
  modal?: boolean;
  focusRing?: boolean;
  paintBand?: "backdrop" | "scrim";
};

export function nativeVisualLayer(value: Visual): NativeVisualLayer {
  if (value.modal) return "modal";
  if (value.focusRing) return "chrome";
  if (value.paintBand === "scrim" || value.src === "pkg:/assets/hero-scrim.png" || value.src === "pkg:/assets/home-scrim.png" || value.src === "pkg:/assets/topbar-scrim.png")
    return "scrim";
  if (value.paintBand === "backdrop" || value.kind === "poster" && value.width >= 1900 && value.height >= 1000 && !value.src?.includes("welcome-"))
    return "backdrop";
  if (value.kind === "rect" && value.width >= 1900 && value.height >= 1000) return "scrim";
  return value.kind === "qr" ? "qr" : "visual";
}
