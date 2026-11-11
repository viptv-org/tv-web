export function finiteNumber(value: any, fallback: number): number {
  return typeof value === 'number' && isFinite(value) ? value : fallback;
}
export function sameValue(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}
