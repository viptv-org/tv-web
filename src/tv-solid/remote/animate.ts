import { Config, type ElementNode } from "@solidtv/solid";
import { reducedMotion } from "./motion";

/**
 * The renderer's own animation settings.
 *
 * Identity matters. Both renderers keep one run per (node, property) and
 * compare the settings object *by identity*: a fresh object stops the running
 * controller and starts a new one from the current value. An inline
 * `transition={{...}}` therefore restarted the slide on every re-render of
 * the drawer. Every settings object in the app is a module-level constant.
 */
export interface AnimationSettings {
  duration: number;
  delay?: number;
  easing?: string;
  loop?: boolean;
  repeat?: number;
  repeatDelay?: number;
  adaptiveDuration?: boolean;
}

export interface RunningAnimation {
  /** Resolves when the run stops, whether it ended or was replaced. */
  done: Promise<void>;
  /** Retarget the run at another value; `done` stays pending until it stops. */
  to: (value: number) => void;
  /** Stop the run now; `done` resolves. */
  stop: () => void;
}

interface AnimationController {
  stop?: () => unknown;
  waitUntilStopped?: () => Promise<void>;
}

interface AnimatableNode {
  animateProp?: (
    name: string,
    value: number,
    settings: AnimationSettings,
  ) => AnimationController | undefined;
  [key: string]: unknown;
}

/**
 * Motion is off when the device asks for it, when the profile forces it, or
 * when the renderer itself has animations disabled. Every animated path in
 * the app checks this, so a reduced-motion session still reaches the same
 * state — it just gets there at once.
 */
export function motionEnabled(): boolean {
  return Config.animationsEnabled && !reducedMotion();
}

/**
 * Drive one numeric property with the renderer's own animation.
 *
 * The renderer owns the clock: the run reports its own completion, so the app
 * never guesses a duration and never keeps a transition running after the
 * thing it was waiting for has already happened.
 *
 * Returns `undefined` when the node cannot animate, so the caller can fall
 * back to landing the value directly.
 */
export function animateProp(
  node: ElementNode | undefined,
  name: string,
  value: number,
  settings: AnimationSettings,
): RunningAnimation | undefined {
  if (!node) return undefined;
  const target = node.lng as AnimatableNode | undefined;
  if (!target) return undefined;
  if (!motionEnabled()) {
    // Reduced motion: the value lands at once and the run is already done.
    const land = (next: number) => {
      node[name] = next;
    };
    land(value);
    return { done: Promise.resolve(), to: land, stop: () => {} };
  }
  if (typeof target.animateProp !== "function") return undefined;
  let controller: AnimationController | undefined;
  try {
    controller = target.animateProp(name, value, settings);
  } catch {
    return undefined;
  }
  if (!controller) return undefined;
  const done =
    typeof controller.waitUntilStopped === "function"
      ? controller.waitUntilStopped().catch(() => {})
      : Promise.resolve();
  return {
    done,
    to: (next) => {
      // The same settings object retargets the running controller instead of
      // restarting it, so the run keeps its place on the timeline.
      try {
        target.animateProp?.(name, next, settings);
      } catch {
        /* the node went away */
      }
    },
    stop: () => {
      try {
        controller?.stop?.();
      } catch {
        /* the node went away */
      }
    },
  };
}
