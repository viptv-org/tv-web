import { expect, it } from "vitest";
import { DownloadedSegments } from "../../roku/src/roku/buffered-segments";

it("reports downloaded segment times in seconds and preserves gaps", () => {
  const buffer = new DownloadedSegments();
  for (const start of [12, 0, 4]) buffer.observe({ Status: 0, SegType: 0, SegStart: start, SegDuration: 4000 });
  expect(buffer.ranges()).toEqual([{ start: 0, end: 8 }, { start: 12, end: 16 }]);
});
it("does not invent ranges from fill percentages, errors or invalid times", () => {
  const buffer = new DownloadedSegments();
  for (const value of [{ percentage: 100 }, { Status: 404, SegStart: 0, SegDuration: 4000, SegType: 0 }, { Status: 0, SegStart: NaN, SegDuration: 4000, SegType: 0 }]) buffer.observe(value);
  expect(buffer.ranges()).toEqual([]);
});
it("uses the intersection when separate audio and video are downloaded", () => {
  const buffer = new DownloadedSegments();
  buffer.observe({ Status: 0, SegType: 2, SegStart: 0, SegDuration: 12000 });
  buffer.observe({ Status: 0, SegType: 1, SegStart: 4, SegDuration: 4000 });
  expect(buffer.ranges()).toEqual([{ start: 4, end: 8 }]);
  buffer.clear();
  expect(buffer.ranges()).toEqual([]);
});
it("bounds retained disjoint ranges", () => {
  const buffer = new DownloadedSegments();
  for (let i = 0; i < 1000; i++) buffer.observe({ status: 0, segType: 0, segStart: i * 10, segDuration: 1000 });
  expect(buffer.ranges()).toHaveLength(128);
});

it("accepts the JS SDK's measured segStartTime and string duration payload", () => {
  const buffer = new DownloadedSegments();
  buffer.observe({ status: 0, segType: 0, segStartTime: 10010, segDuration: "2002" });
  expect(buffer.ranges()).toEqual([{ start: 10.01, end: 12.012 }]);
});
