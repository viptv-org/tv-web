import { batch, createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import { HERO_SLIDE_MS, advanceHeroRotation, clampHeroRotation, restartHeroRotation, startHeroRotation } from "./heroCycle";
import { reducedMotion } from "./motion";

export function createHeroCycle(options: {count: Accessor<number>; enabled: Accessor<boolean>}) {
  const [rotation, setRotation] = createSignal(startHeroRotation(options.count()));
  const [started, setStarted] = createSignal(performance.now());
  const [visible, setVisible] = createSignal(document.visibilityState === "visible");
  const [ready, setReady] = createSignal(true);
  const [version, setVersion] = createSignal(0);
  const [movement, setMovement] = createSignal(0);
  const [motionEpoch, setMotionEpoch] = createSignal(0);
  const media = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  const changed = () => setMotionEpoch(value => value + 1);
  media?.addEventListener?.("change", changed);
  onCleanup(() => media?.removeEventListener?.("change", changed));
  const animated = createMemo(() => { motionEpoch(); return !reducedMotion(); });
  const eligible = createMemo(() => options.enabled() && visible() && options.count() > 1);
  const active = createMemo(() => eligible() && ready());
  const reset = () => batch(() => { setStarted(performance.now()); setVersion(value => (value + 1) % 1000000); });
  const restart = () => batch(() => { setRotation(current => restartHeroRotation(current)); reset(); });
  let wasActive = false, generation = 0;
  createEffect(() => {
    const enabled = active(); version();
    let beginning = started();
    if (!enabled) { wasActive = false; return; }
    if (!wasActive) { wasActive = true; beginning = performance.now(); setStarted(beginning); }
    const owner = ++generation;
    const timer = setTimeout(() => {
      if (owner !== generation || !active()) return;
      const next = advanceHeroRotation(rotation(), options.count());
      if (!next) return;
      batch(() => { setRotation(next); setMovement(value => (value + 1) % 1000000); reset(); });
    }, Math.max(0, HERO_SLIDE_MS - (performance.now() - beginning)));
    onCleanup(() => { generation++; clearTimeout(timer); });
  });
  return {
    slide: () => rotation().slide, active, eligible, visible, animated, started, movement, setVisible, setReady, reset, restart,
    interrupt: (displayed?: number) => batch(() => {
      if (displayed !== undefined && displayed >= 0) setRotation(current => ({...restartHeroRotation(current), slide: Math.min(displayed, Math.max(0, options.count() - 1))}));
      reset();
    }),
    clear: () => setRotation(startHeroRotation(0)),
    clamp: (count: number) => setRotation(current => clampHeroRotation(current, count)),
  };
}
