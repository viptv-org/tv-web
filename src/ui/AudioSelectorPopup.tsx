import React, { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";

export interface TrackChoice {
  id: string;
  label: string;
  language?: string;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}

interface AudioSelectorPopupProps {
  title: string;
  tracks: TrackChoice[];
  onClose: () => void;
  offOption?: {
    selected: boolean;
    onSelect: () => void;
  };
}

export function AudioSelectorPopup({
  title,
  tracks,
  onClose,
  offOption,
}: AudioSelectorPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="audio-selector-popup"
      role="dialog"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="audio-selector-header">
        <span className="audio-selector-title">{title}</span>
        <button
          type="button"
          className="audio-selector-close"
          aria-label="Close"
          onClick={onClose}
          tabIndex={-1}
        >
          <X size={16} />
        </button>
      </div>

      <div className="audio-selector-list">
        {offOption && (
          <button
            type="button"
            className={`audio-selector-item ${offOption.selected ? "is-selected" : ""}`}
            onClick={() => {
              offOption.onSelect();
              onClose();
            }}
            tabIndex={-1}
          >
            <span className="track-label">Off</span>
            {offOption.selected && (
              <span className="track-check">
                <Check size={16} />
              </span>
            )}
          </button>
        )}

        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            disabled={!track.available}
            className={`audio-selector-item ${track.selected ? "is-selected" : ""} ${!track.available ? "is-disabled" : ""}`}
            onClick={() => {
              if (track.available) {
                track.onSelect();
                onClose();
              }
            }}
            tabIndex={-1}
          >
            <span className="track-label">
              {track.label}
              {!track.available && <small className="track-unavailable"> (unavailable)</small>}
            </span>
            {track.selected && (
              <span className="track-check">
                <Check size={16} />
              </span>
            )}
          </button>
        ))}

        {tracks.length === 0 && !offOption && (
          <div className="audio-selector-empty">No tracks available</div>
        )}
      </div>
    </div>
  );
}
