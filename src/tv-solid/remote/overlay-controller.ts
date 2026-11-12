import { createSignal, type Accessor } from "solid-js";
import type { Overlay, Screen } from "./app-types";

export interface OverlayFocus { zone: string; column: number; row: number; choice: number }
interface OverlayUi {
  screen: Accessor<Screen>;
  capture: Accessor<OverlayFocus>;
  restore: (focus: OverlayFocus) => void;
  select: (index: number) => void;
  selection: Accessor<number>;
}
interface OverlayText { begin: (initial: string) => void; clear: () => void }
interface OverlayErrors { clear: () => void; restore: () => void }

export function createOverlayController(options: { focus: OverlayUi; text: OverlayText; errors: OverlayErrors }) {
  const [current, setCurrent] = createSignal<Overlay>();
  const [entered, setEntered] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  const [settled, setSettled] = createSignal(false);
  const parents: { value: Overlay; choice: number }[] = [];
  let origin: OverlayFocus = {zone: "hero", column: 0, row: 0, choice: 0};
  let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
  function dispose() { clearTimeout(timer); cancelAnimationFrame(frame); }
  function retireAnimations() {
    dispose(); parents.length = 0;
    setClosing(false); setSettled(false); setEntered(false);
  }
  const captureOrigin = () => { origin = options.focus.capture(); };
  function open(value: Overlay, child = false, preserveOrigin = false) {
    dispose(); setClosing(false);
    if (child && current()) parents.push({value: current()!, choice: options.focus.selection()});
    else parents.length = 0;
    if (!preserveOrigin) captureOrigin();
    options.focus.select(0); options.errors.clear();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEntered(reduced); setSettled(reduced); setCurrent(value);
    if (!reduced) frame = requestAnimationFrame(() => {
      setEntered(true); timer = setTimeout(() => setSettled(true), 320);
    });
    if (value.kind === "text") options.text.begin(value.initial ?? "");
  }
  const replace = (value: Overlay) => open(value, false, true);
  function close(restoreFocus = true) {
    parents.length = 0; dispose();
    const focus = origin, layer = current();
    const screen = options.focus.screen(), before = options.focus.capture();
    const finish = () => {
      if (layer && current() !== layer) return;
      const after = options.focus.capture();
      const restore = restoreFocus && !!layer && options.focus.screen() === screen &&
        after.zone === before.zone && after.column === before.column && after.row === before.row;
      setCurrent(undefined); setClosing(false); setSettled(false); setEntered(false);
      options.text.clear(); options.errors.restore();
      if (restore) options.focus.restore(focus);
    };
    const animated = layer && (layer.kind === "sources" || layer.kind === "tracks" ||
      ((layer.kind === "choices" || layer.kind === "confirm") && !layer.profile));
    if (animated && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setClosing(true); timer = setTimeout(finish, 200);
    } else finish();
  }
  function restoreParent(): boolean {
    const previous = parents.pop();
    if (!previous) return false;
    dispose(); setClosing(false); setSettled(true); setEntered(true);
    setCurrent(previous.value); options.focus.select(previous.choice);
    options.text.clear(); options.errors.clear();
    return true;
  }
  return { current, entered, closing, settled, open, replace, close, restoreParent, captureOrigin,
    origin: () => origin, hide: () => setCurrent(undefined), retireAnimations, dispose };
}
