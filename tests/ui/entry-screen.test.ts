import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createComponent, createRoot } from "solid-js";

type Node = { props: Record<string, any>; rendered: boolean; lng: Record<string, any> };
const graphics = vi.hoisted(() => ({
  nodes: [] as Node[],
  captured: [] as Node[],
  runs: [] as { name: string; value: number; settings: Record<string, any> }[],
  reduced: false,
}));

// Keep Solid's own reactivity; only the graphics boundary is mocked.
vi.mock("@solidtv/solid", async () => {
  const solid = await import("solid-js");
  return {
    ...solid,
    memo: solid.createMemo,
    effect: solid.createRenderEffect,
    Config: { animationsEnabled: true },
    getRenderer: () => ({ measureText: () => ({ w: 300 }) }),
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
    fontEpochSignal: () => 0,
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
      if (props.nodeRef) {
        graphics.captured.push(node);
        props.nodeRef(node);
      }
      return node;
    },
  };
});
vi.mock("../../src/tv-solid/fonts", () => ({
  sdfFontFamily: () => "Bricolage800",
  sdfLineHeight: () => 104,
}));
vi.mock("../../src/tv-solid/remote/PosterWall", () => ({
  PosterWall: () => ({ kind: "poster-wall", props: {} }),
}));
vi.mock("../../src/tv-solid/remote/visuals", () => ({
  palette: { surface: "#161618", text: "#F4F2EE", muted: "#B6B4AF", accent: "#F5C542" },
  Label: (props: Record<string, any>) => ({ kind: "label", props }),
}));

import { EntryScreen } from "../../src/tv-solid/remote/EntryScreens";

const disposals: (() => void)[] = [];
// jsdom has no `matchMedia`; the splash asks it whether the device wants
// reduced motion before it animates anything.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList,
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  disposals.splice(0).forEach(dispose => dispose());
  graphics.nodes.length = 0;
  graphics.captured.length = 0;
  graphics.runs.length = 0;
  graphics.reduced = false;
});

function mount(loading: boolean) {
  createRoot(dispose => {
    disposals.push(dispose);
    createComponent(EntryScreen, { loading, focused: true });
  });
}

it("fades the brand in and sweeps the indicator on the renderer's clock", () => {
  const frames = vi.spyOn(globalThis, "requestAnimationFrame");
  mount(true);

  expect(graphics.runs).toHaveLength(2);
  expect(graphics.runs[0]).toEqual({
    name: "alpha",
    value: 1,
    settings: { duration: 600, easing: "cubic-bezier(0,0,0.58,1)" },
  });
  expect(graphics.runs[1].name).toBe("x");
  expect(graphics.runs[1].value).toBeCloseTo(249.6, 5);
  expect(graphics.runs[1].settings).toEqual({
    duration: 1200,
    easing: "cubic-bezier(0.4,0,0.2,1)",
    loop: true,
  });
  expect(frames).not.toHaveBeenCalled();
});

it("starts the brand hidden and the indicator off its track", () => {
  mount(true);

  const brand = graphics.captured.find(node => node.props.alpha !== undefined)!;
  const bar = graphics.captured.find(node => node.props.x !== undefined)!;
  expect(brand.props.alpha).toBe(0);
  expect(bar.props.x).toBe(-96);
});

it("holds the splash still when the device asks for reduced motion", () => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList,
  );

  mount(true);

  expect(graphics.runs).toEqual([]);
});
