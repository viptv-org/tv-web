/** The ambient band behind Home's hero.
 *
 * The hero artwork is no longer a sharp panel beside the title. It is a
 * blurred wash across the top of the frame that ends where the poster
 * carousel begins and dissolves into the page ground over its bottom 35%.
 * The band is the only part of the hero that moves with the carousel, so its
 * geometry lives here instead of in the components that draw it.
 */

/** The fixed logical frame every TV screen is laid out in. */
export const FRAME_WIDTH = 1920;
export const FRAME_HEIGHT = 1080;

/** The share of the band that dissolves into the page ground. */
export const HERO_FADE_RATIO = 0.35;
/** A soft wash, not a photograph: the art is atmosphere behind the title. */
export const HERO_BAND_BLUR = 60;
/** The band is decoded once at this width and stretched to the frame. */
export const HERO_BAND_DECODE_WIDTH = 1280;

/** Where the poster carousel's title line sits for each kind of row. The
 * band's bottom is that line, so the two must never disagree. */
export const CAROUSEL_TOP = {
  hero: 824,
  portrait: 545.2,
  continue: 690.4,
} as const;

export type HeroBandMode = keyof typeof CAROUSEL_TOP;
export type HeroStageMode = HeroBandMode | "detail";

export interface HeroStageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeroStage {
  /** The band's rect in the logical frame. */
  band: HeroStageRect;
  /** Where the artwork is drawn. The band crops it with a cover fit. */
  image: HeroStageRect;
  /** The band's bottom 35%: the ramp that dissolves into the page ground. */
  fade: HeroStageRect;
  /** Whether the band carries the ambient scrim. */
  scrim: boolean;
  clipped: boolean;
  decodeWidth: number;
  decodeHeight: number;
  blur?: number;
}

/** The band's bottom is the carousel's title line. */
export function heroStage(mode: HeroStageMode, carouselTop?: number): HeroStage {
  if (mode === "detail") {
    const full = { x: 0, y: 0, width: FRAME_WIDTH, height: FRAME_HEIGHT };
    return {
      band: full,
      image: full,
      fade: { x: 0, y: 0, width: 0, height: 0 },
      scrim: false,
      clipped: false,
      decodeWidth: FRAME_WIDTH,
      decodeHeight: FRAME_HEIGHT,
    };
  }
  const height = Math.max(1, Math.round(carouselTop ?? CAROUSEL_TOP[mode]));
  const fade = Math.round(height * HERO_FADE_RATIO);
  const band = { x: 0, y: 0, width: FRAME_WIDTH, height };
  return {
    band,
    image: band,
    fade: { x: 0, y: height - fade, width: FRAME_WIDTH, height: fade },
    scrim: true,
    clipped: false,
    decodeWidth: HERO_BAND_DECODE_WIDTH,
    decodeHeight: Math.round((HERO_BAND_DECODE_WIDTH * height) / FRAME_WIDTH),
    blur: HERO_BAND_BLUR,
  };
}
