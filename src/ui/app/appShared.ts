import { isTauriRuntime, resolveTauriVideoInvoker } from "@viptv/video";
import type {
  Catalog,
  MediaItem,
  MediaSource,
  PlaybackPreferences,
} from "../../api";
import type { Screen } from "../screens";
import type { SettingsSubpage } from "../browserNavigation";
import type { ReactNode } from "react";

export type Choice = {
  label: string;
  action: () => void;
  /** Leading icon (title menu rows; TV hides it). */
  icon?: ReactNode;
  /** The current value of a choice list ("Current" marker). */
  current?: boolean;
  /**
   * Dialogs family (generic modal, src/ui/app/AppDialogs.tsx; see
   * .redesign/overhaul/dialogs-progress.md). "primary": the one accent
   * button (phone / desktop; TV renders a plain row). "destructive": danger
   * text (Sign out, Remove); Cancel then gets default focus on D and T.
   */
  tone?: "primary" | "destructive";
  /** The dismiss choice (Cancel / Close / Done). Defaults to true for "Cancel" and "Close". */
  dismiss?: boolean;
  /** Second line under a list row's label. */
  note?: string;
  /** Not usable here: tertiary "· unavailable"; the row stays focusable and its action decides. */
  unavailable?: boolean;
};
/** Dialogs family: optional presentation of the generic modal (see Choice). */
export type ModalOptions = {
  /** TV key legend (default: OK Select · BACK <dismiss label>). */
  legend?: { key: string; label: string }[];
  /** Keep the title as the dialog's accessible name only (message-only sheet). */
  hideTitle?: boolean;
  /** Extra class on the dialog / popover element, for a family-scoped modifier. */
  className?: string;
};
/**
 * Optional presentation hint of a modal request (title family; rendered by
 * the generic modal, src/ui/app/AppDialogs.tsx): "menu" = the title menu
 * (icons; desktop anchored popover), "choices" = a value list with "Current"
 * (desktop popover under its control), "text" = long text (TV full-screen
 * text panel), "dialog" = a short confirmation (Removed from Continue Watching).
 */
export type ModalView = {
  kind: "menu" | "choices" | "text" | "dialog";
  /** Desktop popover anchor in viewport px; "end" right-aligns it to x. */
  anchor?: { x: number; y: number; align?: "start" | "end" };
  /** Secondary line under the title (TV More info: year · runtime · genres). */
  meta?: string;
};
export type ScrollAnchor = {
  top: number;
  regions: { id: string; top: number; left: number }[];
};
export type BrowserSnapshot = {
  screen: Screen; subpage?: SettingsSubpage; selected?: MediaItem; items: readonly MediaItem[]; episodes: readonly MediaItem[]; sources: readonly MediaSource[];
  focus: string; scroll?: ScrollAnchor; query: string; season?: number; catalog?: Catalog; catalogValues: Record<string, string>; nextSkip?: number;
};

/** The desktop shell's command channel, present only inside the Tauri runtime. */
export const desktopInvoker = isTauriRuntime() ? resolveTauriVideoInvoker() : undefined;
/** Dev-only preview (`?desktop-shell`): desktop-app chrome in a plain browser
 * for tests/preview. Never true in builds; no Tauri API is invoked for it. */
export const desktopShellPreview = import.meta.env.DEV && !isTauriRuntime()
  && new URLSearchParams(location.search).has("desktop-shell");
/** The native desktop shell gets windowed chrome; the browser fills the tab. */
export const isDesktopShell = isTauriRuntime() || desktopShellPreview;

export function captureScroll(): ScrollAnchor | undefined {
  const root = document.querySelector<HTMLElement>(".responsive-app");
  return root ? { top: root.scrollTop, regions: Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-id]")).map(element => ({ id: element.dataset.scrollId!, top: element.scrollTop, left: element.scrollLeft })) } : undefined;
}

export const initialPrefs: PlaybackPreferences = {
  audioLanguage: "",
  subtitleLanguage: "",
  subtitlesEnabled: false,
  subtitleSize: "normal",
  subtitleStyle: "system",
  quality: "auto",
  autoplay: true,
};
