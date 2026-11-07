import { expect, it, vi } from "vitest";
const host = vi.hoisted(() => ({ videos: [] as any[] }));
vi.mock("@roku-sdk/solid", () => ({
  createElement: (type: string) => { const node: any = { t: type, r: {}, props: {} }; if (type === "video") host.videos.push(node); return node; },
  insertNode: vi.fn(),
  setProp: (node: any, key: string, value: any) => { node.props[key] = value; if (key === "url" && value) host.videos[host.videos.length - 1]?.props.onState?.("buffering");
    if (node.t === "video" && key === "control" && (value === "play" || value === "pause")) node.props.onState?.(value === "play" ? "playing" : "paused"); },
  tmTransaction: { removeNode: vi.fn() },
}));
vi.mock("../src/roku/worker-task", () => ({ postRokuTask: () => ({ result: Promise.resolve("Off"), cancel: vi.fn() }) }));
import * as video from "../src/roku/video";
it("ignores segment and error callbacks from a retired native Video node", async () => {
  (globalThis as any).__viptvVideoLayer = { r: {}, t: "group" };
  await video.init();
  const old = host.videos[0];
  await video.destroy(); await video.init();
  old.props.onDownloadedSegment({ Status: 0, SegStart: 0, SegDuration: 4000, SegType: 0 });
  old.props.onErrorMsg("Retired decoder");
  expect(video.playbackStats()).toMatchObject({ state: "loading", segmentEvents: 0, lastSegment: null });
  await video.destroy();
  delete (globalThis as any).__viptvVideoLayer;
});

it("restores the system caption mode after a server-selected caption stream", async () => {
  (globalThis as any).__viptvVideoLayer = { r: {}, t: "group" };
  await video.init();
  await video.load({ streamUrl: "https://media.example/index.m3u8", captionsEnabled: true });
  const node = host.videos[host.videos.length - 1];
  expect(node.props.globalCaptionMode).toBe("On");
  expect(node.props.suppressCaptions).toBe(false);
  await video.destroy();
  expect(node.props.globalCaptionMode).toBe("Off");
  delete (globalThis as any).__viptvVideoLayer;
});

it("warms a paused stream muted, then confirms a real native pause", async () => {
  (globalThis as any).__viptvVideoLayer = { r: {}, t: "group" };
  await video.init();
  await video.load({ streamUrl: "https://media.example/index.m3u8", paused: true });
  const node = host.videos[host.videos.length - 1];
  expect(video.playbackStats().state).toBe("paused");
  expect(node.props.control).toBe("pause");
  expect(node.props.mute).toBe(false);
  expect(node.props.autoplayAfterSeek).toBe(false);
  await video.destroy();delete (globalThis as any).__viptvVideoLayer;
});

it("keeps SDK time in milliseconds for short initial HLS windows", async () => {
  (globalThis as any).__viptvVideoLayer = { r: {}, t: "group" };
  await video.init();const node = host.videos[host.videos.length - 1];
  node.props.onDuration(9000);node.props.onPosition(1000);
  expect(video.playbackStats()).toMatchObject({ duration: 9, position: 1 });
  node.props.onDuration(61000);node.props.onPosition(2000);
  expect(video.playbackStats()).toMatchObject({ duration: 61, position: 2 });
  await video.destroy();delete (globalThis as any).__viptvVideoLayer;
});
