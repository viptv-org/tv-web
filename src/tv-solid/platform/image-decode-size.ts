/** Decode density is independent of the rectangle the image occupies. */
export function imageDecodeSize(width: number, height: number, decodeWidth?: number, decodeHeight?: number) {
  const size = (hint: number | undefined, fallback: number, maximum: number) =>
    Math.max(1, Math.min(maximum, Math.ceil(Number.isFinite(hint) && hint! > 0 ? hint! : fallback)));
  return { width: size(decodeWidth, width, 3840), height: size(decodeHeight, height, 2160) };
}
