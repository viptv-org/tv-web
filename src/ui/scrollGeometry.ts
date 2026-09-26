/** Minimum movement to reveal a target, clamped to the scrollable content. */
export function revealOffset(current: number, start: number, end: number, viewport: number, extent: number, inset = 4): number {
  let next = current;
  if (start < current + inset) next = start - inset;
  else if (end > current + viewport - inset) next = end - viewport + inset;
  return Math.min(Math.max(0, extent - viewport), Math.max(0, next));
}
