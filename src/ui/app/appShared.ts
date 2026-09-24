import { isTauriRuntime, resolveTauriVideoInvoker } from "@viptv/video";
import type {
  Catalog,
  MediaItem,
  MediaSource,
  PlaybackPreferences,
} from "../../api";
import type { Screen } from "../screens";
import type { SettingsSubpage } from "../browserNavigation";

export type Choice = { label: string; action: () => void };
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
