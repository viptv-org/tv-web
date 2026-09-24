import type { MouseEvent, ReactNode, SyntheticEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isDesktopShell } from "./app/appShared";

// The Watch on TV glyph lives with the rails; re-exported for existing importers.
export { RemoteControlIcon } from "./ShellNav";

interface DesktopTitlebarProps {
  /** "pairing": wordmark and window controls only (sign-in, profiles). */
  variant?: "app" | "pairing";
  canGoBack?: boolean;
  canGoForward?: boolean;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  /** Centred on the window regardless of the side groups (the search field). */
  center?: ReactNode;
}

async function minimize() {
  try {
    await invoke("app_window_minimize");
  } catch {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (err) {
      console.warn("Minimize unavailable:", err);
    }
  }
}

async function toggleMaximize() {
  try {
    await invoke("app_window_toggle_maximize");
  } catch {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch (err) {
      console.warn("Maximize unavailable:", err);
    }
  }
}

async function close() {
  try {
    await invoke("app_window_close");
  } catch {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (err) {
      console.warn("Close unavailable:", err);
    }
  }
}

async function startDragging(event: MouseEvent) {
  if (event.button !== 0) return;
  try {
    await invoke("app_window_start_dragging");
  } catch {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {
      // Ignored when not running under the Tauri window drag provider.
    }
  }
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Props for a title-bar button: no drag, no lingering focus from a click. */
const barButton = (action: () => void) => ({
  type: "button" as const,
  tabIndex: -1,
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    event.currentTarget.blur();
  },
  onPointerDown: stop,
  onClick: (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    event.currentTarget.blur();
    action();
  },
});

/**
 * Frameless Tauri window header (40 px + hairline; reference DeskHome, and
 * the "Title bar" section of CmpDesk2): the V tile and VIPTV wordmark,
 * Back / Forward, the search field centred on the window, and the window
 * controls. The pairing variant (sign-in, profiles) keeps only the wordmark
 * and window controls. The shell hides the bar in the fullscreen player.
 * Everything that is not a control drags the window; double-click toggles
 * maximize.
 */
export function DesktopTitlebar({
  variant = "app",
  canGoBack = false,
  canGoForward = false,
  onNavigateBack,
  onNavigateForward,
  center,
}: DesktopTitlebarProps) {
  return (
    <header
      className="vx-titlebar desktop-titlebar"
      data-tauri-drag-region
      onMouseDown={startDragging}
      onDoubleClick={() => void toggleMaximize()}
    >
      <div className="vx-titlebar-start" data-tauri-drag-region>
        <span className="vx-titlebar-brand" data-tauri-drag-region aria-label="VIPTV" role="img">
          <span className="vx-titlebar-mark" aria-hidden="true">V</span>
          <span className="vx-titlebar-wordmark viptv-type-desktop-wordmark" aria-hidden="true">VIPTV</span>
        </span>
        {variant === "app" && (
          <>
            <button
              {...barButton(() => onNavigateBack?.())}
              className="vx-titlebar-nav"
              aria-label="Back"
              title="Back"
              disabled={!canGoBack}
              onDoubleClick={stop}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              {...barButton(() => onNavigateForward?.())}
              className="vx-titlebar-nav"
              aria-label="Forward"
              title="Forward"
              disabled={!canGoForward}
              onDoubleClick={stop}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {variant === "app" && center && (
        <div className="vx-titlebar-center" onMouseDown={stop} onPointerDown={stop} onDoubleClick={stop}>
          {center}
        </div>
      )}

      {isDesktopShell && (
        <div className="vx-titlebar-controls" onMouseDown={stop} onPointerDown={stop} onDoubleClick={stop}>
          <button {...barButton(() => void minimize())} className="vx-titlebar-control" aria-label="Minimize" title="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <button {...barButton(() => void toggleMaximize())} className="vx-titlebar-control" aria-label="Maximize" title="Maximize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          </button>
          <button {...barButton(() => void close())} className="vx-titlebar-control" aria-label="Close" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
