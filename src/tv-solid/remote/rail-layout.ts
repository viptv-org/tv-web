/** Pixel offsets keep the focus anchored until the last complete viewport. */
export function railLayout(count: number, selected: number, step: number, width: number, viewport = 1728, buffer = 2) {
  const index = Math.max(0, Math.min(Math.max(0, count - 1), selected));
  const maximum = Math.max(0, (count - 1) * step + width - viewport);
  const offset = Math.min(index * step, maximum);
  return {
    offset,
    focus: index * step - offset,
    start: Math.max(0, Math.floor(offset / step) - buffer),
    end: Math.min(count, Math.ceil((offset + viewport) / step) + buffer),
  };
}
