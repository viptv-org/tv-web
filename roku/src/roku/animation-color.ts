const COLOR_KEYS: Record<string, true> = {
  color: true,
  colorTop: true,
  colorBottom: true,
  colorLeft: true,
  colorRight: true,
  colorTopLeft: true,
  colorTopRight: true,
  colorBottomLeft: true,
  colorBottomRight: true,
  colorTl: true,
  colorTr: true,
  colorBl: true,
  colorBr: true,
  textColor: true,
  placeholderColor: true,
  blendColor: true
};

export function isColorKey(key: string): boolean {
  return COLOR_KEYS[key] === true;
}

/** Per-channel RGBA interpolation (0xRRGGBBAA). */
export function lerpColor(from: number, to: number, t: number): number {
  const a = from >>> 0;
  const b = to >>> 0;
  const r = Math.round(((a >>> 24) & 255) + (((b >>> 24) & 255) - ((a >>> 24) & 255)) * t);
  const g = Math.round(((a >>> 16) & 255) + (((b >>> 16) & 255) - ((a >>> 16) & 255)) * t);
  const bl = Math.round(((a >>> 8) & 255) + (((b >>> 8) & 255) - ((a >>> 8) & 255)) * t);
  const al = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return (((r & 255) << 24) | ((g & 255) << 16) | ((bl & 255) << 8) | (al & 255)) >>> 0;
}
