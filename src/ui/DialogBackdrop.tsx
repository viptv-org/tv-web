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
