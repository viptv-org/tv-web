/** @jsxImportSource @solidtv/solid */
import { createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import type { ElementNode } from "@solidtv/solid";
import { TvView } from "../runtime";
import { animateProp, type AnimationSettings, type RunningAnimation } from "./animate";
import { palette } from "./visuals";

/**
 * The slide runs.
 *
 * These are module constants on purpose. The renderer restarts a run when the
 * settings object changes identity, so an inline `transition={{x: {...}}}`
 * made the drawer restart its slide on every re-render of the source list —
 * the drawer never arrived, it kept re-aiming at the same target.
 *
 * The easing names are the ones both renderers understand: the browser
 * resolves a cubic bezier, the Roku host maps the same name onto its
 * compositor easing.
 */
const OPEN_RUN: AnimationSettings = { duration: 300, easing: "ease-out" };
const CLOSE_RUN: AnimationSettings = { duration: 200, easing: "ease-in" };

/** Where the drawer is: open means it is on screen, closed means it is not. */
export type DrawerState = "open" | "closed";

export function SlidingDrawer(props: {
  width: number;
  entered: boolean;
  closing: boolean;
  /**
   * The drawer reached its target. The overlay waits for this instead of
   * guessing how long the slide takes.
   */
  onSettled?: (state: DrawerState) => void;
  children: JSX.Element;
}) {
  const [node, setNode] = createSignal<ElementNode>();
  // The node exists before it is rendered; the renderer only owns it once the
  // tree is on screen, so the slide starts from the mounted node.
  const [armed, setArmed] = createSignal(false);
  let run: RunningAnimation | undefined;
  let generation = 0;
  let placed = false;

  onMount(() => setArmed(true));

  createEffect(() => {
    const ready = armed();
    const element = node();
    const open = props.entered && !props.closing;
    const width = props.width;
    if (!ready || !element || !element.rendered) return;
    const target = open ? 1920 - width : 1920;
    if (!placed) {
      // The first placement is not a run. The drawer is where it belongs and
      // only a later change of state slides it: a drawer that reopens from a
      // parent overlay appears where it was left, it does not fly in.
      placed = true;
      element.x = target;
      props.onSettled?.(open ? "open" : "closed");
      return;
    }
    const gen = ++generation;
    run?.stop();
    const animation = animateProp(
      element,
      "x",
      target,
      props.closing ? CLOSE_RUN : OPEN_RUN,
    );
    run = animation;
    if (!animation) {
      // No animatable node: land on the target at once and report it.
      element.x = target;
      props.onSettled?.(open ? "open" : "closed");
      return;
    }
    void animation.done.then(() => {
      if (gen === generation) props.onSettled?.(open ? "open" : "closed");
    });
  });

  onCleanup(() => {
    generation++;
    run?.stop();
  });

  return (
    <TvView nodeRef={setNode} w={props.width} h={1080} color={palette.surface}>
      {props.children}
    </TvView>
  );
}
