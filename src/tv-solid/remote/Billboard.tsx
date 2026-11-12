/** @jsxImportSource @solidtv/solid */
import { createEffect, createSignal, onCleanup } from "solid-js";
import { TvView } from "../runtime";
import { palette } from "./visuals";
import { HERO_SLIDE_MS } from "./heroCycle";

export function HeroProgress(props: { started: number; running: boolean }) {
  const [width, setWidth] = createSignal(48);
  createEffect(() => {
    const started = props.started;
    if (!props.running) { setWidth(48); return; }
    const tick = () => setWidth(Math.max(6, 48 * Math.min(1, (performance.now() - started) / HERO_SLIDE_MS)));
    tick();
    const timer = setInterval(tick, 150);
    onCleanup(() => clearInterval(timer));
  });
  return <TvView w={48} h={4} color="rgba(244,242,238,.3)">
    <TvView w={width()} h={4} color={palette.text} />
  </TvView>;
}
