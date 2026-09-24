import { forwardRef, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { ChoiceContent } from "../../ui/primitives/Toggles";

export interface TrackChoice {
  id: string;
  label: string;
  language?: string;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}

interface PlayerPopupProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Owner placement (desktop: centred over its button, clamped to the controls). */
  style?: CSSProperties;
  className?: string;
}

/**
 * The pointer/touch player's popup card (components.md §10 "Track popups"):
 * phone full width above the timeline, desktop 340 wide above its button,
 * clear of the timeline. Dismisses on an outside press or Escape; the tool
 * button that owns it (aria-expanded) toggles it itself.
 */
export const PlayerPopup = forwardRef<HTMLElement, PlayerPopupProps>(function PlayerPopup(
  { title, onClose, children, style, className },
  forwarded,
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!containerRef.current || containerRef.current.contains(target)) return;
      // The owning tool button toggles the popup on its own click.
      if (target?.closest?.('[aria-expanded="true"]')) return;
      close.current();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <section
      ref={(element) => {
        containerRef.current = element;
        if (typeof forwarded === "function") forwarded(element);
        else if (forwarded) forwarded.current = element;
      }}
      className={className ? `vx-player__popup ${className}` : "vx-player__popup"}
      role="dialog"
      aria-label={title}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="vx-player__popup-header">
        <h2 className="vx-player__popup-title">{title}</h2>
        <button type="button" className="vx-close vx-player__popup-close" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={2.2} />
        </button>
      </div>
      {children}
    </section>
  );
});

interface AudioSelectorPopupProps {
  title: string;
  tracks: TrackChoice[];
  onClose: () => void;
  offOption?: {
    selected: boolean;
    onSelect: () => void;
  };
  style?: CSSProperties;
}

/**
 * Track selector (Audio Tracks / Subtitles): the current track carries a
 * check and "Current"; an unavailable track reads "(unavailable)" and cannot
 * be chosen. Choosing a track closes the popup.
 */
export const AudioSelectorPopup = forwardRef<HTMLElement, AudioSelectorPopupProps>(function AudioSelectorPopup(
  { title, tracks, onClose, offOption, style },
  ref,
) {
  const check = <Check aria-hidden="true" strokeWidth={2.4} />;
  return (
    <PlayerPopup ref={ref} title={title} onClose={onClose} style={style}>
      <div className="vx-choice-list vx-player__tracks" role="group" aria-label={title}>
        {offOption && (
          <button
            type="button"
            className="vx-choice"
            aria-current={offOption.selected ? "true" : undefined}
            aria-label={offOption.selected ? "Off (current)" : "Off"}
            onClick={() => {
              offOption.onSelect();
              onClose();
            }}
          >
            <ChoiceContent current={offOption.selected} checkIcon={check}>Off</ChoiceContent>
          </button>
        )}
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className="vx-choice"
            disabled={!track.available}
            aria-current={track.selected ? "true" : undefined}
            aria-label={`${track.label}${track.selected ? " (current)" : ""}`}
            onClick={() => {
              if (track.available) {
                track.onSelect();
                onClose();
              }
            }}
          >
            <ChoiceContent current={track.selected} unavailable={!track.available} checkIcon={check}>
              {track.label}
            </ChoiceContent>
          </button>
        ))}
        {tracks.length === 0 && <p className="vx-player__popup-empty">No tracks available</p>}
      </div>
    </PlayerPopup>
  );
});
