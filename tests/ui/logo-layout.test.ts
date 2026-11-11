import { expect, it } from "vitest";
import { logoLayout } from "../../src/tv-solid/platform/logo-layout";

it("waits for real dimensions instead of showing a centered box then jumping left", () => {
  expect(logoLayout(640, 160, 0, 0)).toBeUndefined();
  expect(logoLayout(640, 160, 400, 0)).toBeUndefined();
  expect(logoLayout(640, 160, 400, 400)).toEqual({ width: 160, height: 160, y: 0 });
});

it("preserves aspect and bottom alignment for wide title artwork", () => {
  expect(logoLayout(640, 160, 2000, 200)).toEqual({ width: 640, height: 64, y: 96 });
});
