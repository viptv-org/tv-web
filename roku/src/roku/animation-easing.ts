import type { Easing } from './animation-types';

const linear: Easing = t => t;
const easings: { [name: string]: Easing } = {
  linear,
  ease: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  'ease-in': t => t * t,
  'ease-out': t => 1 - (1 - t) * (1 - t),
  'ease-in-out': t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeIn: t => t * t,
  easeOut: t => 1 - (1 - t) * (1 - t),
  easeInOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  quadIn: t => t * t,
  quadOut: t => t * (2 - t),
  quadInOut: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: t => t * t * t,
  cubicOut: t => 1 - Math.pow(1 - t, 3),
  cubicInOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
};

export function resolveEasing(easing?: string | Easing): Easing {
  if (typeof easing === 'function') return easing;
  if (easing && easings[easing] !== undefined) return easings[easing];
  const match = easing && /^cubic-bezier\(([^)]+)\)$/.exec(easing);
  if (match) {
    const values = match[1].split(',').map(Number);
    const [x1, y1, x2, y2] = values;
    if (
      values.length === 4 &&
      values.every(Number.isFinite) &&
      x1 >= 0 &&
      x1 <= 1 &&
      x2 >= 0 &&
      x2 <= 1
    ) {
      const curve = (t: number, a: number, b: number) =>
        3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
      const resolved: Easing = progress => {
        if (progress <= 0 || progress >= 1) return Math.max(0, Math.min(1, progress));
        let low = 0,
          high = 1,
          t = progress;
        for (let i = 0; i < 14; i++) {
          const x = curve(t, x1, x2);
          if (Math.abs(x - progress) < 0.00001) break;
          if (x < progress) low = t;
          else high = t;
          t = (low + high) / 2;
        }
        return curve(t, y1, y2);
      };
      easings[easing!] = resolved;
      return resolved;
    }
  }
  return linear;
}
