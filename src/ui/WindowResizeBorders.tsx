import React, { useEffect, useState } from "react";

interface WindowResizeBordersProps {
  disabled?: boolean;
}

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
    e: React.PointerEvent
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
    <div className="window-resize-borders" aria-hidden="true">
      <div
        className="resize-edge resize-top"
        onPointerDown={(e) => startResize("North", e)}
      />
      <div
        className="resize-edge resize-bottom"
        onPointerDown={(e) => startResize("South", e)}
      />
      <div
        className="resize-edge resize-left"
        onPointerDown={(e) => startResize("West", e)}
      />
      <div
        className="resize-edge resize-right"
        onPointerDown={(e) => startResize("East", e)}
      />
      <div
        className="resize-corner resize-top-left"
        onPointerDown={(e) => startResize("NorthWest", e)}
      />
      <div
        className="resize-corner resize-top-right"
        onPointerDown={(e) => startResize("NorthEast", e)}
      />
      <div
        className="resize-corner resize-bottom-left"
        onPointerDown={(e) => startResize("SouthWest", e)}
      />
      <div
        className="resize-corner resize-bottom-right"
        onPointerDown={(e) => startResize("SouthEast", e)}
      />
    </div>
  );
}
