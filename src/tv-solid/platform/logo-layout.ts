/** Publish a logo only after both real bitmap dimensions are known. */
export function logoLayout(width: number, height: number, bitmapWidth: number, bitmapHeight: number) {
  if (!(bitmapWidth > 0 && bitmapHeight > 0)) return undefined;
  const fittedWidth = Math.min(width, height * bitmapWidth / bitmapHeight);
  const fittedHeight = fittedWidth * bitmapHeight / bitmapWidth;
  return { width: Math.max(1, Math.round(fittedWidth)), height: Math.max(1, Math.round(fittedHeight)), y: Math.max(0, Math.round(height - fittedHeight)) };
}
