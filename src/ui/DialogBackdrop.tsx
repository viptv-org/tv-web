import { useRef, type ReactNode } from "react";

/** Only a gesture on the backdrop cancels; dialog content owns its clicks. */
export function DialogBackdrop({ children, onCancel }: {
  children: ReactNode;
  onCancel: () => void;
}) {
  const startedInside = useRef(false);
  return (
    <div
      className="scrim dialog-backdrop"
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
            el.getAttribute("aria-hidden") !== "true",
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
        startedInside.current = event.target !== event.currentTarget;
      }}
      onClick={(event) => {
        const dismiss = event.target === event.currentTarget && !startedInside.current;
        startedInside.current = false;
        if (dismiss) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      {children}
    </div>
  );
}
