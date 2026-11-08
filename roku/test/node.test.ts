import { afterEach, beforeEach, expect, it, vi } from "vitest";

const graphics = vi.hoisted(() => ({ nodes: [] as any[], writes: [] as { node: any; name: string; value: any }[] }));
vi.mock("@roku-sdk/solid", () => ({
  createElement: (type: string) => {
    const node = { type, children: [] as any[], parent: null as any };
    graphics.nodes.push(node); return node;
  },
  insertNode: (parent: any, node: any) => { parent.children.push(node); node.parent = parent; },
  setProp: (node: any, name: string, value: any) => {
    graphics.writes.push({ node, name, value }); node[name] = value;
  },
  tmTransaction: { removeNode: (parent: any, node: any) => {
    parent.children = parent.children.filter((child: any) => child !== node); node.parent = null;
  } },
}));
vi.mock("../src/roku/fonts", () => ({ getFontVersion: () => 0 }));
import { RokuNode } from "../src/roku/node";

const renderer = { markDirty: vi.fn(), animator: { removeFor: vi.fn() } };
beforeEach(() => { graphics.nodes.length = 0; graphics.writes.length = 0; });
afterEach(() => vi.useRealTimers());

it("transfers a Poster to the layer bridge without constructing or submitting another image", () => {
  const node = new RokuNode(renderer, { w: 400, h: 225, src: "https://example.test/image.jpg" });
  node.flush();
  const poster = graphics.nodes.find(n => n.type === "poster");
  const claimed = node.claimVisual("poster");
  expect(claimed).toBe(poster);
  node.loadImage(claimed, node.src, 400, 225);
  node.x = 12; node.flush();
  expect(graphics.nodes.filter(n => n.type === "poster")).toHaveLength(1);
  expect(graphics.writes.filter(w => w.name === "uri")).toHaveLength(1);
  expect(node.visual).toBeNull();
  expect(node.nativeVisual).toBe(poster);
  expect(poster.loadWidth).toBe(400);
  expect(poster.loadHeight).toBe(225);
  node.destroy();
});

it("does not report decoded imagery when no native status arrives", () => {
  vi.useFakeTimers();
  const node = new RokuNode(renderer, { w: 400, h: 225, src: "https://example.test/slow.jpg" });
  const loaded = vi.fn();
  node.on("loaded", loaded); node.flush();
  vi.advanceTimersByTime(2000);
  expect(loaded).not.toHaveBeenCalled();
  graphics.nodes.find(n => n.type === "poster").onLoadStatus("ready");
  expect(loaded).toHaveBeenCalledOnce();
  node.destroy();
});
