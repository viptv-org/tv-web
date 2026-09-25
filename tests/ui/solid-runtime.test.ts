import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponent, createRoot, createSignal, createRenderEffect } from "solid-js";

type Node = { props: Record<string, unknown>; children: Node[] };
const graphics = vi.hoisted(() => ({ nodes: [] as Node[] }));
// Mock the external graphics boundary; keep Solid's real reactive ownership.
vi.mock("@solidtv/solid", async () => {
  const { createRenderEffect } = await import("solid-js");
  return {
    createElement: () => {
      const node: Node = { props: {}, children: [] };
      graphics.nodes.push(node);
      return node;
    },
    spread: (node: Node, props: Record<string, unknown>) => {
      createRenderEffect(() => {
        for (const key of Object.keys(props)) node.props[key] = props[key];
      });
    },
    insert: (node: Node, read: () => Node | Node[] | undefined) => {
      createRenderEffect(() => {
        let value: unknown = read();
        while (typeof value === "function") value = value();
        node.children = value === undefined ? [] : Array.isArray(value) ? value : [value as Node];
      });
    },
    getRenderer: () => ({ createTexture: vi.fn() }),
  };
});
import { TvView, TvText } from "../../src/tv-solid/runtime";

const disposals: (() => void)[] = [];
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); graphics.nodes.length = 0; });

describe("SolidTV deferred screen rendering", () => {
  it("keeps the displayed title until the new glyph texture is uploaded, ignoring stale loads", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: () => ({ actualBoundingBoxAscent: 20 }) } as unknown as CanvasRenderingContext2D);
    const [title, setTitle] = createSignal("First title");
    createRoot(dispose => {
      disposals.push(dispose);
      const rendered: unknown = createComponent(TvText, { get content() { return title(); }, font: "Onest", size: 24, color: "#ffffff" });
      createRenderEffect(() => { if (typeof rendered === "function") rendered(); });
    });
    const ready = (node: Node) => (node.props.onEvent as { loaded: (node: Node, event: { type: string }) => void }).loaded(node, { type: "texture" });
    const first = graphics.nodes.find(node => node.props.text === "First title")!;
    ready(first);
    await Promise.resolve();
    expect(first.props.alpha).toBe(1);
    setTitle("Second title");
    const second = graphics.nodes.at(-1)!;
    expect(first.props.alpha).toBe(1);
    expect(second.props.alpha).toBe(0.001);
    setTitle("Third title");
    const third = graphics.nodes.at(-1)!;
    ready(second);
    await Promise.resolve();
    expect(first.props.alpha).toBe(1);
    ready(third);
    await Promise.resolve();
    expect(third.props.alpha).toBe(1);
  });
  it("does no child work before first visibility and retains the mounted subtree on return", () => {
    const [visible, setVisible] = createSignal(false);
    const child = vi.fn(() => createComponent(TvView, { w: 100, h: 100 }));
    let node!: Node;
    createRoot(dispose => {
      disposals.push(dispose);
      node = createComponent(TvView, { get show() { return visible(); }, get children() { return child(); } }) as unknown as Node;
    });
    expect(child).not.toHaveBeenCalled();
    expect(node.children).toEqual([]);
    setVisible(true);
    expect(child).toHaveBeenCalledTimes(1);
    const mounted = node.children[0];
    setVisible(false);
    expect(node.props.alpha).toBe(0);
    expect(node.children[0]).toBe(mounted);
    setVisible(true);
    expect(child).toHaveBeenCalledTimes(1);
    expect(node.children[0]).toBe(mounted);
  });

  it("reserves a hidden focus ring's paint position before its artwork", () => {
    const [focused, setFocused] = createSignal(false);
    let root!: Node;
    createRoot(dispose => {
      disposals.push(dispose);
      root = createComponent(TvView, {
        get children() {
          return [
            createComponent(TvView, { get show() { return focused(); }, color: "#ffffff", w: 108, h: 108 }),
            createComponent(TvView, { color: "#161618", w: 100, h: 100 }),
          ];
        },
      }) as unknown as Node;
    });
    const [ring, artwork] = root.children;
    expect(root.children).toHaveLength(2);
    expect(ring.props.alpha).toBe(0);
    setFocused(true);
    expect(root.children).toEqual([ring, artwork]);
    expect(ring.props.alpha).toBe(1);
    expect(graphics.nodes).toHaveLength(3);
  });
});
