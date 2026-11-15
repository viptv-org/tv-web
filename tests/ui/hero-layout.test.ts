import { describe, expect, it } from 'vitest';
import { detailBodyOffset, detailLogoBox, heroArtworkLayout, homeLogoBox, logoScale } from '../../src/tv-solid/remote/hero-layout';
import { imageSource } from '../../src/tv-solid/remote/image-source';

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
  it('the ambient band ends on the carousel line and every band mode is blurred', () => {
    // The hero is a blurred band above the poster carousel, so the artwork is
    // cropped inside the band instead of zoomed into a clipped side panel.
    for (const [mode, top] of [['hero', 824], ['landscape', 690], ['portrait', 545]] as const) {
      const layout = heroArtworkLayout(mode);
      expect(layout.viewport).toEqual({ x: 0, y: 0, width: 1920, height: top });
      expect(layout.image).toEqual(layout.viewport);
      expect(layout.clipped).toBe(false);
      expect(layout.blur).toBe(60);
      expect(layout.scrim).toBe(true);
      expect(layout.decodeWidth).toBe(1280);
      expect(layout.decodeHeight).toBe(Math.round(1280 * top / 1920));
      expect(layout.decodeWidth * layout.decodeHeight).toBeLessThanOrEqual(1280 * 824);
    }
    const detail = heroArtworkLayout('detail');
    expect(detail.blur).toBeUndefined();
    expect(detail.scrim).toBe(false);
    expect(detail.viewport).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
  it('applies the approved strong proxy blur without changing the trusted source', () => {
    const raw = 'https://wsrv.nl/?url=image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg&w=1280&h=720&fit=cover&blur=60&output=webp&q=75';
    const portrait = heroArtworkLayout('portrait');
    const image = new URL(imageSource(raw, portrait.decodeWidth, portrait.decodeHeight, 'cover', portrait.blur));
    expect(image.searchParams.get('url')).toBe('image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg');
    expect(image.searchParams.get('blur')).toBe('60');
    expect(image.searchParams.get('w')).toBe('1280'); expect(image.searchParams.get('h')).toBe('363');
    expect(image.searchParams.get('q')).toBe('75'); expect(image.searchParams.get('output')).toBe('webp');
    const detail = heroArtworkLayout('detail');
    const plain = 'https://wsrv.nl/?url=image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg&w=1280&h=720&fit=cover&output=webp&q=75';
    expect(new URL(imageSource(plain, detail.decodeWidth, detail.decodeHeight, 'cover', detail.blur)).searchParams.has('blur')).toBe(false);
    expect(new URL(imageSource(plain, portrait.decodeWidth, portrait.decodeHeight, 'cover', portrait.blur)).searchParams.get('blur')).toBe('60');
  });
});
