import { nativeClip, localNativeClip, type ClipNode } from './native-clipping';
import { opacityWithin } from './native-sync';

type MotionNode = ClipNode & { alpha?: number; parentNode?: MotionNode | null };
export function motionGroupGeometry(root: MotionNode, parent?: MotionNode) {
  const parentX = parent?.absX ?? 0, parentY = parent?.absY ?? 0;
  const clip = nativeClip(root.parentNode, parent);
  const bounds = clip ?? { x: parentX, y: parentY, w: 1920, h: 1080 };
  let inheritedAlpha = 1;
  if (parent && root.parentNode) inheritedAlpha = opacityWithin(root.parentNode, parent);
  else for (let current = root.parentNode; current; current = current.parentNode) inheritedAlpha *= current.alpha ?? 1;
  return { x: (root.absX ?? 0) - bounds.x, y: (root.absY ?? 0) - bounds.y,
    alpha: Math.max(0,Math.min(1,root.alpha ?? 1)), inheritedAlpha: Math.max(0,Math.min(1,inheritedAlpha)), clipX: bounds.x - parentX, clipY: bounds.y - parentY,
    width: bounds.w, height: bounds.h, viewport: clip ? [0,0,bounds.w,bounds.h] : false as const,
    localClip: localNativeClip(root,root.parentNode ?? undefined) };
}
