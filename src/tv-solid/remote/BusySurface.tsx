/** @jsxImportSource @solidtv/solid */
import { createSignal, onCleanup, onMount } from "solid-js";
import type { ElementNode } from "@solidtv/solid";
import { TvView } from "../runtime";
import { Label, palette } from "./visuals";
import { busySpinnerSource } from "./tv-artwork.generated";
import { animateProp, motionEnabled, type AnimationSettings, type RunningAnimation } from "./animate";

/**
 * The spin.
 *
 * The renderer owns the clock: `rotation` is a fast track in both renderers,
 * so the loop runs on the renderer's frame clock and no JavaScript runs per
 * frame. The settings object is a module constant because the renderer
 * compares settings by identity — a fresh object would restart the loop on
 * every render.
 */
const SPIN: AnimationSettings = { duration: 1000, loop: true, easing: "linear" };

/**
 * The busy surface.
 *
 * One geometry for every busy state: the spinner sits at the optical centre
 * of the screen and its message sits under it, so a seek, a buffer and a
 * preparing stream all read as the same thing in the same place.
 */
export const BUSY_SURFACE = { x: 800, y: 476, w: 320, h: 132 };

export function BusySpinner(props: { x?: number; y?: number; size: number }) {
  const [node, setNode] = createSignal<ElementNode>();
  const [angle, setAngle] = createSignal(0);
  let frame = 0;
  let run: RunningAnimation | undefined;

  onMount(() => {
    // Reduced motion: a still spinner is the answer, and the renderer is not
    // asked to move anything.
    if (!motionEnabled()) return;
    const element = node();
    if (element?.rendered) {
      const animation = animateProp(element, "rotation", Math.PI * 2, SPIN);
      if (animation) {
        run = animation;
        return;
      }
    }
    // No native run on this platform: drive the rotation from a frame
    // callback, the way the spinner did before.
    const start = performance.now();
    const tick = (now: number) => {
      setAngle((((now - start) % 1000) / 1000) * Math.PI * 2);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    run?.stop();
    cancelAnimationFrame(frame);
  });

  return (
    <TvView
      nodeRef={setNode}
      x={props.x ?? 0}
      y={props.y ?? 0}
      w={props.size}
      h={props.size}
      src={busySpinnerSource()}
      color={palette.accent}
      rotation={angle()}
    />
  );
}

/** The one busy surface: a spinner and its message. */
export function BusySurface(props: { label: string }) {
  return (
    <TvView x={BUSY_SURFACE.x} y={BUSY_SURFACE.y} w={BUSY_SURFACE.w} h={BUSY_SURFACE.h}>
      <BusySpinner x={132} size={56} />
      <Label w={320} centerY={100} align="center" size={26} font="Onest600" maxlines={1} content={props.label} />
    </TvView>
  );
}
