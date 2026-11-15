import { heroStage, type HeroStageMode } from "./hero-stage";

export type HeroMode = 'hero' | 'landscape' | 'portrait' | 'detail';
export interface HeroLogoBox { x: number; y: number; width: number; height: number; rasterHeight?: number }
interface Rect { x: number; y: number; width: number; height: number }

/** The hero's composition names map onto the band's geometry. */
export function heroBandMode(mode: HeroMode): HeroStageMode {
  if (mode === 'detail') return 'detail';
  if (mode === 'landscape') return 'continue';
  return mode;
}

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
export const detailEpisodeLayout = (() => {
  const columns = 4, gap = 24, left = 96, right = 1824;
  const width = Math.floor((right - left - gap * (columns - 1)) / columns);
  return {columns, width, height: Math.round(width * 9 / 16), step: width + gap};
})();
/** Fit the actual prepared pixels, including logos that do not fill their raster slot. */
export function logoScale(box: HeroLogoBox, width: number, height: number) {
  return Math.min(box.width / Math.max(1, width), box.height / Math.max(1, height));
}
/** Decode only the pixels needed by each composition; blur belongs to the proxy. */
export function heroArtworkLayout(mode: HeroMode, carouselTop?: number): {
  viewport: Rect; image: Rect; clipped: boolean; decodeWidth: number; decodeHeight: number; blur?: number; scrim: boolean;
} {
  const stage = heroStage(heroBandMode(mode), carouselTop);
  return {
    viewport: stage.band, image: stage.image, clipped: stage.clipped,
    decodeWidth: stage.decodeWidth, decodeHeight: stage.decodeHeight, blur: stage.blur,
    scrim: stage.scrim,
  };
}
