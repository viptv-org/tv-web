import { expect, it } from "vitest";
import { programLine } from "../../src/tv-solid/remote/live/program-line";

const now = new Date(2026, 0, 1, 12, 0, 0).getTime();
const at = (minutes: number) => now + minutes * 60000;

it("reads a guide slot as minutes under the hour and an end time above it", () => {
  expect(programLine(at(-30), at(25), now)).toContain("min left");
  expect(programLine(at(-30), at(90), now)).toMatch(/until/);
});

it("never prints a marker that is outside the schedule", () => {
  const line = programLine(0, 9999999999999, now);
  expect(line).not.toContain("min left");
  expect(line).not.toContain("until");
  expect(programLine(at(-90), at(-30), now)).not.toContain("min left");
});
