/** Opt-in browser focus marker for remote timing and preview assertions. */
const enabled = new URLSearchParams(location.search).get("focusdebug") === "1";
export function noteFocus(view: string, index: number) {
  if (!enabled) return;
  (window as Window & { __viptvFocus?: { view: string; index: number; at: number } }).__viptvFocus = {
    view, index, at: performance.now(),
  };
}
