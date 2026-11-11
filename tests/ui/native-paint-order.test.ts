import { expect, it } from "vitest";
import { nativePaintOrder } from "../../src/tv-solid/platform/native-paint-order";

it("preserves background, poster and overlay ordering regardless of adoption order", () => {
  const root: any = { children: [] }, card: any = { parentNode: root, children: [] };
  const backdrop: any = { parentNode: card, children: [] };
  const poster: any = { parentNode: backdrop }, progress: any = { parentNode: backdrop };
  const next: any = { parentNode: root };
  root.children = [card, next]; card.children = [backdrop]; backdrop.children = [poster, progress];
  expect([progress, next, poster, backdrop].sort(nativePaintOrder)).toEqual([backdrop, poster, progress, next]);
  expect(nativePaintOrder(root, progress)).toBeLessThan(0);
  expect(nativePaintOrder(progress, root)).toBeGreaterThan(0);
  expect(nativePaintOrder(poster, poster)).toBe(0);
  backdrop.children = [progress, poster];
  expect(nativePaintOrder(poster, progress)).toBeGreaterThan(0);
});
