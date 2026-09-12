import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Action = () => void;
type Registration = { activate: Action; hold?: Action };
const Registry = createContext<Map<string, Registration> | null>(null);
export const focusElement = (id: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-focus-id]"))
    .find((element) => element.dataset.focusId === id)
    ?.focus();

export function RemoteRoot({
  children,
  onBack,
  onMediaKey,
  onMediaKeyUp,
  onNavigate,
}: {
  children: ReactNode;
  onBack?: Action;
  onMediaKey?: (key: string) => boolean;
  onMediaKeyUp?: (key: string) => void;
  onNavigate?: Action;
}) {
  const registry = useRef(new Map<string, Registration>());
  const handlers = useRef({ onBack, onMediaKey, onMediaKeyUp, onNavigate });
  handlers.current = { onBack, onMediaKey, onMediaKeyUp, onNavigate };
  useEffect(() => {
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
        handlers.current.onNavigate?.();
        moveFocus(key, current);
      }
    };
    const up = (event: KeyboardEvent) => {
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
  }, []);
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
  best?.focus();
}

type TvButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "id" | "onClick"
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
  useEffect(() => {
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
      onClick={onActivate}
      onContextMenu={(event) => {
        if (onHold) {
          event.preventDefault();
          onHold();
        }
      }}
      onFocus={(event) => {
        event.currentTarget.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
        });
        onFocus?.(event);
      }}
    >
      {children}
    </button>
  );
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
