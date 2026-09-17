import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  SeekBar,
  formatPlaybackTime,
  seekPinReleased,
  pointerSeekIntent,
  secondsAtRatio,
  secondsFromPointer,
  timelineRatio,
  type BufferedRange,
  type SeekIntent,
} from "../../src/ui/SeekBar";

afterEach(() => vi.useRealTimers());

it("formats the clock as m:ss and h:mm:ss across the hour boundary", () => {
  expect(formatPlaybackTime(0)).toBe("0:00");
  expect(formatPlaybackTime(59)).toBe("0:59");
  expect(formatPlaybackTime(59.9)).toBe("0:59");
  expect(formatPlaybackTime(60)).toBe("1:00");
  expect(formatPlaybackTime(3599)).toBe("59:59");
  expect(formatPlaybackTime(3600)).toBe("1:00:00");
  expect(formatPlaybackTime(3661)).toBe("1:01:01");
  expect(formatPlaybackTime(2 * 3600 + 59 * 60 + 59)).toBe("2:59:59");
  expect(formatPlaybackTime(-5)).toBe("0:00");
  expect(formatPlaybackTime(Number.NaN)).toBe("0:00");
});

it("maps positions to clamped track ratios and back to seconds", () => {
  expect(timelineRatio(0, 1200)).toBe(0);
  expect(timelineRatio(600, 1200)).toBeCloseTo(0.5);
  expect(timelineRatio(1800, 1200)).toBe(1);
  expect(timelineRatio(-1, 1200)).toBe(0);
  expect(timelineRatio(600, null)).toBe(0);
  expect(timelineRatio(600, 0)).toBe(0);
  expect(secondsAtRatio(0.5, 1200)).toBe(600);
  expect(secondsAtRatio(2, 1200)).toBe(1200);
  expect(secondsAtRatio(-1, 1200)).toBe(0);
  expect(secondsAtRatio(0.5, null)).toBe(0);
});

it("maps pointer pixels inside the track box to timeline seconds", () => {
  expect(secondsFromPointer(150, 100, 200, 1000)).toBe(250);
  expect(secondsFromPointer(50, 100, 200, 1000)).toBe(0);
  expect(secondsFromPointer(350, 100, 200, 1000)).toBe(1000);
  expect(secondsFromPointer(150, 100, 0, 1000)).toBe(0);
});

it("classifies still presses as clicks and traveling presses as drags", () => {
  expect(pointerSeekIntent(0)).toBe("click");
  expect(pointerSeekIntent(6)).toBe("click");
  expect(pointerSeekIntent(6.5)).toBe("drag");
  expect(pointerSeekIntent(200)).toBe("drag");
});

// jsdom reports a zero box and no PointerEvent; drive the bar with mouse
// events typed as pointer events and a pinned 400px track.
const pointerEvent = (type: string, x: number) =>
  new MouseEvent(type, { clientX: x, bubbles: true, cancelable: true });

function renderSeekBar({
  position = 200,
  duration = 1200,
  preview,
  buffer,
  remoteKeys,
}: {
  position?: number;
  duration?: number | null;
  preview?: number;
  buffer?(): readonly BufferedRange[] | null;
  remoteKeys?: boolean;
} = {}) {
  const onPreview = vi.fn();
  const onSeek = vi.fn<(seconds: number, intent: SeekIntent) => void>();
  const onActivate = vi.fn();
  const view = render(
    <SeekBar
      id="timeline"
      position={position}
      duration={duration}
      preview={preview}
      onPreview={onPreview}
      onSeek={onSeek}
      onActivate={onActivate}
      getBufferedRanges={buffer}
      remoteKeys={remoteKeys}
    />,
  );
  const bar = screen.getByRole("slider", { name: "Playback position" }) as HTMLDivElement;
  bar.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 400, bottom: 40, width: 400, height: 40, x: 0, y: 0 }) as unknown as DOMRect;
  return { view, bar, onPreview, onSeek, onActivate };
}

it("commits a still press as a click and a traveling press as a drag", () => {
  const { bar, onPreview, onSeek } = renderSeekBar();
  fireEvent(bar, pointerEvent("pointerdown", 100));
  // Pressing previews immediately, so a click always shows feedback.
  expect(onPreview).toHaveBeenLastCalledWith(300);
  expect(document.activeElement).toBe(bar);
  fireEvent(bar, pointerEvent("pointerup", 100));
  expect(onSeek).toHaveBeenCalledWith(300, "click");

  fireEvent(bar, pointerEvent("pointerdown", 50));
  expect(onPreview).toHaveBeenLastCalledWith(150);
  fireEvent(bar, pointerEvent("pointermove", 200));
  expect(onPreview).toHaveBeenLastCalledWith(600);
  fireEvent(bar, pointerEvent("pointermove", 350));
  expect(onPreview).toHaveBeenLastCalledWith(1050);
  fireEvent(bar, pointerEvent("pointerup", 350));
  expect(onSeek).toHaveBeenLastCalledWith(1050, "drag");
});

