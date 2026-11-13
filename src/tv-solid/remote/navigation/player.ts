import type { Accessor, Setter } from "solid-js";
import { createHeldSeek } from "../input/held-seek";

interface PlayerSelection {
  index: Accessor<number>;
  set: Setter<number>;
  timeline: Accessor<boolean>;
  setTimeline: Setter<boolean>;
}
interface PlayerTimeline {
  seeking: Accessor<boolean>;
  allowed: Accessor<boolean>;
  duration: Accessor<number | null | undefined>;
  position: Accessor<number>;
  preview: Accessor<number | undefined>;
  setPreview: Setter<number | undefined>;
}
export function createPlayerNavigation(options: {
  selection: PlayerSelection;
  timeline: PlayerTimeline;
  controls: { count: Accessor<number>; show: () => void; activity: () => void };
  scope: Accessor<unknown | undefined>;
}) {
  const { selection, timeline, controls } = options;
  let lastTool = 1;
  const held = createHeldSeek({
    scope: () => selection.timeline() && timeline.allowed() && !timeline.seeking() ? options.scope() : undefined,
    step: seconds => {
      controls.show(); controls.activity();
      const duration = Number(timeline.duration());
      const target = (timeline.preview() ?? timeline.position()) + seconds;
      timeline.setPreview(Math.max(0, Number.isFinite(duration) && duration > 0 ? Math.min(duration, target) : target));
    },
  });
  function move(dx: number, dy: number) {
    held.cancel();
    if (timeline.seeking()) return;
    controls.show(); controls.activity();
    if (dx && !selection.timeline()) {
      selection.set(index => Math.max(0, Math.min(controls.count() - 1, index + dx)));
      lastTool = selection.index();
    } else if (dx && timeline.allowed()) {
      return held.press(dx);
    }
    if (dy < 0 && selection.timeline()) {
      timeline.setPreview(undefined); selection.setTimeline(false);
      selection.set(Math.min(lastTool, controls.count() - 1));
    }
    if (dy > 0 && !selection.timeline()) {
      lastTool = selection.index(); selection.setTimeline(true); selection.set(0);
    }
  }
  return { move, cancel: held.cancel, reset: () => { held.cancel(); lastTool = 1; } };
}
