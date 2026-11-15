import { describe, expect, it } from 'vitest';
import { CAROUSEL_TOP, FRAME_HEIGHT, FRAME_WIDTH, HERO_BAND_DECODE_WIDTH, HERO_FADE_RATIO, heroStage } from '../../src/tv-solid/remote/hero-stage';

describe('the ambient hero band', () => {
  it('ends where the poster carousel begins for every mode', () => {
    expect(heroStage('hero').band).toEqual({ x: 0, y: 0, width: FRAME_WIDTH, height: 824 });
    expect(heroStage('continue').band.height).toBe(690);
    expect(heroStage('portrait').band.height).toBe(545);
    for (const mode of ['hero', 'continue', 'portrait'] as const)
      expect(heroStage(mode).band.height).toBe(Math.round(CAROUSEL_TOP[mode]));
  });

  it('follows the live carousel line rather than a per-mode constant', () => {
    // A shelf geometry change must move the band with it, not leave a seam.
    expect(heroStage('portrait', 600).band.height).toBe(600);
    expect(heroStage('hero', 900).band.height).toBe(900);
    expect(heroStage('portrait', 600).decodeHeight).toBe(Math.round(HERO_BAND_DECODE_WIDTH * 600 / FRAME_WIDTH));
  });

  it('dissolves over its own bottom 35% into the page ground', () => {
    for (const top of [545, 690, 824, 900]) {
      const stage = heroStage('hero', top);
      const fade = Math.round(top * HERO_FADE_RATIO);
      expect(stage.fade).toEqual({ x: 0, y: top - fade, width: FRAME_WIDTH, height: fade });
      expect(stage.fade.y + stage.fade.height).toBe(top);
      expect(stage.fade.height / stage.band.height).toBeCloseTo(HERO_FADE_RATIO, 2);
    }
  });

  it('draws the artwork into the band itself and lets the cover fit crop it', () => {
    const stage = heroStage('hero');
    expect(stage.image).toEqual(stage.band);
    expect(stage.clipped).toBe(false);
    expect(stage.scrim).toBe(true);
    expect(stage.blur).toBe(60);
  });

  it('keeps the detail backdrop full bleed and unblurred', () => {
    const detail = heroStage('detail');
    expect(detail.band).toEqual({ x: 0, y: 0, width: FRAME_WIDTH, height: FRAME_HEIGHT });
    expect(detail.image).toEqual(detail.band);
    expect(detail.fade.height).toBe(0);
    expect(detail.scrim).toBe(false);
    expect(detail.blur).toBeUndefined();
  });

  it('never yields a degenerate band for a carousel that has not been laid out yet', () => {
    expect(heroStage('hero', 0).band.height).toBe(1);
    expect(heroStage('hero', -40).band.height).toBe(1);
  });
});
