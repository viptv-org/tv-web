/**
 * Presentation clock for the Home featured rotation.
 *
 * The design contract pins Tv3Home's nine-second featured indicator and its
 * fourteen-second artwork zoom (design-contract `TV_SERVER_WRAPPER.md`, "Home
 * billboard motion"), so a slide is always replaced while its zoom is still
 * running. Rotating forever therefore never lets the artwork animation clock
 * retire: every slide starts a fresh time-driven shader and the renderer is
 * asked for another frame for as long as Home is on screen.
 *
 * A pass presents each title in the server's featured order once and then
 * parks on the slide it is showing. A parked rotation schedules no timer and
 * runs no animated indicator, so the last zoom can finish and the renderer
 * reaches a genuine idle state. Remote activity restarts a fresh pass, which is
 * the same rule the contract already states for the nine-second cycle.
 */

/** Distance between two featured slides (Tv3Home's nine-second indicator). */
export const HERO_SLIDE_MS = 9000;

export type HeroRotation = {
  /** Index into the server's featured order. */
  slide: number;
  /** Slides presented in the current pass, counting the current one. */
  shown: number;
};

/** Start a pass at the first title of the server's featured order. */
export function startHeroRotation(count: number): HeroRotation {
  return { slide: 0, shown: count > 0 ? 1 : 0 };
}

/**
 * The slide to present next, or `null` when this pass has already shown every
 * featured title: the rotation then parks on the current slide instead of
 * starting another one.
 */
export function advanceHeroRotation(
  rotation: HeroRotation,
  count: number,
): HeroRotation | null {
  if (count < 2 || rotation.shown >= count) return null;
  return { slide: (rotation.slide + 1) % count, shown: rotation.shown + 1 };
}

/**
 * Begin a fresh pass from the slide in view, which is what remote activity, a
 * new billboard identity and a new featured order all ask for.
 */
export function restartHeroRotation(rotation: HeroRotation): HeroRotation {
  return { slide: rotation.slide, shown: 1 };
}

/** Keep the rotation inside a featured order that shrank. */
export function clampHeroRotation(
  rotation: HeroRotation,
  count: number,
): HeroRotation {
  return {
    slide: Math.min(rotation.slide, Math.max(0, count - 1)),
    shown: rotation.shown,
  };
}

/**
 * Whether the rotation still has something to present. `false` is the steady
 * state idle Home needs: no advance timer is scheduled and the indicator falls
 * back to its static form, so only the pinned artwork zoom is left to retire.
 */
export function heroRotationRunning(
  rotation: HeroRotation,
  count: number,
): boolean {
  return advanceHeroRotation(rotation, count) !== null;
}