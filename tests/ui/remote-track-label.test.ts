import { expect, it } from "vitest";
import { trackLabel } from "../../src/tv-solid/remote/track-label";
it("keeps language visible when the source title contains only codec information", () => {
  expect(trackLabel({ input_index: 1, language: "hin", title: "Dolby Digital Plus / 5.1 / 48 kHz / 192 kbps" }, "Audio")).toBe("Hindi · 5.1");
  expect(trackLabel({ input_index: 2, language: "eng", title: "Dolby Digital Plus / 7.1 / 48 kHz / 1536 kbps" }, "Audio")).toBe("English · 7.1");
});
it("preserves subtitle qualifiers and does not invent an unknown language", () => {
  expect(trackLabel({ input_index: 3, language: "eng", title: "Forced" }, "Subtitle")).toBe("English · Forced");
  expect(trackLabel({ input_index: 4, language: "eng", title: "subtitle track 4" }, "Subtitle")).toBe("English");
  expect(trackLabel({ input_index: 5, language: "und", title: "subtitle track 5" }, "Subtitle")).toBe("subtitle track 5");
});
