import { expect, it, vi } from "vitest";
import { NativeSync, motionRoot, opacityWithin } from "../../src/tv-solid/platform/native-sync";

it("only visits affected visuals and follows a 60 Hz transform stream", () => {
  const sync = new NativeSync(() => 0);
  const parent = { alpha: 0.5, children: [] as any[] };
  const child = { alpha: 1, parentNode: parent }, unrelated = { alpha: 1 };
  parent.children.push(child);
  const moved = vi.fn(), still = vi.fn();
  sync.register(child, moved); sync.register(unrelated, still); sync.flush(1);
  moved.mockClear(); still.mockClear();
  for (let frame = 0; frame < 60; frame++) { sync.mark(parent); sync.flush(1); }
  expect(moved).toHaveBeenCalledTimes(60);
  expect(moved).toHaveBeenLastCalledWith(0.5);
  expect(still).not.toHaveBeenCalled();
});

it("resumes budgeted work and retains changes arriving during a pending batch", () => {
  let now = 0;
  const sync = new NativeSync(() => now), parent = { alpha: 1, children: [] as any[] };
  const observed: number[] = [];
  for (let i = 0; i < 20; i++) {
    const node = { parentNode: parent };
    parent.children.push(node);
    sync.register(node, alpha => { now++; observed.push(alpha); });
  }
  sync.mark(parent);
  expect(sync.flush(8)).toBe(true);
  expect(observed).toHaveLength(8);
  parent.alpha = 0.5; sync.mark(parent);
  while (sync.pending) sync.flush(now + 8);
  expect(observed.slice(-20)).toEqual(Array(20).fill(0.5));
});

it("does not enqueue detached holders or synchronize removed records", () => {
  const sync = new NativeSync(() => 0), node = {}, callback = vi.fn();
  sync.register(node, callback); sync.remove(node);
  sync.mark({ detachedVisualHolder: true });
  expect(sync.pending).toBe(false);
});

it("hides detached chrome records through their unchanged logical visibility parent", () => {
  const sync = new NativeSync(() => 0), group = {alpha: 1, children: [] as any[]};
  const ring = {alpha: 1, parentNode: group}, chromeHolder = {alpha: 1};
  group.children.push(ring);
  sync.register(ring, inherited => { chromeHolder.alpha = inherited * ring.alpha; });
  for (const alpha of [1, 0, 1, 0]) {
    group.alpha = alpha; sync.mark(group); sync.flush(1);
    expect(chromeHolder.alpha).toBe(alpha);
  }
});

it("moves a container as one layer group without multiplying its opacity into each child", () => {
  const root = { alpha: 0.5, nativeMotionRoot: true };
  const parent = { alpha: 0.4, nativeMotionRoot: true, parentNode: root };
  const node = { alpha: 0.5, parentNode: parent };
  expect(motionRoot(node)).toBe(parent);
  expect(motionRoot(parent.parentNode!)).toBe(root);
  expect(opacityWithin(node, root)).toBeCloseTo(0.2);
  expect(opacityWithin(root, root)).toBe(1);
});

it("updates a moving layer group without resubmitting its stationary children", () => {
  const sync = new NativeSync(() => 0), root = { alpha: 1, children: [] as any[] };
  const group = vi.fn(), image = vi.fn();
  const child = { parentNode: root };
  root.children.push(child);
  sync.register(root, group); sync.register(child, image); sync.flush(1);
  group.mockClear(); image.mockClear();
  for (let frame = 0; frame < 60; frame++) { sync.markShallow(root); sync.flush(1); }
  expect(group).toHaveBeenCalledTimes(60);
  expect(image).not.toHaveBeenCalled();
});

it("separates modal paint scopes from a shared outer motion transform", async () => {
  const { modalRoot } = await import("../../src/tv-solid/platform/native-sync");
  const page = { nativeMotionRoot: true };
  const panel = { parentNode: page, nativeModal: false };
  const label = { parentNode: panel, nativeModal: true };
  expect(modalRoot(label)).toBe(label);
  panel.nativeModal = true;
  expect(modalRoot(label)).toBe(panel);
  const error = { parentNode: page, nativeModal: true };
  expect(modalRoot(error)).toBe(error);
});
