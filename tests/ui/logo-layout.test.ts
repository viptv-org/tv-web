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


it("centers preparation clearlogos inside one stable slot without changing aspect", () => {
  expect(logoLayout(800, 180, 400, 400, true)).toEqual({width:180,height:180,x:310,y:0});
  expect(logoLayout(800, 180, 2000, 200, true)).toEqual({width:800,height:80,x:0,y:50});
});
