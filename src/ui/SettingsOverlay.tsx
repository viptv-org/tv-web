/*
 * Settings-family overlay layer (Settings, Watch on TV, local mode): the design-system overlay
 * shells (src/ui/primitives/Overlays.tsx) plus the behaviour a modal needs.
 *
 * - Covers the body row only on desktop (under the title bar, right of the rail), the screen on
 *   phone and TV (styles/screens/settings.css .vx-settings-layer).
 * - Focus: enters on `initialFocus` (a data-focus-id inside the layer, re-applied when `focusKey`
 *   changes) or the first control; returns to `returnFocus` (a data-focus-id) or the opener on close. Tab stays inside. The layer is a focus scope for the TV D-pad.
 * - Esc / BACK close it: captured on window before RemoteRoot routes them to the app's Back.
 * - A tap on the scrim closes it; `scrim={false}` (desktop popovers) keeps an invisible catcher.
 * - `anchor`: the popover placement for anchored menus (right-aligned under the control, flipped
 *   above it when it would leave the layer), written to the element marked data-anchored.
 */
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export const isBackKey = (event: { key: string; keyCode: number }) =>
  event.key === "Escape" || event.key === "BrowserBack" || event.keyCode === 10009 || event.keyCode === 461;

function focusables(root: HTMLElement) {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest("[hidden]") && element.getAttribute("aria-hidden") !== "true",
  );
  // Skip controls a platform hides (the phone grabber on desktop, the × disc on phone);
  // without layout (jsdom) every control counts.
  const shown = all.filter((element) => element.getClientRects().length > 0);
  return shown.length ? shown : all;
}

const byFocusId = (root: ParentNode, id: string) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-focus-id]")).find((element) => element.dataset.focusId === id) ?? null;

export function SettingsLayer({
  children,
  onClose,
  initialFocus,
  focusKey,
  scrim = true,
  anchor,
  returnFocus,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  /** data-focus-id of the control that takes focus when the layer opens. */
  initialFocus?: string;
  /** Re-apply the initial focus when this changes (the layer swapped its dialog). */
  focusKey?: string;
  /** false: anchored popover (no dimming; an outside click still closes). */
  scrim?: boolean;
  /** The control an anchored popover belongs to. */
  anchor?: HTMLElement | null;
  /** data-focus-id of the control that gets focus back on close (default: the opener). */
  returnFocus?: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<{ element: HTMLElement | null; id?: string }>({ element: null });
  const close = useRef(onClose);
  close.current = onClose;
  const returnTo = useRef(returnFocus);
  returnTo.current = returnFocus;

  // Remember the opener once; give it focus back when the layer goes away.
  useLayoutEffect(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener.current = { element: active, id: active?.dataset.focusId };
    return () => {
      const { element, id } = opener.current;
      // The named control first (WebKit does not focus clicked buttons, so the opener can be
      // <body>), then the opener itself, then whatever now carries the opener's focus id.
      const named = returnTo.current ? byFocusId(document, returnTo.current) : null;
      const target = named ?? (element?.isConnected && element !== document.body ? element : id ? byFocusId(document, id) : null);
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Anchored popover: right-aligned under its control, above it when there is no room below.
  useLayoutEffect(() => {
    const layer = root.current;
    const popover = layer?.querySelector<HTMLElement>("[data-anchored]");
    if (!layer || !popover || !anchor) return;
    const frame = layer.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    const height = popover.offsetHeight;
    // DeskEngine: the popover's top edge sits 2 px over the row's bottom edge.
    const below = target.bottom - frame.top - 2;
    const top = below + height > frame.height - 8 ? Math.max(8, target.top - frame.top - height + 2) : below;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(Math.max(8, target.right - frame.left - popover.offsetWidth))}px`;
  }, [anchor, focusKey]);

  useLayoutEffect(() => {
    const layer = root.current;
    if (!layer) return;
    const target = (initialFocus && byFocusId(layer, initialFocus)) || focusables(layer)[0];
    target?.focus({ preventScroll: true });
  }, [initialFocus, focusKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isBackKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      close.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const layer = event.currentTarget;
    if (event.key === "Tab") {
      const list = focusables(layer);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey ? active === first || !layer.contains(active) : active === last || !layer.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    // Menus (popovers) move with the arrow keys on desktop; the TV D-pad has its own routing.
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !layer.closest(".tv-layout")) {
      const items = Array.from(layer.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])'));
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || items.length < 2) return;
      event.preventDefault();
      items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    }
  };

  return (
    <div
      ref={root}
      className={["vx-overlay", "vx-overlay--fixed", "vx-settings-layer", scrim ? "" : "vx-settings-layer--popover", className ?? ""].filter(Boolean).join(" ")}
      data-focus-scope="settings"
      onKeyDown={onKeyDown}
    >
      <div className={scrim ? "vx-scrim" : "vx-settings-layer__catcher"} aria-hidden="true" onClick={() => close.current()} />
      {children}
    </div>
  );
}
