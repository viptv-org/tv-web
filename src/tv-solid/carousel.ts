/** Keep the focused tile inside the viewport, clamping the final card to its edge. */
export function carouselWindow(index: number, count: number, width: number, viewport: number, previous = 0, gap = 36) {
  const stride = width + gap;
  const end = Math.max(0, (count - 1) * stride + width - viewport);
  const left = Math.max(0, Math.min(count - 1, index)) * stride;
  const offset = Math.max(0, Math.min(end, Math.max(left + width - viewport, Math.min(previous, left))));
  const start = Math.floor(offset / stride);
  return { offset, start, x: start * stride - offset };
}
