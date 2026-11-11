export type RuntimeObservation = { phase: string; at: number; [field: string]: unknown };

/** Opt-in local diagnostics; never sends or stores observations itself. */
export function runtimeObserver(): ((event: RuntimeObservation) => void) | undefined {
  const observer = (globalThis as any).__solidtvRuntimeObserver;
  return typeof observer === 'function' ? event => { try { observer(event); } catch { /* Diagnostics cannot interrupt the app. */ } } : undefined;
}
