/** Page callbacks only commit while their request generation still owns the view. */
export interface PageRequestOwner {
  generation: () => number;
  busy: () => boolean;
  setBusy: (value: boolean) => void;
  signal: () => AbortSignal;
  cancelFocus: () => void;
  settleFocus: () => void;
  fail: (error: unknown) => void;
}
