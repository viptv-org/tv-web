/** Publish a logo only after both real bitmap dimensions are known. */
export function logoLayout(width: number, height: number, bitmapWidth: number, bitmapHeight: number, centered = false): { width: number; height: number; x?: number; y: number } | undefined {
  if (!(bitmapWidth > 0 && bitmapHeight > 0)) return undefined;
  const fittedWidth = Math.min(width, height * bitmapWidth / bitmapHeight);
  const fittedHeight = fittedWidth * bitmapHeight / bitmapWidth;
  const box = { width: Math.max(1, Math.round(fittedWidth)), height: Math.max(1, Math.round(fittedHeight)) };
  return centered
    ? { ...box, x: Math.max(0, Math.round((width - box.width) / 2)), y: Math.max(0, Math.round((height - box.height) / 2)) }
    : { ...box, y: Math.max(0, Math.round(height - fittedHeight)) };
}
