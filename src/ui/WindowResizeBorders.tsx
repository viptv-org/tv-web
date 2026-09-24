import { useEffect, useState, type PointerEvent } from "react";

interface WindowResizeBordersProps {
  disabled?: boolean;
}

/**
 * Frameless-window resize handles (Wayland has no native border): 6 px edges
 * and 12 px corners around the window, hidden while maximized or fullscreen.
 */
export function WindowResizeBorders({ disabled = false }: WindowResizeBordersProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const checkState = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setIsMaximized(await win.isMaximized());
        });
      } catch {
        // Not running in Tauri window environment
      }
    };
    void checkState();
    return () => {
      unlisten?.();
    };
  }, []);

  if (disabled || isMaximized) return null;

  const startResize = async (
    direction: "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West",
    e: PointerEvent
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startResizeDragging(direction);
    } catch {
      // Ignored if unavailable
    }
  };

  return (
    <div className="vx-shell-resize" aria-hidden="true">
      <div
        className="vx-shell-resize-edge vx-shell-resize--top"
        onPointerDown={(e) => startResize("North", e)}
      />
      <div
        className="vx-shell-resize-edge vx-shell-resize--bottom"
        onPointerDown={(e) => startResize("South", e)}
      />
      <div
        className="vx-shell-resize-edge vx-shell-resize--left"
        onPointerDown={(e) => startResize("West", e)}
      />
      <div
        className="vx-shell-resize-edge vx-shell-resize--right"
        onPointerDown={(e) => startResize("East", e)}
      />
      <div
        className="vx-shell-resize-corner vx-shell-resize--top-left"
        onPointerDown={(e) => startResize("NorthWest", e)}
      />
      <div
        className="vx-shell-resize-corner vx-shell-resize--top-right"
        onPointerDown={(e) => startResize("NorthEast", e)}
      />
      <div
        className="vx-shell-resize-corner vx-shell-resize--bottom-left"
        onPointerDown={(e) => startResize("SouthWest", e)}
      />
      <div
        className="vx-shell-resize-corner vx-shell-resize--bottom-right"
        onPointerDown={(e) => startResize("SouthEast", e)}
      />
    </div>
  );
}
