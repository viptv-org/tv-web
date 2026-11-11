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
vi.mock("../src/roku/fonts", () => ({
  getFontVersion: () => 0, resolveFontUri: () => "font", fontMetrics: () => ({}),
  webLineHeight: (_family: string, _weight: string, size: number) => size,
  measureText: (_family: string, _weight: string, size: number, text: string) => text.length * size / 2,
  measureWrapText: (_family: string, _weight: string, size: number, text: string) => text.length * size / 2,
}));
import { RokuNode } from "../src/roku/node";

const renderer = { markDirty: vi.fn(), animator: { removeFor: vi.fn() } };
beforeEach(() => { graphics.nodes.length = 0; graphics.writes.length = 0; });
afterEach(() => vi.useRealTimers());

it("keeps transparent layout containers as groups without allocating painted rectangles", () => {
  const node=new RokuNode(renderer,{w:1920,h:1080,color:0});node.flush();
  expect(node.visual).toBeNull();expect(graphics.nodes.filter(n=>n.type==='rectangle')).toHaveLength(0);
  node.color=0x0b0b0cff;node.flush();expect(node.visual).not.toBeNull();
  node.color=0;node.flush();expect(node.visual).toBeNull();expect(node.dom.children).toHaveLength(0);
  node.destroy();
});

it("retains a visible gradient even when its first corner is transparent", () => {
  const node=new RokuNode(renderer,{w:400,h:225,color:0,colorBottom:0x000000ff});node.flush();
  expect(node.visual).not.toBeNull();node.destroy();
});

it("keeps a transparent visual explicitly claimed for a native border", () => {
  const node=new RokuNode(renderer,{w:400,h:225,color:0});node.flush();
  const border=node.claimVisual('rectangle');node.flush();
  expect(node.nativeVisual).toBe(border);node.destroy();
});

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


it("preserves mounted coordinates through inherited direction overrides and reparenting", () => {
  for (const a of [undefined, false, true]) for (const b of [undefined, false, true]) for (const c of [undefined, false, true]) {
    const root = new RokuNode(renderer, { x: 13, w: 1000, mountX: 0.1, rtl: a });
    const middle = new RokuNode(renderer, { x: 29, w: 400, mountX: 0.25, rtl: b });
    const leaf = new RokuNode(renderer, { x: 31, w: 80, mountX: 0.5, rtl: c });
    middle.parent = root; leaf.parent = middle;
    const rootX = 13 - 100;
    const middleRtl = b ?? a ?? false, leafRtl = c ?? middleRtl;
    const middleX = rootX + (middleRtl ? 1000 - 29 - 400 : 29) - 100;
    expect(leaf.absX).toBeCloseTo(middleX + (leafRtl ? 400 - 31 - 80 : 31) - 40);
    middle.x = 41; middle.w = 500;
    expect(leaf.absX).toBeCloseTo(rootX + (middleRtl ? 1000 - 41 - 500 : 41) - 125 + (leafRtl ? 500 - 31 - 80 : 31) - 40);
    leaf.parent = root;
    expect(leaf.absX).toBeCloseTo(rootX + ((c ?? a ?? false) ? 1000 - 31 - 80 : 31) - 40);
  }
});

it.each([undefined, false, true])("reads ancestor geometry only linearly with root direction %s", rtl => {
  let node = new RokuNode(renderer, { x: 10, w: 100, rtl });
  const nodes = [node];
  for (let i = 1; i < 12; i++) {
    const child = new RokuNode(renderer, { x: 10, w: 100 });
    child.parent = node; nodes.push(child); node = child;
  }
  let reads = 0;
  for (const item of nodes) Object.defineProperty(item, "boxW", { get: () => { reads++; return 100; } });
  expect(node.absX).toBe(rtl ? -100 : 120);
  expect(reads).toBeLessThanOrEqual(nodes.length * 2);
});


it("reuses world coordinates between geometry changes, including detached holder writes", () => {
  const root = new RokuNode(renderer, { x: 10, y: 20, w: 100, h: 80, rtl: true });
  const child = new RokuNode(renderer, { x: 5, y: 7, w: 30, h: 10, mountX: 0.5, mountY: 0.5 });
  child.parent = root;
  const holder = new RokuNode(renderer, { w: 10, h: 10 });holder.detachedVisualHolder = true;
  let reads = 0;
  Object.defineProperty(root, "boxW", { get: () => { reads++; return root.w; } });
  expect([child.absX, child.absY, child.rtlResolved]).toEqual([60, 22, true]);
  const measured = reads;
  for (let i = 0; i < 20; i++) {
    holder.x = i;holder.y = i;root.alpha = i / 20;
    expect([child.absX, child.absY, child.rtlResolved]).toEqual([60, 22, true]);
  }
  expect(reads).toBe(measured);
  root.mountX = 0.25;root.mountY = 0.5;
  expect([child.absX, child.absY]).toEqual([35, -18]);
  root.w = 200;root.h = 100;root.y = 40;
  expect([child.absX, child.absY]).toEqual([110, -8]);
  child.parent = null;
  expect([child.absX, child.absY, child.rtlResolved]).toEqual([-10, 2, false]);
  const other = new RokuNode(renderer, { x: 1000, y: 100 });
  other.insertBefore(child);
  expect([child.absX, child.absY, child.rtlResolved]).toEqual([990, 102, false]);
});

it("updates cached mounted text coordinates after real text layout changes", () => {
  vi.useFakeTimers();
  const text = new RokuNode({ ...renderer, getFontRoot: () => null }, { x: 100, y: 100, text: "a", mountX: 0.5, mountY: 0.5, fontSize: 20 }, undefined, true);
  const child = new RokuNode(renderer, { x: 2, y: 3 });child.parent = text;
  const first = [child.absX, child.absY];
  text.text = "longer";
  expect(child.absX).toBeLessThan(first[0]);
  text.fontSize = 40;
  expect(child.absY).toBeLessThan(first[1]);
  expect(child.absX).toBe(102 - text.boxW / 2);
  expect(child.absY).toBe(103 - text.boxH / 2);
  text.destroy();vi.clearAllTimers();
});

it('keeps renderer flushes from overwriting a compositor-owned axis or opacity',()=>{
  const node=new RokuNode(renderer,{x:10,y:20,w:100,h:100,compositorHolder:true});node.flush();
  graphics.writes.length=0;node.nativeMotionOwned=new Set(['y','alpha']);node.y=200;node.alpha=0.25;node.flush();
  expect(graphics.writes.filter(write=>write.name==='translation'||write.name==='opacity')).toHaveLength(0);
  node.x=30;node.flush();
  expect(graphics.writes.find(write=>write.name==='xRequest')?.value).toMatchObject({action:'snap',to:30});
  node.nativeMotionOwned.clear();node.y=250;node.flush();
  expect(graphics.writes.find(write=>write.name==='translation')?.value).toEqual([30,250]);node.destroy();
});
