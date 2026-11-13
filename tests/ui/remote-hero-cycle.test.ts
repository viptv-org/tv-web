import { describe, expect, it } from "vitest";
import { HERO_SLIDE_MS, advanceHeroRotation, clampHeroRotation, heroRotationRunning, restartHeroRotation, startHeroRotation } from "../../src/tv-solid/remote/heroCycle";

describe("Home featured idle rotation", () => {
  it("wraps every server title in order without growing retained cycle state", () => {
    let rotation = startHeroRotation(5);
    for (let index = 0; index < 41; index++) {
      expect(rotation.slide).toBe(index % 5);
      expect(rotation.shown).toBeGreaterThanOrEqual(1);
      expect(rotation.shown).toBeLessThanOrEqual(5);
      expect(heroRotationRunning(rotation, 5)).toBe(true);
      const next = advanceHeroRotation(rotation, 5);
      expect(next).not.toBeNull(); rotation = next!;
    }
  });
  it("retains the nine-second idle interval and stays stationary without multiple titles", () => {
    expect(HERO_SLIDE_MS).toBe(9000);
    for (const count of [0, 1]) {
      const rotation = startHeroRotation(count);
      expect(heroRotationRunning(rotation, count)).toBe(false);
      expect(advanceHeroRotation(rotation, count)).toBeNull();
    }
  });
  it("restarts the idle deadline at the displayed title and clamps a shrinking order", () => {
    expect(restartHeroRotation({slide: 4, shown: 5})).toEqual({slide: 4, shown: 1});
    expect(clampHeroRotation({slide: 4, shown: 5}, 2)).toEqual({slide: 1, shown: 2});
    expect(advanceHeroRotation({slide: 4, shown: 5}, 5)?.slide).toBe(0);
  });
});
