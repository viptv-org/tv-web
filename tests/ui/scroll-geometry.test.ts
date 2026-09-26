import { describe, expect, it } from "vitest";
import { revealOffset } from "../../src/ui/scrollGeometry";
import { appendCatalogPage } from "../../src/ui/catalogPaging";
import type { MediaItem } from "../../src/api";
const item = (id: string): MediaItem => ({ id, type: "movie", name: id, title: id, genres: [], episodes: [], raw: {} });

describe("TV nearest-edge scrolling", () => {
  it("keeps visible cards still, then advances a single pitch, and clamps the last card", () => {
    const viewport = 1632, width = 320, pitch = 356, extent = 4 + 12 * pitch - 36 + 4;
    let offset = 0;
    for (let index = 0; index < 12; index++) {
      const next = revealOffset(offset, 4 + index * pitch, 4 + index * pitch + width, viewport, extent);
      if (index < 4) expect(next).toBe(0);
      if (index > 4) expect(next - offset).toBe(pitch);
      offset = next;
    }
    expect(offset).toBe(extent - viewport);
    for (let index = 11; index >= 0; index--) offset = revealOffset(offset, 4 + index * pitch, 4 + index * pitch + width, viewport, extent);
    expect(offset).toBe(0);
  });
  it("moving upward never produces a downward target", () => {
    expect(revealOffset(600, 360, 618, 1080, 3000)).toBe(356);
    expect(revealOffset(600, 700, 958, 1080, 3000)).toBe(600);
  });
});

describe("catalog pagination progress", () => {
  it("stops empty, duplicate-only, backwards and repeated pages despite has_more", () => {
    expect(appendCatalogPage([], [], 0, true, 20).nextSkip).toBeUndefined();
    expect(appendCatalogPage([item("one")], [item("one")], 20, true, 40).nextSkip).toBeUndefined();
    expect(appendCatalogPage([], [item("one")], 20, true, 20).nextSkip).toBeUndefined();
    expect(appendCatalogPage([], [item("one")], 20, true, 0).nextSkip).toBeUndefined();
  });
  it("appends unique results and retains a progressing cursor", () => {
    const result = appendCatalogPage([item("one")], [item("one"), item("two"), item("two")], 20, true, 40);
    expect(result.items.map(item => item.id)).toEqual(["one", "two"]);
    expect(result.nextSkip).toBe(40);
  });
});
