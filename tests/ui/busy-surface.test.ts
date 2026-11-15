import { afterEach, expect, it, vi } from "vitest";
import { createComponent, createRoot } from "solid-js";

type Node = { props: Record<string, any>; rendered: boolean; lng: Record<string, any>; children?: Node[] };
const graphics = vi.hoisted(() => ({
  nodes: [] as Node[],
  runs: [] as { name: string; value: number; settings: Record<string, any> }[],
  animatable: true,
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
        : value?.kind || value?.props
          ? [value]
          : [];
  return {
    TvView: (props: Record<string, any>) => {
      const node: Node = {
        props,
        rendered: true,
        lng: graphics.animatable
          ? {
              animateProp: (name: string, value: number, settings: Record<string, any>) => {
                graphics.runs.push({ name, value, settings });
                return { stop: () => {}, waitUntilStopped: () => new Promise<void>(() => {}) };
              },
            }
          : {},
      };
      graphics.nodes.push(node);
      solid.createRenderEffect(() => {
        node.props = props;
        node.children = resolve(props.children);
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

import { BusySpinner, BusySurface } from "../../src/tv-solid/remote/BusySurface";

const disposals: (() => void)[] = [];
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose());
  graphics.nodes.length = 0;
  graphics.runs.length = 0;
  graphics.animatable = true;
});

function mount(component: () => unknown) {
  createRoot(dispose => {
    disposals.push(dispose);
    component();
  });
}

it("spins on the renderer's clock instead of writing a signal every frame", () => {
  const frames = vi.spyOn(globalThis, "requestAnimationFrame");
  mount(() => createComponent(BusySpinner, { size: 56 }));

  expect(graphics.runs).toEqual([
    { name: "rotation", value: Math.PI * 2, settings: { duration: 1000, loop: true, easing: "linear" } },
  ]);
  expect(frames).not.toHaveBeenCalled();
});

it("falls back to its own frames where the renderer cannot animate", () => {
  graphics.animatable = false;
  const frames = vi.spyOn(globalThis, "requestAnimationFrame");
  mount(() => createComponent(BusySpinner, { size: 56 }));

  expect(graphics.runs).toEqual([]);
  expect(frames).toHaveBeenCalled();
});

it("puts every busy state in the same place", () => {
  mount(() => createComponent(BusySurface, { label: "Seeking…" }));

  const surface = graphics.nodes.find(node => node.props.w === 320 && node.props.h === 132);
  expect(surface?.props).toMatchObject({ x: 800, y: 476, w: 320, h: 132 });
  const spinner = graphics.nodes.find(node => node.props.w === 56 && node.props.h === 56);
  expect(spinner?.props).toMatchObject({ x: 132, y: 0 });
});
