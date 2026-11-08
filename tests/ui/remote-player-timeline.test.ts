import { describe, it, expect } from "vitest";
import { bufferedSegments } from "../../src/tv-solid/remote/playerTimeline";

describe("remote player timeline buffered segments", () => {
  it("places each reported range as a fraction of the title timeline", () => {
    expect(
      bufferedSegments([{ start: 0, end: 600 }], 1200),
    ).toEqual([{ left: 0, width: 0.5 }]);
  });

  it("keeps the gaps of a disjoint buffer", () => {
    expect(
      bufferedSegments(
        [
          { start: 0, end: 120 },
          { start: 300, end: 480 },
        ],
        1200,
      ),
    ).toEqual([
      { left: 0, width: 0.1 },
      { left: 0.25, width: 0.15 },
    ]);
  });

  it("clamps a range to the title timeline", () => {
    expect(
      bufferedSegments([{ start: 1100, end: 1400 }], 1200),
    ).toEqual([{ left: 1100 / 1200, width: 100 / 1200 }]);
  });

  it("draws nothing when the engine reports no buffer", () => {
    expect(bufferedSegments(undefined, 1200)).toEqual([]);
    expect(bufferedSegments(null, 1200)).toEqual([]);
    expect(bufferedSegments([], 1200)).toEqual([]);
  });

  it("draws nothing without a title duration", () => {
    expect(bufferedSegments([{ start: 0, end: 60 }], null)).toEqual([]);
    expect(bufferedSegments([{ start: 0, end: 60 }], 0)).toEqual([]);
  });

  it("drops a range that carries no width", () => {
    expect(
      bufferedSegments(
        [
          { start: 200, end: 200 },
          { start: 700, end: 760 },
        ],
        1200,
      ),
    ).toEqual([{ left: 700 / 1200, width: 60 / 1200 }]);
  });
});
