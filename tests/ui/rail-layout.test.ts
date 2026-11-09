import { expect, it } from "vitest";
import { railLayout } from "../../src/tv-solid/remote/rail-layout";

it("keeps the leading focus still while the row advances", () => {
  expect(railLayout(30, 1, 271.2, 255.2).focus).toBe(0);
  expect(railLayout(30, 5, 271.2, 255.2).offset).toBeCloseTo(1356);
});

it("ends with the last card entirely visible rather than empty trailing space", () => {
  const layout = railLayout(30, 29, 442.4, 423.4);
  expect(layout.focus + 423.4).toBeCloseTo(1728);
  expect(layout.end).toBe(30);
});

it("bounds the mounted window for long catalogs and fast jumps", () => {
  for (const selected of [0, 1, 7, 500, 9999]) {
    const layout = railLayout(10000, selected, 271.2, 255.2);
    expect(layout.end - layout.start).toBeLessThanOrEqual(12);
    expect(layout.start).toBeGreaterThanOrEqual(0);
    expect(layout.end).toBeLessThanOrEqual(10000);
  }
  expect(railLayout(0, 0, 271.2, 255.2)).toEqual({ offset: 0, focus: 0, start: 0, end: 0 });
});
