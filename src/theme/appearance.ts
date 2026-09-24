import { useSyncExternalStore } from "react";

/**
 * Device appearance settings: OLED black and the accent colour.
 *
 * Both are per-device (localStorage) and are reflected on <html> so the
 * generated tokens pick them up everywhere, portals included:
 * - `data-oled` (present when on) → `:root[data-oled]` swaps --viptv-color-bg to black.
 * - `data-accent="gold|coral|mint|periwinkle"` → `:root[data-accent=…]` sets --viptv-accent.
 */
export const ACCENTS = ["gold", "coral", "mint", "periwinkle"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "gold";

export interface Appearance {
  readonly oled: boolean;
  readonly accent: Accent;
}

/** Storage keys. The OLED key predates the design system; keep it stable. */
export const OLED_STORAGE_KEY = "viptv:appearance:oled";
export const ACCENT_STORAGE_KEY = "viptv:appearance:accent";

const isAccent = (value: unknown): value is Accent =>
  typeof value === "string" && (ACCENTS as readonly string[]).includes(value);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Appearance remains usable for this session without storage. */
  }
}

/** Reads the stored device appearance (defaults: OLED off, gold accent). */
export function readAppearance(): Appearance {
  const accent = readStorage(ACCENT_STORAGE_KEY);
  return {
    oled: readStorage(OLED_STORAGE_KEY) === "true",
    accent: isAccent(accent) ? accent : DEFAULT_ACCENT,
  };
}

/** Reflects an appearance on the document root. */
export function applyAppearance(appearance: Appearance, root: HTMLElement = document.documentElement) {
  if (appearance.oled) root.setAttribute("data-oled", "");
  else root.removeAttribute("data-oled");
  root.setAttribute("data-accent", appearance.accent);
}

let current: Appearance | null = null;
const listeners = new Set<() => void>();

function commit(next: Appearance) {
  current = next;
  if (typeof document !== "undefined") applyAppearance(next);
  listeners.forEach((listener) => listener());
}

/** The current appearance (read from storage on first use). */
export function getAppearance(): Appearance {
  if (!current) current = readAppearance();
  return current;
}

export function setOled(oled: boolean) {
  writeStorage(OLED_STORAGE_KEY, String(oled));
  commit({ ...getAppearance(), oled });
}

export function toggleOled() {
  setOled(!getAppearance().oled);
}

export function setAccent(accent: Accent) {
  const next = isAccent(accent) ? accent : DEFAULT_ACCENT;
  writeStorage(ACCENT_STORAGE_KEY, next);
  commit({ ...getAppearance(), accent: next });
}

export function subscribeAppearance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let initialized = false;
/**
 * Applies the stored appearance to <html> and follows changes made in other
 * windows of the same origin. Call once at startup, before the first render.
 */
export function initAppearance() {
  commit(readAppearance());
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === OLED_STORAGE_KEY || event.key === ACCENT_STORAGE_KEY) {
      commit(readAppearance());
    }
  });
}

/** Live appearance for React (Settings) plus its setters. */
export function useAppearance() {
  const appearance = useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance);
  return { ...appearance, setOled, toggleOled, setAccent };
}
