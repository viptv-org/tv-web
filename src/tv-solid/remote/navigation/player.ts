import type { Accessor, Setter } from "solid-js";

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
}) {
  const { selection, timeline, controls } = options;
  let lastTool = 1;
  function move(dx: number, dy: number) {
    if (timeline.seeking()) return;
    controls.show(); controls.activity();
    if (dx && !selection.timeline()) {
      selection.set(index => Math.max(0, Math.min(controls.count() - 1, index + dx)));
      lastTool = selection.index();
    } else if (dx && timeline.allowed()) {
      const duration = Number(timeline.duration());
      const target = (timeline.preview() ?? timeline.position()) + dx * 10;
      timeline.setPreview(Math.max(0, Number.isFinite(duration) && duration > 0 ? Math.min(duration, target) : target));
    }
    if (dy < 0 && selection.timeline()) {
      timeline.setPreview(undefined); selection.setTimeline(false);
      selection.set(Math.min(lastTool, controls.count() - 1));
    }
    if (dy > 0 && !selection.timeline()) {
      lastTool = selection.index(); selection.setTimeline(true); selection.set(0);
    }
  }
  return { move, reset: () => { lastTool = 1; } };
}
