import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Action = () => void;
type Registration = { activate: Action; hold?: Action };
export const Registry = createContext<Map<string, Registration> | null>(null);
export function focusElement(id: string, options?: FocusOptions) {
  const element = Array.from(document.querySelectorAll<HTMLElement>("[data-focus-id]"))
    .find((element) => element.dataset.focusId === id);
  if (!element) return;
  // Pointer-first pages retain dialog/input semantics, not remote arrival focus.
  if (element.closest(".responsive-app") && !element.closest("[data-focus-scope]")
    && !element.matches("input, textarea, select, [contenteditable=true]")) return;
  element.focus(options);
}

export function RemoteRoot({
  children,
  onBack,
  onMediaKey,
  onMediaKeyUp,
  onNavigate,
  onToggleFullscreen,
  inputMode = "tv",
}: {
  children: ReactNode;
  inputMode?: "tv" | "responsive";
  onBack?: Action;
  onMediaKey?: (key: string) => boolean;
  onMediaKeyUp?: (key: string) => void;
  onNavigate?: Action;
  onToggleFullscreen?: Action;
}) {
  const registry = useRef(new Map<string, Registration>());
  const handlers = useRef({ onBack, onMediaKey, onMediaKeyUp, onNavigate, onToggleFullscreen });
  handlers.current = { onBack, onMediaKey, onMediaKeyUp, onNavigate, onToggleFullscreen };
  useEffect(() => {
    let lastRepeatedArrow = { key: "", at: 0 };
    let press:
      | { id: string; held: boolean; timer: ReturnType<typeof setTimeout> }
      | undefined;
    const clear = () => {
      if (press) clearTimeout(press.timer);
      press = undefined;
    };
    const down = (event: KeyboardEvent) => {
      const code = event.keyCode;
      const key = normalizeKey(event);
      if (inputMode === "responsive") {
        // Native browser typing/activation remain native. No spatial TV grid,
        // held-Enter menus, or decoder key mappings on pointer-first pages.
        if (key === "Escape") {
          event.preventDefault();
          if (handlers.current.onToggleFullscreen) {
            handlers.current.onToggleFullscreen();
          } else {
            handlers.current.onBack?.();
          }
          return;
        }
        const input =
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          Boolean((event.target as HTMLElement)?.isContentEditable);
        if (!input && (key === " " || key === "Spacebar")) {
          if (handlers.current.onMediaKey?.("MediaPlayPause")) {
            event.preventDefault();
            return;
          }
        }
        return;
      }
      handlers.current.onNavigate?.();
      const input =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;
      if (
        key === "Escape" ||
        key === "BrowserBack" ||
        code === 10009 ||
        code === 461
      ) {
        event.preventDefault();
        clear();
        handlers.current.onBack?.();
        return;
      }
      if (input && !["Enter", "ArrowUp", "ArrowDown"].includes(key)) return;
      if (handlers.current.onMediaKey?.(key || String(code))) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement as HTMLElement | null;
      const id = current?.dataset.focusId;
      if (key === "Enter" || code === 13) {
        event.preventDefault();
        if (press || !id || event.repeat) return;
        const registration = registry.current.get(id);
        if (!registration) return;
        press = {
          id,
          held: false,
          timer: setTimeout(() => {
            if (
              press &&
              registration.hold &&
              document.activeElement === current
            ) {
              press.held = true;
              registration.hold();
            }
          }, 700),
        };
      } else if (
        key === "ContextMenu" ||
        key === "Info" ||
        code === 457 ||
        key === "*"
      ) {
        event.preventDefault();
        clear();
        if (id) registry.current.get(id)?.hold?.();
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)
      ) {
        event.preventDefault();
        clear();
        const now = performance.now();
        if (
          event.repeat &&
          lastRepeatedArrow.key === key &&
          now - lastRepeatedArrow.at < 110
        )
          return;
        lastRepeatedArrow = { key, at: now };
        moveFocus(key, current);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (inputMode === "responsive") return;
      handlers.current.onMediaKeyUp?.(normalizeKey(event));
      if (event.key !== "Enter" && event.keyCode !== 13) return;
      if (press) {
        event.preventDefault();
        const { id, held } = press;
        clear();
        if (
          !held &&
          (document.activeElement as HTMLElement)?.dataset.focusId === id
        )
          registry.current.get(id)?.activate();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [inputMode]);
  return (
    <Registry.Provider value={registry.current}>{children}</Registry.Provider>
  );
}

export function moveFocus(key: string, current: HTMLElement | null) {
  const scope =
    current?.closest("[data-focus-scope]") ??
    document.querySelector("[data-focus-scope]") ??
    document;
  const all = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-focus-id]:not([disabled])"),
  ).filter(
    (e) => !e.closest("[hidden]") && e.getAttribute("aria-hidden") !== "true",
  );
  if (!current || !all.includes(current)) {
    all[0]?.focus();
    return;
  }
  const direction = key.replace("Arrow", "").toLowerCase();
  const explicit = current.getAttribute(`data-nav-${direction}`);
  if (explicit) {
    focusElement(explicit);
    return;
  }
  const rect = current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2,
    cy = rect.top + rect.height / 2;
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  let best: HTMLElement | undefined;
  let score = Infinity;
  for (const candidate of all) {
    if (candidate === current) continue;
    const r = candidate.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const dx = r.left + r.width / 2 - cx,
      dy = r.top + r.height / 2 - cy;
    const ahead = (horizontal ? dx : dy) * sign;
    if (ahead <= 1) continue;
    const cross = Math.abs(horizontal ? dy : dx);
    const next = ahead + cross * 3;
    if (next < score) {
      score = next;
      best = candidate;
    }
  }
  // A container can name its entry control (data-focus-entry): arriving from
  // outside lands there instead of on the nearest child (the TV rail enters
  // on the current destination).
  const entry = best?.closest<HTMLElement>("[data-focus-entry]");
  if (best && entry && !entry.contains(current)) {
    const target = entry.dataset.focusEntry;
    const landing = target ? all.find((element) => element.dataset.focusId === target) : undefined;
    if (landing && entry.contains(landing)) {
      landing.focus();
      return;
    }
  }
  best?.focus();
}

type TvButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "id"
> & { id: string; onActivate: Action; onHold?: Action; children: ReactNode };
export function TvButton({
  id,
  onActivate,
  onHold,
  children,
  onFocus,
  ...rest
}: TvButtonProps) {
  const registry = useContext(Registry);
  const action = useRef({ activate: onActivate, hold: onHold });
  action.current = { activate: onActivate, hold: onHold };
  useLayoutEffect(() => {
    registry?.set(id, {
      activate: () => action.current.activate(),
      hold: onHold ? () => action.current.hold?.() : undefined,
    });
    return () => {
      registry?.delete(id);
    };
  }, [id, registry, !!onHold]);
  return (
    <button
      {...rest}
      data-focus-id={id}
      onClick={rest.onClick ?? onActivate}
      onContextMenu={(event) => {
        if (onHold) {
          event.preventDefault();
          onHold();
        }
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.currentTarget.closest(".responsive-app")) revealFocusedControl(event.currentTarget);
      }}
    >
      {children}
    </button>
  );
}

