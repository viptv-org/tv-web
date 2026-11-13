/** Distance between featured titles while the visible surface is idle. */
export const HERO_SLIDE_MS = 9000;
export const HERO_SCROLL_MS = 360;

export type HeroRotation = {slide: number; shown: number};
export function startHeroRotation(count: number): HeroRotation {
  return {slide: 0, shown: count > 0 ? 1 : 0};
}
export function advanceHeroRotation(rotation: HeroRotation, count: number): HeroRotation | null {
  if (count < 2) return null;
  return {slide: (rotation.slide + 1) % count, shown: rotation.shown % count + 1};
}
export function restartHeroRotation(rotation: HeroRotation): HeroRotation {
  return {slide: rotation.slide, shown: 1};
}
export function clampHeroRotation(rotation: HeroRotation, count: number): HeroRotation {
  return {slide: Math.min(rotation.slide, Math.max(0, count - 1)), shown: Math.min(rotation.shown, Math.max(0, count))};
}
export function heroRotationRunning(_rotation: HeroRotation, count: number): boolean {
  return count > 1;
}
