/** null follows the device setting; the profile's server-owned display
 * preference can force reduced motion on or off (Tv3SetDisplay). */
let motionOverride: boolean | null = null;
export function setMotionOverride(value: boolean | null) {
  motionOverride = value;
}
export function reducedMotion(): boolean {
  return (
    motionOverride ??
    (typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

/** CSS cubic-bezier(x1,0,x2,1), used by the reference progress/fade/pulse. */
export function easeProgress(value: number, x1: number, x2: number) {
  const x = Math.max(0, Math.min(1, value));
  let lo = 0,
    hi = 1,
    t = x;
  for (let i = 0; i < 14; i++) {
    t = (lo + hi) / 2;
    const v =
      3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (v < x) lo = t;
    else hi = t;
  }
  return 3 * (1 - t) * t * t + t * t * t;
}
