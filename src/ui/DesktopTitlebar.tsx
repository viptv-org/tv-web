import { invoke } from "@tauri-apps/api/core";
import type { TvProfile } from "../api";
import { avatarUrl } from "./ProfileEditor";
import { TvButton } from "./remote";

export function RemoteControlIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6.5" y="2" width="11" height="20" rx="3.5" />
      <circle cx="12" cy="6.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="10.5" r="0.75" fill="currentColor" />
      <circle cx="14.5" cy="10.5" r="0.75" fill="currentColor" />
      <circle cx="9.5" cy="13.5" r="0.75" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="0.75" fill="currentColor" />
      <rect x="9.5" y="16.5" width="5" height="2.5" rx="1" stroke="currentColor" fill="none" />
    </svg>
  );
}

interface DesktopTitlebarProps {
  screen?: string;
  activeProfile?: TvProfile;
  canGoBack?: boolean;
  onNavigateBack?: () => void;
  onNavigateSearch: () => void;
  onNavigateBookmarks: () => void;
  onOpenProfiles: () => void;
}

export function DesktopTitlebar({
  screen,
  activeProfile,
  canGoBack,
  onNavigateBack,
  onNavigateSearch,
  onNavigateBookmarks,
  onOpenProfiles,
}: DesktopTitlebarProps) {
  const handleMinimize = async () => {
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
  };

  const handleToggleMaximize = async () => {
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
  };

  const handleClose = async () => {
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
  };

  const handleStartDragging = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    try {
      await invoke("app_window_start_dragging");
    } catch {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().startDragging();
      } catch {
        // Ignored when not running under Tauri window drag provider
      }
    }
  };

  const stopDragEvents = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <header
      className="desktop-titlebar responsive-toolbar"
      style={{
        height: "30px",
        minHeight: "30px",
        maxHeight: "30px",
        padding: "0 10px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        className="titlebar-left brand"
        data-tauri-drag-region
        onMouseDown={handleStartDragging}
        onDoubleClick={handleToggleMaximize}
        style={{
          position: "static",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          height: "100%",
          margin: 0,
          padding: 0,
          cursor: "default",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
          alt="viptv"
          className="titlebar-logo"
          style={{
            width: "12px",
            height: "12px",
            maxWidth: "12px",
            maxHeight: "12px",
            objectFit: "contain",
            display: "block",
            position: "static",
            margin: 0,
            padding: 0,
            pointerEvents: "none",
          }}
        />
        <span
          className="titlebar-brand"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#f5f5f5",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          VIPTV
        </span>
        {canGoBack && (
          <button
            type="button"
            className="titlebar-btn titlebar-icon-btn titlebar-back-btn"
            aria-label="Back"
            title="Back"
            tabIndex={-1}
            onMouseDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onPointerDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onClick={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
              onNavigateBack?.();
            }}
            style={{
              width: "20px",
              height: "20px",
              minWidth: "20px",
              minHeight: "20px",
              padding: 0,
              marginLeft: "4px",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>

      <div
        className="titlebar-drag-spacer"
        data-tauri-drag-region
        onMouseDown={handleStartDragging}
        onDoubleClick={handleToggleMaximize}
      />

      <div
        className="titlebar-right"
        onMouseDown={stopDragEvents}
        onPointerDown={stopDragEvents}
      >
        {screen !== "startup" && (
          <>
            <button
              type="button"
              className="titlebar-search-btn"
              aria-label="Search"
              tabIndex={-1}
              onMouseDown={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
              }}
              onPointerDown={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
              }}
              onClick={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
                onNavigateSearch();
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Search</span>
            </button>

            <button
              type="button"
              className="titlebar-btn titlebar-icon-btn"
              aria-label="My List"
              title="My List"
              tabIndex={-1}
              onMouseDown={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
              }}
              onPointerDown={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
              }}
              onClick={(e) => {
                stopDragEvents(e);
                e.currentTarget.blur();
                onNavigateBookmarks();
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>

            {activeProfile && (
              <TvButton
                id="responsive-profile"
                className="titlebar-btn titlebar-avatar-btn"
                aria-label="Switch Profile"
                title="Switch Profile"
                tabIndex={-1}
                onActivate={() => onOpenProfiles()}
                onMouseDown={(e) => {
                  stopDragEvents(e);
                  e.currentTarget.blur();
                }}
                onPointerDown={(e) => {
                  stopDragEvents(e);
                  e.currentTarget.blur();
                }}
                onClick={(e) => {
                  stopDragEvents(e);
                  e.currentTarget.blur();
                  onOpenProfiles();
                }}
              >
                <img
                  src={avatarUrl(activeProfile)}
                  alt=""
                  className="titlebar-avatar-img"
                />
              </TvButton>
            )}
          </>
        )}

        <div
          className="titlebar-window-controls"
          onMouseDown={stopDragEvents}
          onPointerDown={stopDragEvents}
        >
          <button
            type="button"
            className="titlebar-btn titlebar-control-btn btn-minimize"
            aria-label="Minimize"
            title="Minimize"
            tabIndex={-1}
            onMouseDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onPointerDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onClick={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
              void handleMinimize();
            }}
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor">
              <rect width="10" height="2" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="titlebar-btn titlebar-control-btn btn-maximize"
            aria-label="Maximize"
            title="Maximize"
            tabIndex={-1}
            onMouseDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onPointerDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onClick={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
              void handleToggleMaximize();
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          <button
            type="button"
            className="titlebar-btn titlebar-control-btn btn-close"
            aria-label="Close"
            title="Close"
            tabIndex={-1}
            onMouseDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onPointerDown={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
            }}
            onClick={(e) => {
              stopDragEvents(e);
              e.currentTarget.blur();
              void handleClose();
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
