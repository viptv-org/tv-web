/*
 * Dialogs family: how the generic modal (AppDialogs) reads a setModal request.
 * Shared by the renderer and by useDialogs' focus entry so both agree on which
 * choice is current, which one dismisses, and where focus lands.
 */
import type { Choice } from "./appShared";

/** The loose view hint another family may attach (title family's ModalView). */
export type ModalViewHint = {
  kind?: "menu" | "choices" | "text" | "dialog";
  anchor?: { x: number; y: number; align?: "start" | "end" };
  meta?: string;
};

export type ModalRequest = {
  title: string;
  choices: Choice[];
  body?: string;
  message?: string;
  focus?: string;
  view?: ModalViewHint;
};

/** Cancel / Close (or an explicit `dismiss`) closes without acting. */
export const isDismissChoice = (choice: Choice) => choice.dismiss ?? /^(Cancel|Close)$/.test(choice.label);

/** The current value: an explicit `current`, else the `focus` label (the value a list opened on). */
export const isCurrentChoice = (modal: ModalRequest, choice: Choice) =>
  choice.current ?? (modal.focus !== undefined && choice.label === modal.focus);

/**
 * "text": long text (TV full-screen panel); "list": choice rows with Current,
 * or a menu when rows carry icons; "actions": stacked buttons (confirmations).
 */
export function modalLayout(modal: ModalRequest): "text" | "list" | "actions" {
  const kind = modal.view?.kind;
  if (modal.body !== undefined || kind === "text") return "text";
  if (kind === "menu" || kind === "choices") return "list";
  if (kind === "dialog") return "actions";
  const rows = modal.choices.filter((choice) => !isDismissChoice(choice));
  return modal.focus !== undefined || rows.length > 3 || rows.some((choice) => choice.current || choice.icon)
    ? "list"
    : "actions";
}

/**
 * Where keyboard / remote focus opens: the requested label, else the current
 * value, else Cancel when an action is destructive (Cancel keeps default focus
 * on desktop and TV), else the first choice.
 */
export function initialChoiceIndex(modal: ModalRequest): number {
  const byLabel = modal.focus !== undefined ? modal.choices.findIndex((choice) => choice.label === modal.focus) : -1;
  if (byLabel >= 0) return byLabel;
  const current = modal.choices.findIndex((choice) => choice.current);
  if (current >= 0) return current;
  if (modal.choices.some((choice) => choice.tone === "destructive")) {
    const cancel = modal.choices.findIndex(isDismissChoice);
    if (cancel >= 0) return cancel;
  }
  return 0;
}
