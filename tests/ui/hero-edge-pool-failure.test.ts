import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/core", async original => ({
  ...(await original<typeof import("../../src/core")>()),
  normalizeCore: (kind: string) => {
    if (kind === "heroEdgePool") throw new Error("InvalidInput: missing genres");
    throw new Error(`unexpected ${kind}`);
  },
}));

describe("TV-042 edge pool resilience", () => {
  it("falls back to the linear baseline when Core rejects the input", async () => {
    const { heroEdgePool } = await import("../../src/core/presentations");
    const { BASELINE_EDGE, HeroMotionPolicy } = await import("../../src/tv-solid/heroMotionPolicy");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pool = heroEdgePool("movie", undefined, ["linear", "noir"]);
    expect(pool).toEqual({ category: null, edges: [] });
    expect(new HeroMotionPolicy([{ id: "fade", name: "Crossfade", duration: 1.6 }]).nextEdge(pool)).toBe(BASELINE_EDGE);
    expect(warn).toHaveBeenCalled();
  });
});
