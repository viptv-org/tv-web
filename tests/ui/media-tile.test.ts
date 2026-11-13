import { afterAll, afterEach, expect, it, vi } from "vitest";
import { createComponent, createRoot, createSignal } from "solid-js";
import type { Card } from "../../src/tv-solid/remote/types";

type SceneNode = { kind: string; props: Record<string, any>; children: SceneNode[] };
const graphics = vi.hoisted(() => {
  (globalThis as any).__SolidTVRokuRenderer = {};
  return { nodes: [] as SceneNode[], create: undefined as ((kind: string, props: Record<string, any>) => SceneNode) | undefined };
});
vi.mock("@solidtv/solid", async () => {
  const solid = await import("solid-js");
  return { ...solid, memo: solid.createMemo, effect: solid.createRenderEffect };
});
vi.mock("../../src/tv-solid/runtime", async () => {
  const solid = await import("solid-js");
  const resolve = (value: any): SceneNode[] => typeof value === "function" ? resolve(value())
    : Array.isArray(value) ? value.flatMap(resolve) : value?.kind ? [value] : [];
  graphics.create = (kind, props) => {
    const node: SceneNode = { kind, props, children: [] };
    graphics.nodes.push(node);
    const children = solid.untrack(() => props.children);
    solid.createRenderEffect(() => { node.children = resolve(children); });
    return node;
  };
  return {
    TvView: (props: Record<string, any>) => graphics.create!("view", props),
    KeyedFor: (props: any) => solid.createComponent(solid.For, {
      get each() { return props.each; },
      children: (value: any, index: () => number) => props.children(() => value, index),
    }),
  };
});
vi.mock("../../src/tv-solid/remote/visuals", () => ({
  palette: { surface: "#161618", text: "#F4F2EE", muted: "#B6B4AF", accent: "#F5C542" },
  Label: (props: Record<string, any>) => graphics.create!("label", props),
  Logo: (props: Record<string, any>) => graphics.create!("logo", props),
  icon: () => "/icon.svg",
  cardOutline: () => "/outline.svg",
}));
vi.mock("../../src/tv-solid/remote/text-measure", () => ({
  sdfTextMetrics: () => ({ measureText: (value: string) => ({ width: value.length * 10 }) }),
}));
import { MediaTile } from "../../src/tv-solid/remote/MediaTile";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(dispose => dispose()); graphics.nodes.length = 0; });
afterAll(() => { delete (globalThis as any).__SolidTVRokuRenderer; });
const episode = (extra: Partial<Card> = {}): Card => ({
  identity: {kind: "series", id: "tt0988824:4:1", ids: [], episode: {order: "aired", season: 4, episode: 1}},
  provider_id: "addon:10", title: "The Quietly Approaching Threat", badges: [],
  poster: null, logo: null, landscape: null, progress: null, view: {saved: false, progress: null}, ...extra,
});
function mount(card: Card, focused = false) {
  const [value, setCard] = createSignal(card), [focus, setFocus] = createSignal(focused);
  let root!: SceneNode;
  createRoot(dispose => {
    cleanups.push(dispose);
    root = createComponent(MediaTile, {
      get card() { return value(); }, get focused() { return focus(); }, x: 0, y: 0, w: 414, h: 233,
    }) as unknown as SceneNode;
  });
  return { root, setCard, setFocus };
}
function visible(node: SceneNode): SceneNode[] {
  return node.props.show === false || node.props.alpha === 0 ? [] : [node, ...node.children.flatMap(visible)];
}
const titles = (root: SceneNode, value: string) => visible(root).filter(node => node.kind === "label" && node.props.content === value);
const imageNodes = () => graphics.nodes.filter(node => typeof node.props.src === "string" && node.props.src.includes("/episode-art/"));
const latestImage = () => { const nodes = imageNodes(); return nodes[nodes.length - 1]!; };

it("keeps one landscape caption for absent and failed episode artwork", () => {
  const card = episode(), scene = mount(card, true);
  expect(titles(scene.root, card.title)).toHaveLength(1);
  scene.setCard(episode({landscape: "/episode-art/missing.jpg"}));
  latestImage().props.onError();
  expect(titles(scene.root, card.title)).toHaveLength(1);
});

it("does not retry a failed image when the same episode is reprojected with the same image URL", () => {
  const card = episode({landscape: "/episode-art/missing.jpg"}), scene = mount(card);
  latestImage().props.onError();
  const requests = imageNodes().length;
  scene.setCard({...card, subtitle: "Updated metadata", progress: .05236978860202954});
  expect(imageNodes()).toHaveLength(requests);
  scene.setFocus(true);
  expect(imageNodes()).toHaveLength(requests);
  expect(titles(scene.root, card.title)).toHaveLength(1);
  scene.setCard({...card, landscape: "/episode-art/replacement.jpg"});
  expect(latestImage().props.src).toContain("replacement.jpg");
});

it("renders only authoritative positive progress independently from focus and failed artwork", () => {
  for (const progress of [null, 0, .05236978860202954]) {
    const card = episode({landscape: "/episode-art/missing.jpg", progress, view: {saved: false, progress}});
    const scene = mount(card);
    const bars = () => visible(scene.root).filter(node => node.props.color === "#F5C542");
    expect(bars()).toHaveLength(progress ? 1 : 0);
    latestImage().props.onError();
    scene.setFocus(true);
    expect(bars()).toHaveLength(progress ? 1 : 0);
    if (progress) expect(bars()[0].props.w).toBeCloseTo((414 - 6) * progress);
    expect(visible(scene.root).filter(node => node.props.focusRing)).toHaveLength(4);
    scene.setFocus(false);
    expect(bars()).toHaveLength(progress ? 1 : 0);
  }
});
