import initialize, { normalize } from '../../vendor/core/wasm/viptv_core';

let initialized: Promise<void> | undefined;
/** Load the exact vendored Rust artifact before any API normalization runs. */
export function initializeCore(bytes?: Uint8Array): Promise<void> {
  initialized ??= initialize(bytes).then(() => undefined);
  return initialized;
}

/** Domain interpretation lives in Rust; this wrapper only crosses the ABI. */
export function normalizeCore<T>(kind: string, value: unknown, origin = ''): T {
  return JSON.parse(normalize(kind, JSON.stringify(value), origin)) as T;
}
