import type { Accessor, Setter } from "solid-js";
import type { Overlay } from "../app-types";

export function createOverlayNavigation(options: {
  selection: {index: Accessor<number>; set: Setter<number>};
  tracks: {index: Accessor<number>; set: Setter<number>};
  calibration: {value: Accessor<number>; set: Setter<number>; preview: (value: number) => void};
  keyboard: Setter<number>;
  sources: (dx: number, dy: number) => void;
}) {
  const {index: choice, set: setChoice} = options.selection;
  const {index: trackColumn, set: setTrackColumn} = options.tracks;
  const {value: calibrationValue, set: setCalibrationValue, preview: applyScreenInset} = options.calibration;
  const {keyboard: setKey, sources: navigateSources} = options;
  return (value: Overlay, dx: number, dy: number) => {
    if (
      (value.kind === "choices" || value.kind === "confirm") &&
      value.profile
    ) {
      const avatar = value.items.findIndex((item) => item.id === "avatar"),
        right = value.items
          .map((_, index) => index)
          .filter((index) => index !== avatar);
      if (dx < 0 && avatar >= 0) setChoice(avatar);
      else if (dx > 0) setChoice(right[0] ?? avatar);
      else if (dy) {
        const index = right.indexOf(choice());
        setChoice(
          right[Math.max(0, Math.min(right.length - 1, index + dy))] ??
            avatar,
        );
      }
      return;
    }
    if (value.kind === "next") {
      if (dx) setChoice(i => Math.max(0, Math.min(1, i + dx)));
      return;
    }
    if (value.kind === "tracks") {
      if (dx) {
        const column = Math.max(0, Math.min(value.columns.length - 1, trackColumn() + dx));
        setTrackColumn(column);
        setChoice(Math.max(0, value.columns[column]?.items.findIndex(item => item.value === "✓") ?? 0));
      } else {
        const items = value.columns[trackColumn()]?.items ?? [];
        setChoice((i) =>
          Math.max(0, Math.min(items.length - 1, i + dy)),
        );
      }
      return;
    }
    if (value.kind === "sources") { navigateSources(dx, dy); return; }
    if (value.kind === "calibration") {
      if (dx) {
        const next = Math.max(
          value.min,
          Math.min(value.max, calibrationValue() + dx),
        );
        setCalibrationValue(next);
        applyScreenInset(next);
      }
      return;
    }
    if (value.kind === "text") {
      setKey((i) =>
        Math.max(
          0,
          Math.min(
            value.numeric ? 11 : 47,
            i + dx + dy * (value.numeric ? 3 : 6),
          ),
        ),
      );
    } else
      setChoice((i) =>
        Math.max(0, Math.min(value.items.length - 1, i + dy)),
      );
  };
}
