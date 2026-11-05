import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponent, createRoot, createSignal } from "solid-js";

type Node = { kind: string; props: Record<string, unknown>; children: Node[] };
const graphics = vi.hoisted(() => ({ nodes: [] as Node[], textures: [] as { finish:()=>void; state:string }[] }));
// These tests exercise deferred painting; native focus is covered by the
// browser remote scenarios with the real SolidTV focus manager.
vi.mock("@solidtv/solid/primitives", () => ({
  useFocusManager: vi.fn(),
  suppressKeyUntilRelease: vi.fn(),
  releaseKeySuppression: vi.fn(),
}));
// Mock the external graphics boundary; keep Solid's real reactive ownership.
vi.mock("@solidtv/solid", async () => {
  const { createRenderEffect } = await import("solid-js");
  return {
    createElement: (kind: string) => {
      const node: Node = { kind, props: {}, children: [] };
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
        const value = read();
        node.children = value === undefined ? [] : Array.isArray(value) ? value : [value];
      });
    },
    getRenderer: () => ({
      // The renderer lays SDF text out; the block width is all these tests need.
      measureText: (props: { text?: string; lineHeight?: number }) =>
        props.text
          ? { w: String(props.text).length * 4, h: props.lineHeight ?? 32 }
          : { w: 0, h: props.lineHeight ?? 32 },
      createTexture: () => {
        const listeners = new Set<() => void>();
        const texture = {
          state: "freed",
          on: (_name: string, fn: () => void) => listeners.add(fn),
          off: (_name: string, fn: () => void) => listeners.delete(fn),
          finish: () => { texture.state = "loaded"; listeners.forEach(fn => fn()); },
        };
        graphics.textures.push(texture);
        return texture;
      },
    }),
  };
});
import { TvView, TvText } from "../../src/tv-solid/runtime";

const disposals: (() => void)[] = [];
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); graphics.nodes.length = 0; graphics.textures.length = 0; });

describe("SolidTV deferred screen rendering", () => {
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

describe("SolidTV SDF text updates", () => {
  it("updates the text node in place when content or colour changes", () => {
    const [content, setContent] = createSignal("1:00"), [color, setColor] = createSignal("#ffffff");
    const [projection, setProjection] = createSignal({});
    let node!: Node;
    createRoot(dispose => {
      disposals.push(dispose);
      node = TvText({
        get content() { projection(); return content(); },
        get color() { return color(); },
      }) as unknown as Node;
    });
    expect(node.kind).toBe("text");
    expect(node.props.text).toBe("1:00");
    expect(node.props.fontFamily).toBe("Onest");
    expect(node.props.fontSize).toBe(32);
    const nodeCount = graphics.nodes.length;
    setProjection({});
    expect(graphics.nodes).toHaveLength(nodeCount);
    setContent("1:01");
    expect(node.props.text).toBe("1:01");
    expect(graphics.nodes).toHaveLength(nodeCount);
    setColor("#111113");
    expect(node.props.color).toBe(0x111113ff);
    expect(node.props.text).toBe("1:01");
    setContent("");
    expect(node.props.alpha).toBe(0);
  });
});
