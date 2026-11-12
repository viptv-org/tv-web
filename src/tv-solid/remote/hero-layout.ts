export type HeroMode = 'hero' | 'landscape' | 'portrait' | 'detail';
export interface HeroLogoBox { x: number; y: number; width: number; height: number; rasterHeight?: number }
interface Rect { x: number; y: number; width: number; height: number }

export const BRANDING_MOTION = {
  x: { duration: 220, easing: 'ease-out' },
  y: { duration: 220, easing: 'ease-out' },
  scale: { duration: 220, easing: 'ease-out' },
};
export const compactDetail = (zone: string) => ['episodes', 'seasons', 'recommendations'].includes(zone);
export function homePreviewTop(bottom = 690): number {
  return Math.max(96, 132 + Math.max(0, bottom - 40 - 132 - 310) / 2);
}
export function homeLogoBox(bottom?: number): HeroLogoBox {
  return bottom === undefined
    ? { x: 96, y: 330, width: 640, height: 160, rasterHeight: 160 }
    : { x: 96, y: homePreviewTop(bottom), width: 640, height: 120, rasterHeight: 120 };
}
export function detailLogoBox(episodes: boolean, compact: boolean): HeroLogoBox {
  const rasterHeight = episodes ? 134 : 190;
  return compact
    ? { x: 96, y: 54, width: 220, height: 68, rasterHeight }
    : { x: 96, y: episodes ? 250 : 220, width: 640, height: rasterHeight, rasterHeight };
}
export function detailBodyOffset(episodes: boolean, compact: boolean): number {
  return compact ? episodes ? -480 : -156 : 0;
}
export function detailListTop(episodes: boolean, seasons: boolean, compact: boolean): number {
  return compact ? episodes ? seasons ? 154 : 184 : 680 : seasons ? 816 : 836;
}
/** Fit the actual prepared pixels, including logos that do not fill their raster slot. */
export function logoScale(box: HeroLogoBox, width: number, height: number) {
  return Math.min(box.width / Math.max(1, width), box.height / Math.max(1, height));
}
/** Decode only the pixels needed by each composition; blur belongs to the proxy. */
export function heroArtworkLayout(mode: HeroMode): {
  viewport: Rect; image: Rect; clipped: boolean; decodeWidth: number; decodeHeight: number; blur?: number;
} {
  const full = { x: 0, y: 0, width: 1920, height: 1080 };
  if (mode === 'detail' || mode === 'portrait') return {
    viewport: full, image: full, clipped: false,
    decodeWidth: mode === 'detail' ? 1920 : 960,
    decodeHeight: mode === 'detail' ? 1080 : 540,
    blur: mode === 'portrait' ? 8 : undefined,
  };
  return {
    viewport: { x: 480, y: 0, width: 1440, height: 810 },
    image: { x: -240, y: -135, width: 1920, height: 1080 }, clipped: true,
    decodeWidth: mode === 'hero' ? 1440 : 1280,
    decodeHeight: mode === 'hero' ? 810 : 720, blur: 0,
  };
}
