import { afterEach, expect, it, vi } from "vitest";
import { createComponent, createRoot } from "solid-js";

type Node = { props: Record<string, any>; rendered: boolean; lng: Record<string, any>; w?: number };
const graphics = vi.hoisted(() => ({
  nodes: [] as Node[],
  runs: [] as { name: string; value: number; settings: Record<string, any> }[],
}));

// Keep Solid's own reactivity; only the graphics boundary is mocked.
vi.mock("@solidtv/solid", async () => {
  const solid = await import("solid-js");
  return {
    ...solid,
    memo: solid.createMemo,
    effect: solid.createRenderEffect,
    Config: { animationsEnabled: true },
  };
});
vi.mock("../../src/tv-solid/runtime", async () => {
  const solid = await import("solid-js");
  const resolve = (value: any): any[] =>
    typeof value === "function"
      ? resolve(value())
      : Array.isArray(value)
        ? value.flatMap(resolve)
        : value?.props
          ? [value]
          : [];
  return {
    TvView: (props: Record<string, any>) => {
      const node: Node = {
        props,
        rendered: true,
        lng: {
          animateProp: (name: string, value: number, settings: Record<string, any>) => {
            graphics.runs.push({ name, value, settings });
            return { stop: () => {}, waitUntilStopped: () => new Promise<void>(() => {}) };
          },
        },
      };
      graphics.nodes.push(node);
      solid.createRenderEffect(() => {
        node.props = props;
        resolve(props.children);
      });
      props.nodeRef?.(node);
      return node;
    },
  };
});
vi.mock("../../src/tv-solid/remote/visuals", () => ({
  palette: { surface: "#161618", text: "#F4F2EE", muted: "#B6B4AF", accent: "#F5C542" },
  Label: (props: Record<string, any>) => ({ kind: "label", props }),
}));

import { HeroProgress } from "../../src/tv-solid/remote/Billboard";
import { HERO_SLIDE_MS } from "../../src/tv-solid/remote/heroCycle";

const disposals: (() => void)[] = [];
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose());
  graphics.nodes.length = 0;
  graphics.runs.length = 0;
});

function mount(props: { started: number; running: boolean }) {
  createRoot(dispose => {
    disposals.push(dispose);
    createComponent(HeroProgress, props);
  });
  return graphics.nodes.find(node => node.props.nodeRef)!;
}

it("empties the bar on the renderer's clock instead of a JavaScript timer", () => {
  const frames = vi.spyOn(globalThis, "requestAnimationFrame");
  const fill = mount({ started: performance.now(), running: true });

  expect(graphics.runs).toHaveLength(1);
  expect(graphics.runs[0].name).toBe("w");
  expect(graphics.runs[0].value).toBe(6);
  expect(graphics.runs[0].settings.easing).toBe("linear");
  expect(graphics.runs[0].settings.duration).toBeCloseTo(HERO_SLIDE_MS, -2);
  expect(frames).not.toHaveBeenCalled();
  expect(fill.w).toBeCloseTo(48, 1);
});

it("starts the countdown where it actually is, not where it began", () => {
  const fill = mount({ started: performance.now() - HERO_SLIDE_MS / 2, running: true });

  // Half the slide has passed, so half the bar is gone and half the time is.
  expect(fill.w).toBeCloseTo(24, 1);
  expect(graphics.runs[0].settings.duration).toBeCloseTo(HERO_SLIDE_MS / 2, -2);
});

it("shows a full bar when the cycle is not running", () => {
  const fill = mount({ started: performance.now(), running: false });

  expect(fill.w).toBe(48);
  expect(graphics.runs).toEqual([]);
});

it("empties the bar when the slide has already run out", () => {
  const fill = mount({ started: performance.now() - HERO_SLIDE_MS - 1000, running: true });

  expect(fill.w).toBe(6);
  expect(graphics.runs).toEqual([]);
});
