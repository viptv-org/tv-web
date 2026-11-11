import { batch, createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import {
  HERO_SLIDE_MS, advanceHeroRotation, clampHeroRotation,
  heroRotationRunning, restartHeroRotation, startHeroRotation,
} from "./heroCycle";

export function createHeroCycle(options: { count: Accessor<number>; enabled: Accessor<boolean> }) {
  const [rotation, setRotation] = createSignal(startHeroRotation(options.count()));
  const [started, setStarted] = createSignal(performance.now());
  const [visible, setVisible] = createSignal(document.visibilityState === "visible");
  const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const running = createMemo(() => heroRotationRunning(rotation(), options.count()));
  const active = createMemo(() => options.enabled() && visible() && motion && running());
  const reset = () => setStarted(performance.now());
  const restart = () => {
    setRotation(current => restartHeroRotation(current));
    reset();
  };
  let wasActive = false;
  createEffect(() => {
    const enabled = active();
    let beginning = started();
    if (!enabled) { wasActive = false; return; }
    if (!wasActive) {
      wasActive = true;
      beginning = performance.now();
      setRotation(current => current.shown > 1 ? restartHeroRotation(current) : current);
      setStarted(beginning);
    }
    const timer = setTimeout(() => {
      if (!active()) return;
      const next = advanceHeroRotation(rotation(), options.count());
      if (!next) return;
      batch(() => { setRotation(next); reset(); });
    }, Math.max(0, HERO_SLIDE_MS - (performance.now() - beginning)));
    onCleanup(() => clearTimeout(timer));
  });
  return {
    slide: () => rotation().slide, active, started, setVisible, reset, restart,
    clear: () => setRotation(startHeroRotation(0)),
    clamp: (count: number) => setRotation(current => clampHeroRotation(current, count)),
  };
}
