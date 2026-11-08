import { describe, expect, it } from "vitest";
import { guideWindowOf } from "../../src/tv-solid/remote/guideWindow";
import type { Guide } from "../../src/tv-solid/remote/types";

const view = (
  window_start_millis: number,
  now_millis: number,
): Guide["view"] => ({
  window_start_millis,
  now_millis,
  window_end_millis: window_start_millis + 7_200_000,
});

describe("Live guide window", () => {
  it("takes the earliest loaded window and the latest observation of now", () => {
    const window = guideWindowOf(
      [view(1_800_000, 2_700_000), view(3_600_000, 2_400_000)],
      0,
    );
    expect(window).toEqual({ start: 1_800_000, now: 2_700_000 });
  });

  it("ignores the rows whose own guide is pending or failed", () => {
    const loaded = [undefined, view(1_800_000, 2_100_000), undefined];
    expect(guideWindowOf(loaded, 9_999_999)).toEqual({
      start: 1_800_000,
      now: 2_100_000,
    });
    // Every row missing is the same window the server would answer with.
    expect(guideWindowOf([undefined, undefined], 4_000_000)).toEqual({
      start: 3_600_000,
      now: 4_000_000,
    });
  });

  it("never leaves the grid without a window while it has rows to draw", () => {
    const clock = 1_000;
    expect(guideWindowOf([], clock)).toEqual({ start: 0, now: clock });
    // A view that carried no window cannot pull the grid back to zero.
    expect(
      guideWindowOf(
        [view(Number.NaN, Number.NaN), view(7_200_000, 7_300_000)],
        0,
      ),
    ).toEqual({ start: 7_200_000, now: 7_300_000 });
  });
});
