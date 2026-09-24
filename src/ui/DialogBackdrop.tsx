import { useRef, type ReactNode } from "react";

/**
 * The overlay layer every app dialog sits in (src/styles/screens/dialogs.css):
 * absolute over the TV canvas; on phone / desktop fixed over the body row
 * (under the desktop title bar, right of the rail when one is shown), so the
 * title bar and rail stay bright. The scrim is the primitive `.vx-scrim`
 * (P 0.62, D 0.55, T 0.6); `scrim="clear"` keeps the layer (outside clicks,
 * Tab trap) without dimming, for an anchored popover.
 *
 * Only a gesture on the backdrop (the layer or its scrim) cancels; dialog
 * content owns its clicks. Tab stays inside the layer while it is open.
 */
export function DialogBackdrop({ children, onCancel, scrim = "default", scope, className }: {
  children: ReactNode;
  onCancel: () => void;
  /** "fullscreen": TV 0.94 cover (text panel); "clear": no dimming (popover). */
  scrim?: "default" | "fullscreen" | "clear";
  /** data-focus-scope for the whole layer (when the dialog markup cannot carry it). */
  scope?: string;
  className?: string;
}) {
  const startedInside = useRef(false);
  const scrimRef = useRef<HTMLDivElement>(null);
  const outside = (target: EventTarget, layer: EventTarget) =>
    target === layer || target === scrimRef.current;
  return (
    <div
      className={["vx-overlay", "vx-dialog-layer", "dialog-backdrop", className].filter(Boolean).join(" ")}
      data-focus-scope={scope}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        // Keep Tab inside the dialog while it is open: focusable UI behind
        // the scrim stays out of reach.
        const focusables = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) =>
            !el.closest("[hidden]") &&
            el.getAttribute("aria-hidden") !== "true" &&
            // Skip controls a platform hides (the phone grabber on desktop,
            // the desktop close disc on phones).
            getComputedStyle(el).display !== "none",
        );
        if (focusables.length === 0) return;
        const active = document.activeElement;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (active === first || !event.currentTarget.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !event.currentTarget.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }}
      onPointerDown={(event) => {
        startedInside.current = !outside(event.target, event.currentTarget);
      }}
      onClick={(event) => {
        const dismiss = outside(event.target, event.currentTarget) && !startedInside.current;
        startedInside.current = false;
        if (dismiss) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        ref={scrimRef}
        className={["vx-scrim", scrim === "fullscreen" && "vx-scrim--fullscreen", scrim === "clear" && "vx-scrim--clear"].filter(Boolean).join(" ")}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
