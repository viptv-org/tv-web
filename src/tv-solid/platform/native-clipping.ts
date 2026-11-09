export type ClipNode = {
  absX?: number;
  absY?: number;
  w?: number;
  h?: number;
  boxW?: number;
  boxH?: number;
  clipping?: boolean | number[];
  parentNode?: ClipNode | null;
};
export type NativeClip = { x: number; y: number; w: number; h: number };

/** Intersect the real viewports, stopping before a separately moving native group. */
export function nativeClip(node?: ClipNode | null, stop?: ClipNode): NativeClip | undefined {
  let result: NativeClip | undefined;
  for (let current = node; current && current !== stop; current = current.parentNode) {
    if (!current.clipping) continue;
    const box = Array.isArray(current.clipping)
      ? current.clipping
      : [0, 0, current.boxW ?? current.w ?? 0, current.boxH ?? current.h ?? 0];
    const next = { x: (current.absX ?? 0) + box[0], y: (current.absY ?? 0) + box[1], w: Math.max(0, box[2]), h: Math.max(0, box[3]) };
    if (!result) result = next;
    else {
      const x = Math.max(result.x, next.x), y = Math.max(result.y, next.y);
      result = { x, y, w: Math.max(0, Math.min(result.x + result.w, next.x + next.w) - x), h: Math.max(0, Math.min(result.y + result.h, next.y + next.h) - y) };
    }
  }
  return result;
}

export function localNativeClip(node: ClipNode, stop?: ClipNode): number[] | false {
  const clip = nativeClip(node, stop);
  return clip ? [clip.x - (node.absX ?? 0), clip.y - (node.absY ?? 0), clip.w, clip.h] : false;
}
