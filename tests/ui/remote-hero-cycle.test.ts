import { describe, expect, it } from "vitest";
import {
  HERO_SLIDE_MS,
  advanceHeroRotation,
  heroRotationRunning,
  restartHeroRotation,
  startHeroRotation,
} from "../../src/tv-solid/remote/heroCycle";

/** Walk a pass to its end, or stop after `limit` advances. */
function walk(count: number, limit: number) {
  let rotation = startHeroRotation(count);
  const order = [rotation.slide];
  for (let wake = 0; wake < limit; wake++) {
    const next = advanceHeroRotation(rotation, count);
    if (!next) break;
    rotation = next;
    order.push(rotation.slide);
  }
  return { rotation, order };
}

describe("Home featured rotation", () => {
  it("presents every featured title once and then parks, so nothing wakes the renderer", () => {
    const { rotation, order } = walk(5, 40);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(advanceHeroRotation(rotation, 5)).toBeNull();
    expect(heroRotationRunning(rotation, 5)).toBe(false);
  });

  it("keeps the nine-second cycle running while a pass is still presenting", () => {
    // The design contract pins Tv3Home's nine-second featured indicator.
    expect(HERO_SLIDE_MS).toBe(9000);
    const first = startHeroRotation(2);
    expect(first).toEqual({ slide: 0, shown: 1 });
    expect(heroRotationRunning(first, 2)).toBe(true);
    const second = advanceHeroRotation(first, 2);
    expect(second).toEqual({ slide: 1, shown: 2 });
    expect(heroRotationRunning(second!, 2)).toBe(false);
  });

  it("never cycles a single featured title or an empty list", () => {
    for (const count of [0, 1]) {
      const rotation = startHeroRotation(count);
      expect(heroRotationRunning(rotation, count)).toBe(false);
      expect(advanceHeroRotation(rotation, count)).toBeNull();
    }
  });

  it("restarts one full pass from the parked slide after remote activity", () => {
    const parked = { slide: 3, shown: 5 };
    expect(heroRotationRunning(parked, 5)).toBe(false);
    const restarted = restartHeroRotation(parked);
    expect(restarted).toEqual({ slide: 3, shown: 1 });
    expect(heroRotationRunning(restarted, 5)).toBe(true);
    // A restart walks the server's order from where it parked, once.
    let rotation = restarted;
    const order = [rotation.slide];
    for (let wake = 0; wake < 10; wake++) {
      const next = advanceHeroRotation(rotation, 5);
      if (!next) break;
      rotation = next;
      order.push(rotation.slide);
    }
    expect(order).toEqual([3, 4, 0, 1, 2]);
    expect(heroRotationRunning(rotation, 5)).toBe(false);
  });

  it("resumes when the server grows the featured order past what was shown", () => {
    const parked = { slide: 1, shown: 2 };
    expect(heroRotationRunning(parked, 2)).toBe(false);
    expect(heroRotationRunning(parked, 4)).toBe(true);
    expect(advanceHeroRotation(parked, 4)).toEqual({ slide: 2, shown: 3 });
  });
});