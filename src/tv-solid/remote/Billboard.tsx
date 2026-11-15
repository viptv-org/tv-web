/** @jsxImportSource @solidtv/solid */
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { ElementNode } from "@solidtv/solid";
import { TvView } from "../runtime";
import { palette } from "./visuals";
import { HERO_SLIDE_MS } from "./heroCycle";
import { animateProp, type RunningAnimation } from "./animate";

/** The bar's full width, and the width it empties to. */
const FULL = 48;
const EMPTY = 6;

/**
 * The fill runs on the renderer's clock.
 *
 * The bar is a countdown: it is full when the featured title arrives and
 * empties as the slide runs out. It used to shrink through a signal that
 * wrote a `w` prop every 150 ms — every write was a layout pass and a uniform
 * update for a four-pixel bar. `w` is a fast track in both renderers, so the
 * renderer can shrink it itself and no JavaScript runs per frame.
 */
export function HeroProgress(props: { started: number; running: boolean }) {
  const [node, setNode] = createSignal<ElementNode>();
  // The node exists before it is rendered; the renderer only owns it once the
  // tree is on screen, so the fill starts from the mounted node.
  const [armed, setArmed] = createSignal(false);
  let run: RunningAnimation | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => setArmed(true));

  createEffect(() => {
    const ready = armed();
    const started = props.started;
    const running = props.running;
    const element = node();
    if (!ready || !element || !element.rendered) return;
    run?.stop();
    run = undefined;
    clearInterval(timer);
    timer = undefined;
    if (!running) {
      element.w = FULL;
      return;
    }
    const elapsed = Math.max(0, Math.min(HERO_SLIDE_MS, performance.now() - started));
    const remaining = HERO_SLIDE_MS - elapsed;
    if (remaining <= 0) {
      element.w = EMPTY;
      return;
    }
    // Start where the countdown actually is, not where it began.
    element.w = Math.max(EMPTY, FULL * (1 - elapsed / HERO_SLIDE_MS));
    const animation = animateProp(element, "w", EMPTY, {
      duration: remaining,
      easing: "linear",
    });
    if (animation) {
      run = animation;
      return;
    }
    // No native run on this platform: shrink the bar from a timer, as it did
    // before.
    const tick = () => {
      const left = Math.max(EMPTY, FULL * (1 - (performance.now() - started) / HERO_SLIDE_MS));
      element.w = left;
    };
    tick();
    timer = setInterval(tick, 150);
  });

  onCleanup(() => {
    run?.stop();
    clearInterval(timer);
  });

  return (
    <TvView w={FULL} h={4} color="rgba(244,242,238,.3)">
      <TvView nodeRef={setNode} w={FULL} h={4} color={palette.text} />
    </TvView>
  );
}
