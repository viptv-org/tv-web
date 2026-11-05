/**
 * The wall-clock instant this renderer's clock counts from. Renderer 2.0 keeps
 * its `startTime` private, and `performance.now() - elapsedTime` drifts once
 * the loop sleeps (elapsedTime only moves when a frame is drawn). Shader time
 * uniforms are relative to this value, so capture it once at creation and use
 * the same instant everywhere.
 */
const starts = new WeakMap<object, number>();

export function setRendererStart(renderer: object, at: number): void {
  starts.set(renderer, at);
}

export function rendererStart(renderer: object): number {
  return starts.get(renderer) ?? 0;
}
