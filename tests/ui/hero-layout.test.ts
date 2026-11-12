import { describe, expect, it } from 'vitest';
import { detailBodyOffset, detailLogoBox, heroArtworkLayout, homeLogoBox, logoScale } from '../../src/tv-solid/remote/hero-layout';

describe('branding clearance throughout shared motion', () => {
  it('movie synopsis never crosses the prepared logo while entering or leaving recommendations', () => {
    const expanded = detailLogoBox(false, false), compact = detailLogoBox(false, true);
    for (const progress of [0, .1, .25, .5, .75, 1]) {
      const from = expanded.y + expanded.height, to = compact.y + compact.height;
      const logoBottom = from + (to - from) * progress;
      const metadataTop = 432 + detailBodyOffset(false, true) * progress;
      expect(metadataTop - logoBottom).toBeGreaterThanOrEqual(22);
    }
  });
  it('compact fitting uses the actual prepared logo size rather than its empty raster padding', () => {
    const box = detailLogoBox(true, true);
    for (const pixels of [{ width: 451, height: 134 }, { width: 640, height: 80 }]) {
      const scale = logoScale(box, pixels.width, pixels.height);
      expect(pixels.width * scale).toBeLessThanOrEqual(box.width);
      expect(pixels.height * scale).toBeLessThanOrEqual(box.height);
      expect(Math.max(pixels.width * scale / box.width, pixels.height * scale / box.height)).toBeCloseTo(1, 8);
    }
  });
  it('Continue and portrait summaries keep the same clearance as their shared logo parent', () => {
    const from = homeLogoBox(690.4), to = homeLogoBox(545.2);
    for (const progress of [0, .25, .5, .75, 1]) {
      const top = from.y + (to.y - from.y) * progress;
      const metadataTop = from.y + 144 + (to.y - from.y) * progress;
      expect(metadataTop - (top + 120)).toBeCloseTo(24, 8);
    }
  });
  it('only portrait backgrounds use full-width proxy blur while single-image zoom stays clipped and bounded', () => {
    const portrait = heroArtworkLayout('portrait'), single = heroArtworkLayout('landscape'), hero = heroArtworkLayout('hero');
    expect(portrait.blur).toBe(8); expect(portrait.viewport.width).toBe(1920); expect(portrait.clipped).toBe(false);
    expect(single.image.width / single.viewport.width).toBeCloseTo(4 / 3, 8);
    expect(single.image.height / single.viewport.height).toBeCloseTo(4 / 3, 8);
    expect(single.clipped).toBe(true); expect(single.blur).toBe(0);
    expect(single.decodeWidth * single.decodeHeight).toBeLessThanOrEqual(1280 * 720);
    expect(hero.decodeWidth * hero.decodeHeight).toBeLessThanOrEqual(1440 * 810);
    expect(heroArtworkLayout('detail').blur).toBeUndefined();
  });
});
