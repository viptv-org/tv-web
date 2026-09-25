import { describe, expect, it } from "vitest";
import { carouselWindow } from "../../src/tv-solid/carousel";

describe("TV carousel visibility", () => {
  for (const width of [320, 360]) for (const count of [1, 4, 5, 12, 50]) {
    it(`keeps every ${width}px card visible in both directions (${count} cards)`, () => {
      let previous = 0;
      const indices = Array.from({ length: count }, (_, index) => index);
      for (const index of [...indices, ...indices.reverse()]) {
        const window = carouselWindow(index, count, width, 1632, previous);
        const left = index * (width + 36) - window.offset;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(1632);
        expect(window.start).toBeLessThanOrEqual(index);
        expect(index - window.start).toBeLessThan(width === 360 ? 5 : 6);
        if (index === count - 1 && count * (width + 36) - 36 >= 1632)
          expect(left + width).toBe(1632);
        previous = window.offset;
      }
      expect(previous).toBe(0);
    });
  }
});
