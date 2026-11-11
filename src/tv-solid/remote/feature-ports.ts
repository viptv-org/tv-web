import type { Overlay } from "./app-types";

/** Requests inherit the active application scope at invocation time. */
export type ScopedRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export interface DialogActions {
  open: (value: Overlay, nested?: boolean) => void;
  close: () => void;
  dismiss: () => void;
}
export type TextPrompt = (
  title: string, submit: (value: string) => Promise<void>, initial?: string, secret?: boolean,
) => void;
