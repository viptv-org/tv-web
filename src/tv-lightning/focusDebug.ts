/** Opt-in browser focus marker for remote timing and preview assertions. */
const enabled = new URLSearchParams(location.search).get("focusdebug") === "1";
export function noteFocus(view: string, index: number) {
  if (!enabled) return;
  (window as Window & { __viptvFocus?: { view: string; index: number; at: number } }).__viptvFocus = {
    view, index, at: performance.now(),
  };
}

/** Test-only identity marker; never includes source URLs or credentials. */
export function noteSourceIntent(itemId: string, sourceId: string, position: number, resume: boolean) {
  if (!enabled) return;
  (window as Window & { __viptvSourceIntent?: { itemId: string; sourceId: string; position: number; resume: boolean } }).__viptvSourceIntent = {
    itemId, sourceId, position, resume,
  };
}

/** Test-only filter state for D-pad acceptance; no source URLs or tokens. */
export function noteSourceFilter(quality: string, provider: string, rows: number) {
  if (!enabled) return;
  (window as Window & { __viptvSourceFilter?: { quality: string; provider: string; rows: number } }).__viptvSourceFilter = {
    quality, provider, rows,
  };
}
