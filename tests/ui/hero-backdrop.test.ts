import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heroEdgePool } from "../../src/core/presentations";
import {
  BASELINE_EDGE,
  BASELINE_TRANSITION,
  HeroMotionPolicy,
  UNCATEGORIZED_BAG,
  type HeroTransitionSpec,
} from "../../src/tv-solid/heroMotionPolicy";
import {
  FOCUS_SETTLE_MS,
  MIN_STILL_WIDTH,
  artDecodeSize,
  backdropMode,
  backdropScale,
  chooseBackdropArt,
  groundRgb,
  needsStill,
  prefersReducedMotion,
  sceneTextureSize,
  settleDelay,
  stillFillsArt,
} from "../../src/tv-solid/heroBackdropModel";
import {
  ambientSource,
  edgeSource,
  heroEdgeIds,
  heroShaderIndex,
  HERO_TRANSITION_MAIN,
  transitionSource,
} from "../../src/tv-solid/heroShaderLibrary";
import { createHeroContext } from "../../src/tv-solid/heroGlRenderer";

/** Deterministic PRNG so bag order is reproducible. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const transitions = heroShaderIndex.transitions as readonly HeroTransitionSpec[];

describe("TV-042 motion policy", () => {
  it("never draws the crossfade and empties the transition bag before repeating", () => {
    const policy = new HeroMotionPolicy(transitions, seeded(7));
    const rotation = transitions.filter(spec => spec.id !== BASELINE_TRANSITION).map(spec => spec.id);
    expect(rotation.length).toBeGreaterThan(10);
    let current: string | undefined;
    const drawn: string[] = [];
    for (let index = 0; index < rotation.length * 4; index++) {
      const spec = policy.nextTransition(current);
      expect(spec.id).not.toBe(BASELINE_TRANSITION);
      expect(spec.id).not.toBe(current);
      expect(spec.duration).toBeGreaterThanOrEqual(1.8);
      expect(spec.duration).toBeLessThanOrEqual(3.6);
      drawn.push(spec.id);
      current = spec.id;
    }
    for (let bag = 0; bag < 4; bag++)
      expect(new Set(drawn.slice(bag * rotation.length, (bag + 1) * rotation.length)).size).toBe(rotation.length);
    expect(policy.crossfade?.id).toBe(BASELINE_TRANSITION);
  });

  it("keeps one edge bag per category and never repeats the shown style", () => {
    const policy = new HeroMotionPolicy(transitions, seeded(11));
    const horror = { category: "Horror", edges: ["burn", "blood", "static"] };
    const other = { category: null, edges: ["cinematic", "smoke"] };
    expect(HeroMotionPolicy.bagKey(horror)).toBe("Horror");
    expect(HeroMotionPolicy.bagKey(other)).toBe(UNCATEGORIZED_BAG);
    let current: string | undefined;
    const horrorDraws: string[] = [];
    for (let index = 0; index < 3; index++) {
      current = policy.nextEdge(horror, current);
      horrorDraws.push(current);
      // Interleaved draws from another category do not consume Horror's bag.
      policy.nextEdge(other, undefined);
    }
    expect(new Set(horrorDraws)).toEqual(new Set(horror.edges));
    for (let index = 0; index < 30; index++) {
      const next = policy.nextEdge(horror, current);
      expect(next).not.toBe(current);
      expect(horror.edges).toContain(next);
      current = next;
    }
  });

  it("does not repeat the shown style when it is the last member left in a bag", () => {
    const policy = new HeroMotionPolicy(transitions, seeded(13));
    const pool = { category: "Noir", edges: ["noir", "scan"] };
    const first = policy.nextEdge(pool);
    const remaining = pool.edges.find(id => id !== first)!;
    // Another category put the remaining member on screen.
    const next = policy.nextEdge(pool, remaining);
    expect(next).toBe(first);
    expect(policy.nextEdge(pool, next)).toBe(remaining);
  });

  it("uses the linear baseline for an empty pool and repeats only a single-member pool", () => {
    const policy = new HeroMotionPolicy(transitions, seeded(3));
    expect(policy.nextEdge({ category: "Horror", edges: [] }, "burn")).toBe(BASELINE_EDGE);
    expect(policy.nextEdge({ category: null, edges: [] })).toBe(BASELINE_EDGE);
    expect(policy.nextEdge({ category: "Solo", edges: ["noir"] }, "noir")).toBe("noir");
  });

  it("exposes the next bag member for warming without consuming it", () => {
    const policy = new HeroMotionPolicy(transitions, seeded(5));
    const first = policy.nextTransition();
    const peeked = policy.peekTransition();
    expect(peeked).toBeDefined();
    expect(policy.nextTransition(first.id).id).toBe(peeked);
  });
});

describe("TV-042 Core edge pool", () => {
  const edges = heroEdgeIds;

  it("separates Animation movies from Anime series", () => {
    const movie = heroEdgePool("movie", ["Comedy", "animation"], edges);
    const series = heroEdgePool("series", ["Anime"], edges);
    expect(movie.category).toBe("Animation");
    expect(series.category).toBe("Anime");
    expect(movie.edges.length).toBeGreaterThan(1);
    expect(series.edges).not.toEqual(movie.edges);
  });

  it("uses the first pooled genre, then every edge but the baseline", () => {
    expect(heroEdgePool("movie", ["Horror", "Drama"], edges).category).toBe("Horror");
    const fallback = heroEdgePool("movie", [], edges);
    expect(fallback.category).toBeNull();
    expect(fallback.edges).not.toContain(BASELINE_EDGE);
    expect(fallback.edges.length).toBe(edges.length - 1);
  });

  it("sends every field for a title with no genres", () => {
    const none = heroEdgePool("series", [], edges);
    expect(none.category).toBeNull();
    expect(none.edges).not.toContain(BASELINE_EDGE);
    expect(heroEdgePool("", undefined, edges)).toEqual(heroEdgePool("movie", [], edges));
  });

  it("returns an empty pool when the renderer ships no styles, selecting the baseline", () => {
    const pool = heroEdgePool("movie", ["Horror"], []);
    expect(pool.edges).toEqual([]);
    expect(new HeroMotionPolicy(transitions).nextEdge(pool)).toBe(BASELINE_EDGE);
  });
});

describe("TV-042 Details focused still", () => {
  const base = "https://art.example/series.jpg";
  const still = "https://art.example/e1.jpg";

  it("settles 350ms only while an episode is the subject", () => {
    expect(FOCUS_SETTLE_MS).toBe(350);
    expect(settleDelay({ focused: true })).toBe(350);
    expect(settleDelay({ focused: false })).toBe(0);
  });

  it("requires a decoded still at least 60% of the art width (768 logical px)", () => {
    expect(MIN_STILL_WIDTH).toBe(768);
    expect(stillFillsArt(768)).toBe(true);
    expect(stillFillsArt(767)).toBe(false);
    expect(stillFillsArt(undefined)).toBe(false);
    const target = { base, focus: still, focused: true, shown: base };
    expect(needsStill(target)).toBe(true);
    expect(chooseBackdropArt(target, 1280)).toBe(still);
    // Smaller or failed stills keep (or return to) the series art.
    expect(chooseBackdropArt(target, 640)).toBeUndefined();
    expect(chooseBackdropArt({ ...target, shown: still }, undefined)).toBeUndefined();
    expect(chooseBackdropArt({ ...target, shown: "https://art.example/e0.jpg" }, 640)).toBe(base);
    expect(chooseBackdropArt({ ...target, shown: "https://art.example/e0.jpg" }, undefined)).toBe(base);
  });

  it("shows the series art for an episode without a still and after leaving episodes", () => {
    expect(chooseBackdropArt({ base, focus: "", focused: true, shown: still }, undefined)).toBe(base);
    expect(chooseBackdropArt({ base, focus: "", focused: false, shown: still }, undefined)).toBe(base);
    expect(chooseBackdropArt({ base, focus: "", focused: false, shown: undefined }, undefined)).toBe(base);
    expect(chooseBackdropArt({ base: "", focus: "", focused: false, shown: still }, undefined)).toBeUndefined();
    expect(chooseBackdropArt({ base, focus: "", focused: false, shown: base }, undefined)).toBeUndefined();
  });

  it("decodes within the art box without upscaling", () => {
    expect(artDecodeSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(artDecodeSize(640, 360)).toEqual({ width: 640, height: 360 });
    expect(artDecodeSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(artDecodeSize(1000, 1500)).toEqual({ width: 480, height: 720 });
    expect(artDecodeSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe("TV-042 fallback selection", () => {
  it("uses the static compositor for Sources, reduced motion and GL failure", () => {
    expect(backdropMode({ motion: true, reducedMotion: false, failed: false })).toBe("shader");
    expect(backdropMode({ motion: false, reducedMotion: false, failed: false })).toBe("static");
    expect(backdropMode({ motion: true, reducedMotion: true, failed: false })).toBe("static");
    expect(backdropMode({ motion: true, reducedMotion: false, failed: true })).toBe("static");
  });

  it("maps prefers-reduced-motion: reduce", () => {
    const view = (matches: boolean) => ({ matchMedia: (query: string) => ({ matches: matches && query === "(prefers-reduced-motion: reduce)" }) as MediaQueryList });
    expect(prefersReducedMotion(view(true))).toBe(true);
    expect(prefersReducedMotion(view(false))).toBe(false);
    expect(prefersReducedMotion({} as Window)).toBe(false);
    expect(prefersReducedMotion({ matchMedia: () => { throw new Error("blocked"); } })).toBe(false);
  });

  it("reports WebGL as unavailable when a context cannot be created", () => {
    const canvas = (getContext: () => unknown) => ({ getContext }) as unknown as HTMLCanvasElement;
    expect(createHeroContext(canvas(() => null))).toBeNull();
    expect(createHeroContext(canvas(() => { throw new Error("denied"); }))).toBeNull();
  });
});

describe("TV-042 renderer sizing and sources", () => {
  it("caps output at one pixel per logical pixel and uses a power-of-two blur scene", () => {
    expect(backdropScale(1920, 1)).toBe(1);
    expect(backdropScale(1920, 2)).toBe(1);
    expect(backdropScale(1280, 1)).toBeCloseTo(2 / 3);
    expect(sceneTextureSize(1280, 720)).toEqual({ width: 1024, height: 1024 });
    expect(sceneTextureSize(853, 480)).toEqual({ width: 1024, height: 512 });
    expect(sceneTextureSize(1280, 720, 512)).toEqual({ width: 512, height: 512 });
    expect(groundRgb("#0B0B0C").map(value => Math.round(value * 255))).toEqual([11, 11, 12]);
  });

  it("assembles every catalog program from the pinned design shaders", () => {
    const pinned = (path: string) => readFileSync(`design-contract/assets/hero/${path}`, "utf8");
    expect(heroShaderIndex.transitions.map(spec => spec.id)).toContain(BASELINE_TRANSITION);
    expect(heroEdgeIds).toContain(BASELINE_EDGE);
    for (const { id } of heroShaderIndex.transitions)
      expect(transitionSource(id)).toBe(`${pinned("transition_common.glsl")}\n${pinned(`transitions/${id}.glsl`)}\n${HERO_TRANSITION_MAIN}`);
    for (const id of heroEdgeIds)
      expect(edgeSource(id)).toBe(`${pinned("edge_common.glsl")}\n${pinned(`edges/${id}.glsl`)}\n${pinned("edge_main.glsl")}`);
    expect(ambientSource()).toBe(`${pinned("edge_common.glsl")}\n${pinned("ambient_main.glsl")}`);
  });
});
