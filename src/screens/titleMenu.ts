/*
 * Where the title family's desktop popovers open (the generic modal renders
 * them from `view.anchor`, src/ui/app/AppDialogs.tsx): the title menu at a
 * fresh right-click / long-press, else under its ⋯ invoker (DeskItemMenu);
 * the Source provider list under its dropdown (DeskSourceProvider).
 */
import type { ModalView } from "../ui/app/appShared";

let lastContextMenu: { x: number; y: number; at: number } | undefined;
if (typeof window !== "undefined") {
  window.addEventListener(
    "contextmenu",
    (event) => {
      lastContextMenu = { x: event.clientX, y: event.clientY, at: Date.now() };
    },
    true,
  );
}

/** A popover under an element: left-aligned, or right-aligned to it ("end"). */
export function anchorBelow(element: Element | null | undefined, align: "start" | "end" = "start"): ModalView["anchor"] {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return undefined;
  // DeskSourceProvider.html: the popover sits 8 px under its control.
  const gap = 8;
  return align === "end"
    ? { x: rect.right, y: rect.bottom + gap, align: "end" }
    : { x: rect.left, y: rect.bottom + gap, align: "start" };
}

/** The title menu's anchor: a right-click from the last 600 ms, else the focused invoker (⋯). */
export function menuAnchor(): ModalView["anchor"] {
  if (lastContextMenu && Date.now() - lastContextMenu.at < 600) {
    const { x, y } = lastContextMenu;
    lastContextMenu = undefined;
    return { x, y, align: "start" };
  }
  const active = document.activeElement;
  return active && active !== document.body ? anchorBelow(active) : undefined;
}