it("shows a time tooltip while hovering and while scrubbing", () => {
  const { bar } = renderSeekBar();
  fireEvent(bar, pointerEvent("pointermove", 200));
  expect(screen.getByText("10:00")).toBeInTheDocument();
  fireEvent(bar, pointerEvent("pointerdown", 300));
  expect(screen.getByText("15:00")).toBeInTheDocument();
  fireEvent(bar, pointerEvent("pointerup", 300));
  expect(screen.queryByText("15:00")).not.toBeInTheDocument();
});

it("draws the played fill, thumb, and real buffered ranges", () => {
  const live = renderSeekBar({ position: 600, buffer: () => [{ start: 0, end: 900 }] });
  expect((live.bar.querySelector(".seekbar-played") as HTMLElement).style.width).toBe("50%");
  expect(live.bar.querySelector(".seekbar-thumb")).not.toBeNull();
  expect((live.bar.querySelector(".seekbar-buffered") as HTMLElement).style.width).toBe("75%");
  live.view.unmount();

  const bare = renderSeekBar({ position: 600, buffer: () => null });
  expect(bare.bar.querySelector(".seekbar-buffered")).toBeNull();
  expect((bare.bar.querySelector(".seekbar-played") as HTMLElement).style.width).toBe("50%");
});

it("renders slider semantics and stays inert without a duration", () => {
  const { view, bar } = renderSeekBar();
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "1200");
  expect(bar).toHaveAttribute("aria-valuenow", "200");
  expect(bar).toHaveAttribute("aria-valuetext", "3:20");
  expect(bar).toHaveAttribute("aria-disabled", "false");
  expect(bar.tabIndex).toBe(0);

  view.unmount();

  const off = renderSeekBar({ duration: null });
  expect(off.bar).toHaveAttribute("aria-disabled", "true");
  expect(off.bar.tabIndex).toBe(-1);
  fireEvent(off.bar, pointerEvent("pointerdown", 100));
  expect(off.onPreview).not.toHaveBeenCalled();
  expect(off.onSeek).not.toHaveBeenCalled();
});

it("nudges by 10 seconds with the keyboard and commits after idle", () => {
  vi.useFakeTimers();
  const { bar, onPreview, onSeek } = renderSeekBar();
  bar.focus();
  fireEvent.keyDown(bar, { key: "ArrowRight" });
  expect(onPreview).toHaveBeenLastCalledWith(210);
  fireEvent.keyDown(bar, { key: "ArrowRight" });
  expect(onPreview).toHaveBeenLastCalledWith(220);
  act(() => vi.advanceTimersByTime(800));
  expect(onSeek).toHaveBeenCalledWith(220, "keyboard");
  expect(onPreview).toHaveBeenLastCalledWith(undefined);
});

it("commits a pending keyboard seek on Enter and activates otherwise", () => {
  vi.useFakeTimers();
  const onPreview = vi.fn<(seconds: number | undefined) => void>();
  const onSeek = vi.fn<(seconds: number, intent: SeekIntent) => void>();
  const onActivate = vi.fn();
  const props = {
    id: "timeline",
    position: 200,
    duration: 1200,
    onPreview,
    onSeek,
    onActivate,
  };
  const view = render(<SeekBar {...props} preview={190} />);
  const bar = screen.getByRole("slider", { name: "Playback position" }) as HTMLDivElement;
  bar.focus();
  fireEvent.keyDown(bar, { key: "Enter" });
  expect(onSeek).toHaveBeenCalledWith(190, "keyboard");
  expect(onActivate).not.toHaveBeenCalled();

  view.rerender(<SeekBar {...props} preview={undefined} />);
  fireEvent.keyDown(bar, { key: "Enter" });
  expect(onActivate).toHaveBeenCalledTimes(1);
  expect(onSeek).toHaveBeenCalledTimes(1);
});

it("leaves arrow keys to the app's remote layer when it owns them", () => {
  const { bar, onPreview, onSeek } = renderSeekBar({ remoteKeys: true });
  bar.focus();
  fireEvent.keyDown(bar, { key: "ArrowRight" });
  fireEvent.keyDown(bar, { key: "ArrowLeft" });
  fireEvent.keyDown(bar, { key: "Enter" });
  expect(onPreview).not.toHaveBeenCalled();
  expect(onSeek).not.toHaveBeenCalled();
});

it("holds a committed seek target until playback lands on it", () => {
  expect(seekPinReleased(120, 121, "playing")).toBe(true);
  expect(seekPinReleased(120, 119.5, "playing")).toBe(true);
  expect(seekPinReleased(120, 119, "playing")).toBe(false);
  expect(seekPinReleased(120, 0, "playing")).toBe(false);
  expect(seekPinReleased(120, 60, "paused")).toBe(false);
  expect(seekPinReleased(120, 60, "buffering")).toBe(false);
});

it("releases a pinned seek when the session ends or fails", () => {
  for (const state of ["error", "stopped", "ended", "disposed", "idle"]) {
    expect(seekPinReleased(120, 0, state)).toBe(true);
  }
});
