import { afterEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ listeners: new Set<(event: any) => void>(), load: vi.fn(), play: vi.fn() }));
vi.mock("../src/roku/video", () => ({
  subscribe: (listener: any) => { native.listeners.add(listener); return () => native.listeners.delete(listener); },
  init: vi.fn(async () => {}), load: native.load,
  play: native.play, pause: vi.fn(), seek: vi.fn(), destroy: vi.fn(async () => {}),
}));
import { RokuPlayer } from "../../src/tv-solid/platform/roku-player";
const emit = (event: any) => native.listeners.forEach(listener => listener(event));
afterEach(() => { vi.clearAllMocks(); native.listeners.clear(); });
it("rejects decoder startup failure so the caller can execute its gateway recovery", async () => {
  const player = new RokuPlayer(), seen: any[] = [];
  player.subscribe(snapshot => seen.push(snapshot));
  native.load.mockImplementationOnce(async () => {
    emit({ state: "error", position: 0, duration: 0, error: "no valid bitrates" });
  });
  await expect(player.open({ url: "https://media.example/index.m3u8", kind: "vod" })).rejects.toThrow("no valid bitrates");
  expect(seen.some(snapshot => snapshot.error)).toBe(false);
});
it("continues reporting failures after a stream has opened", async () => {
  const player = new RokuPlayer(), seen: any[] = [];
  player.subscribe(snapshot => seen.push(snapshot));
  native.load.mockResolvedValueOnce(undefined);
  await player.open({ url: "https://media.example/index.m3u8", kind: "vod" });
  emit({ state: "error", position: 4, duration: 60, error: "Source failed" });
  expect(seen[seen.length - 1].error.message).toBe("Source failed");
});

it("rejects decode errors after prebuffer without emitting a second fatal error", async () => {
  const player = new RokuPlayer(), seen: any[] = [];
  player.subscribe(snapshot => seen.push(snapshot));
  native.load.mockResolvedValueOnce(undefined);
  await player.open({ url: "https://media.example/index.m3u8", kind: "vod" });
  native.play.mockImplementationOnce(() => emit({ state: "error", position: 0, duration: 0, error: "Decode failed" }));
  await expect(player.play()).rejects.toThrow("Decode failed");
  expect(seen.some(snapshot => snapshot.error)).toBe(false);
});
it("waits for actual playing before completing startup", async () => {
  const player = new RokuPlayer();native.load.mockResolvedValueOnce(undefined);
  await player.open({ url: "https://media.example/index.m3u8", kind: "vod" });
  native.play.mockImplementationOnce(() => emit({ state: "playing", position: 0, duration: 60 }));
  await player.play();
  expect(player.snapshot.state).toBe("playing");
});

it("reports the known VOD end even when firmware finishes before its final clock tick",async()=>{
 const player=new RokuPlayer();native.load.mockResolvedValueOnce(undefined);
 await player.open({url:"https://media.example/index.m3u8",kind:"vod",timelineOffsetSeconds:100,timelineDurationSeconds:120});
 await player.seek(115);
 emit({state:"finished",position:19.1,duration:20});
 expect(player.snapshot.state).toBe("ended");expect(player.snapshot.time.positionSeconds).toBe(120);
});
