import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Registry } from "./remote";

export type SeekIntent = "click" | "drag" | "keyboard";
export type BufferedRange = { start: number; end: number };

/** Playback clock: h:mm:ss once hours exist, m:ss below an hour. */
export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const clock = `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** Share of the track a position maps to, clamped to the drawn bar. */
export function timelineRatio(position: number, duration: number | null): number {
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(position) || position <= 0) return 0;
  return Math.min(1, position / duration);
}

/** Seconds at a share of the track, clamped to the playable window. */
export function secondsAtRatio(ratio: number, duration: number | null): number {
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(1, ratio) * duration;
}

/** Seconds under a pointer x inside the track box. */
export function secondsFromPointer(x: number, left: number, width: number, duration: number | null): number {
  if (!Number.isFinite(x) || !Number.isFinite(left) || width <= 0) return 0;
  return secondsAtRatio((x - left) / width, duration);
}

/** A press that travels past the slop is a drag; a still press is a click. */
export function pointerSeekIntent(traveled: number): SeekIntent {
  return traveled > SEEK_SLOP ? "drag" : "click";
}

/** A pinned seek target stays displayed until playback lands on it. */
export function seekPinReleased(
  target: number,
  position: number,
  state: string,
): boolean {
  if (["error", "stopped", "ended", "disposed", "idle"].includes(state))
    return true;
  return state === "playing" && position >= target - 0.75;
}


const SEEK_SLOP = 6;
const KEYBOARD_STEP_SECONDS = 10;
/** Idle window after a keyboard nudge before it commits, matching the remote. */
const KEYBOARD_COMMIT_DELAY = 800;
const BUFFER_POLL_MILLISECONDS = 500;

const sameRanges = (
  a: readonly BufferedRange[] | undefined,
  b: readonly BufferedRange[] | undefined,
) =>
  a === b ||
  (!!a &&
    !!b &&
    a.length === b.length &&
    a.every((range, i) => range.start === b[i].start && range.end === b[i].end));

export function SeekBar({
  id,
  position,
  duration,
  preview,
  onPreview,
  onSeek,
  onActivate,
  onActivity,
  getBufferedRanges,
  remoteKeys = false,
}: {
  id: string;
  position: number;
  duration: number | null;
  /** Pending seek shown in place of the live position (remote nudges, drags). */
  preview: number | undefined;
  onPreview(seconds: number | undefined): void;
  onSeek(seconds: number, intent: SeekIntent): void;
  /** Remote OK on the focused bar, matching every other control. */
  onActivate(): void;
  /** Pointer interest that should hold the player overlay open. */
  onActivity?(): void;
  getBufferedRanges?(): readonly BufferedRange[] | null;
  /** True when the app's remote key layer owns arrows/OK for the focused bar. */
  remoteKeys?: boolean;
}) {
  const registry = useContext(Registry);
  const activate = useRef(onActivate);
  activate.current = onActivate;
  useLayoutEffect(() => {
    registry?.set(id, { activate: () => activate.current() });
    return () => {
      registry?.delete(id);
    };
  }, [id, registry]);

  const bar = useRef<HTMLDivElement>(null);
  const [hoverSeconds, setHoverSeconds] = useState<number>();
  const [scrub, setScrub] = useState<number>();
  const [focused, setFocused] = useState(false);
  const [buffered, setBuffered] = useState<readonly BufferedRange[]>();
  // Live drag state lives in a ref: capture/cancel dispatch order must not
  // depend on React's render timing to know whether a scrub is still active.
  const drag = useRef<{ originX: number; seconds: number }>();
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const readBuffered = useRef(getBufferedRanges);
  readBuffered.current = getBufferedRanges;
  // Timer callbacks fire long after the render that created them; keep the
  // latest dispatchers so a deferred commit cannot use a stale closure.
  const handlers = useRef({ onPreview, onSeek });
  handlers.current = { onPreview, onSeek };
  const pendingPreview = useRef(preview);
  pendingPreview.current = preview;
  const keyboardPending = useRef<number>();
  const keyboardTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(keyboardTimer.current), []);

  // The HTML media element is the only buffer source; callers pass null when
  // the active engine cannot report ranges, and no layer is drawn (never faked).
  useEffect(() => {
    const read = () => {
      const ranges = readBuffered.current?.() ?? null;
      const next = ranges && ranges.length ? ranges : undefined;
      setBuffered((previous) => (sameRanges(previous, next) ? previous : next));
    };
    read();
    const poll = setInterval(read, BUFFER_POLL_MILLISECONDS);
    return () => clearInterval(poll);
  }, []);

  const seekable = duration !== null && Number.isFinite(duration) && duration > 0;
  const displayed =
    scrub !== undefined && Number.isFinite(scrub)
      ? scrub
      : preview !== undefined && Number.isFinite(preview)
        ? preview
        : position;
  const played = timelineRatio(displayed, duration);
  const secondsAtClientX = (clientX: number) => {
    // getBoundingClientRect is scale-aware, so the TV canvas transform works.
    const rect = bar.current?.getBoundingClientRect();
    return rect ? secondsFromPointer(clientX, rect.left, rect.width, duration) : 0;
  };

  const endScrub = (seconds: number, intent: SeekIntent) => {
    drag.current = undefined;
    setScrub(undefined);
    setHoverSeconds(undefined);
    handlers.current.onPreview(undefined);
    handlers.current.onSeek(seconds, intent);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    // Suppress text selection and the trailing compatibility click; the bar
    // commits on pointer release itself.
    event.preventDefault();
    activity.current?.();
    bar.current?.focus({ preventScroll: true });
    // Capture keeps the drag reporting while the pointer travels off the bar.
    if (typeof event.pointerId === "number" && event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* Best effort: releases are still observed without the capture. */
      }
    }
    const seconds = secondsAtClientX(event.clientX);
    drag.current = { originX: event.clientX, seconds };
    setScrub(seconds);
    setHoverSeconds(undefined);
    handlers.current.onPreview(seconds);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    const seconds = secondsAtClientX(event.clientX);
    if (drag.current) {
      drag.current.seconds = seconds;
      setScrub(seconds);
      handlers.current.onPreview(seconds);
      return;
    }
    activity.current?.();
    if (event.pointerType !== "touch") setHoverSeconds(seconds);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active) return;
    endScrub(
      secondsAtClientX(event.clientX),
      pointerSeekIntent(Math.abs(event.clientX - active.originX)),
    );
  };

  const onPointerCancel = () => {
    const active = drag.current;
    if (active) endScrub(active.seconds, "drag");
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current && event.pointerType !== "touch") setHoverSeconds(undefined);
  };

  const commitKeyboard = () => {
    const value = keyboardPending.current ?? pendingPreview.current;
    if (value === undefined) return;
    keyboardPending.current = undefined;
    handlers.current.onPreview(undefined);
    handlers.current.onSeek(value, "keyboard");
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // TV input routes arrows/OK through the app's remote key layer already;
    // handling them here too would seek twice per press.
    if (remoteKeys || !seekable) return;
    const current = keyboardPending.current ?? pendingPreview.current ?? position;
    let target: number;
    if (event.key === "ArrowLeft") target = current - KEYBOARD_STEP_SECONDS;
    else if (event.key === "ArrowRight") target = current + KEYBOARD_STEP_SECONDS;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = duration ?? 0;
    else if (event.key === "Enter") {
      event.preventDefault();
      if (pendingPreview.current !== undefined) commitKeyboard();
      else onActivate();
      return;
    } else return;
    event.preventDefault();
    const value = Math.max(0, Math.min(duration ?? 0, target));
    keyboardPending.current = value;
    handlers.current.onPreview(value);
    clearTimeout(keyboardTimer.current);
    keyboardTimer.current = setTimeout(commitKeyboard, KEYBOARD_COMMIT_DELAY);
  };

  const tooltipSeconds =
    scrub !== undefined
      ? scrub
      : hoverSeconds !== undefined
        ? hoverSeconds
        : focused && preview !== undefined
          ? preview
          : undefined;

  return (
    <div
      ref={bar}
      className={`seekbar${scrub !== undefined ? " scrubbing" : ""}`}
      data-focus-id={id}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration ?? 0)}
      aria-valuenow={Math.round(displayed)}
      aria-valuetext={formatPlaybackTime(displayed)}
      aria-disabled={!seekable}
      tabIndex={seekable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div className="seekbar-track" aria-hidden="true">
        {buffered?.map((range, i) => {
          const start = timelineRatio(range.start, duration);
          return (
            <span
              key={i}
              className="seekbar-buffered"
              style={{
                left: `${start * 100}%`,
                width: `${(timelineRatio(range.end, duration) - start) * 100}%`,
              }}
            />
          );
        })}
        <span className="seekbar-played" style={{ width: `${played * 100}%` }} />
      </div>
      <span className="seekbar-thumb" aria-hidden="true" style={{ left: `${played * 100}%` }} />
      {tooltipSeconds !== undefined && (
        <span
          className="seekbar-tooltip"
          aria-hidden="true"
          style={{ left: `${timelineRatio(tooltipSeconds, duration) * 100}%` }}
        >
          {formatPlaybackTime(tooltipSeconds)}
        </span>
      )}
    </div>
  );
}
