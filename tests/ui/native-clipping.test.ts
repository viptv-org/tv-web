import { expect, it } from "vitest";
import { localNativeClip, nativeClip, type ClipNode } from "../../src/tv-solid/platform/native-clipping";

it("intersects nested viewports instead of letting detached paint layers escape", () => {
  const screen = { absX: 0, absY: 0, w: 1920, h: 1080, clipping: true };
  const rail = { parentNode: screen, absX: 96, absY: 530, w: 1728, h: 550, clipping: true };
  const tile = { parentNode: rail, absX: -100, absY: 580, w: 400, h: 250, clipping: true };
  expect(nativeClip(tile)).toEqual({ x: 96, y: 580, w: 204, h: 250 });
  expect(localNativeClip(tile)).toEqual([196, 0, 204, 250]);
});

it("keeps inner clips fixed in the moving group's coordinates", () => {
  const viewport: ClipNode = { absX: 96, absY: 530, w: 1728, h: 550, clipping: true };
  const motion: ClipNode = { parentNode: viewport, absX: -100, absY: 580 };
  const tile: ClipNode = { parentNode: motion, absX: -100, absY: 580, w: 400, h: 250, clipping: true };
  expect(localNativeClip(tile, motion)).toEqual([0, 0, 400, 250]);
  motion.absX = -200;tile.absX = -200;
  expect(localNativeClip(tile, motion)).toEqual([0, 0, 400, 250]);
  expect(nativeClip(motion.parentNode)).toEqual({ x: 96, y: 530, w: 1728, h: 550 });
});

it("supports explicit clip rectangles and preserves empty intersections", () => {
  const parent = { absX: 10, absY: 20, clipping: [2, 4, 20, 30] };
  expect(localNativeClip(parent)).toEqual([2, 4, 20, 30]);
  expect(nativeClip({ parentNode: parent, absX: 100, absY: 100, w: 20, h: 20, clipping: true })?.w).toBe(0);
  expect(localNativeClip({})).toBe(false);
});
