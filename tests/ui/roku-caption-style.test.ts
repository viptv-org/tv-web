import { expect, it } from "vitest";
import { nativeCaptionStyle } from "../../roku/src/roku/caption-style";
it("maps profile caption colors, transparency and supported native sizes", () => {
  expect(nativeCaptionStyle({ font_scale: .8, text_color: "#ffff00", background_color: "#00000000" })).toMatchObject({ "Text/Size": "Small", "Text/Color": "Yellow", "Background/Opacity": "Off" });
  expect(nativeCaptionStyle({ font_scale: 1 })).toHaveProperty("Text/Size", "Medium");
  expect(nativeCaptionStyle({ font_scale: 1.25, background_color: "#00000080" })).toMatchObject({ "Text/Size": "Large", "Background/Opacity": "50%" });
});