/** Reveal inside the TV's scroll viewports without scrolling its fixed canvas. */
function revealFocusedControl(element: HTMLElement) {
  requestAnimationFrame(() => {
    if (!element.isConnected || document.activeElement !== element) return;
    for (
      let parent = element.parentElement;
      parent && (!parent.classList.contains("tv-screen") || parent.classList.contains("responsive-app"));
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const target = element.getBoundingClientRect();
      const scaleX = rect.width / (parent.offsetWidth || rect.width);
      const scaleY = rect.height / (parent.offsetHeight || rect.height);
      if (
        ["auto", "scroll", "hidden"].includes(style.overflowX) &&
        parent.scrollWidth > parent.clientWidth
      ) {
        if (parent.classList.contains("cards")) {
          if (target.left < rect.left || target.right > rect.right) {
            const anchor = target.left < rect.left ? 0.33 : 0.67;
            const desired = Math.max(
              0,
              (element.closest(".responsive-app")
                ? parent.scrollLeft + (target.left - rect.left) / scaleX
                : element.offsetLeft) +
                element.offsetWidth / 2 -
                parent.clientWidth * anchor,
            );
            try {
              parent.scrollTo({ left: desired, behavior: "smooth" });
            } catch {
              parent.scrollLeft = desired;
            }
          }
        } else if (target.left < rect.left)
          parent.scrollLeft += (target.left - rect.left) / scaleX;
        else if (target.right > rect.right)
          parent.scrollLeft += (target.right - rect.right) / scaleX;
      }
      if (
        ["auto", "scroll", "hidden"].includes(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight
      ) {
        const section = element.closest("section");
        const headroom = parseFloat(getComputedStyle(element).getPropertyValue(
          element.closest(".responsive-app") ? "--viptv-space-2" : "--viptv-space-3",
        ));
        if (
          parent.classList.contains("shelves") &&
          section?.parentElement === parent
        ) {
          try {
            parent.scrollTo({
              top: (section as HTMLElement).offsetTop - headroom,
              behavior: "smooth",
            });
          } catch {
            parent.scrollTop = (section as HTMLElement).offsetTop - headroom;
          }
        } else if (target.top < rect.top)
          parent.scrollTop += (target.top - rect.top) / scaleY;
        else if (target.bottom > rect.bottom)
          parent.scrollTop += (target.bottom - rect.bottom) / scaleY;
      }
      if (parent.classList.contains("responsive-app")) break;
    }
  });
}

function normalizeKey(event: KeyboardEvent) {
  const known: Record<number, string> = {
    415: "MediaPlay",
    19: "MediaPause",
    10252: "MediaPlayPause",
    412: "MediaRewind",
    417: "MediaFastForward",
    413: "MediaStop",
    457: "Info",
    10233: "MediaTrackPrevious",
  };
  return known[event.keyCode] ?? event.key;
}
