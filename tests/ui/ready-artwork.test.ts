import { expect, it, vi } from "vitest";
import { ReadyArtwork, type ArtworkFrame } from "../../src/tv-solid/platform/ready-artwork";

function setup() {
  let frames: ArtworkFrame[] = [], finish!: () => void;
  const fade = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const history: ArtworkFrame[][] = [];
  const art = new ReadyArtwork(value => { frames = value; history.push(value); }, fade);
  return { art, fade, frames: () => frames, history, finish: async () => { finish(); await Promise.resolve(); } };
}

it("keeps the ready image opaque until the incoming bitmap and its fade complete", async () => {
  const { art, fade, frames, finish, history } = setup();
  art.request("first");
  expect(frames()[0].alpha).toBe(0);
  art.ready(frames()[0].id);
  expect(frames()[0].alpha).toBe(1);
  art.request("second");
  expect(frames().map(f => f.alpha)).toEqual([1, 0]);
  expect(fade).not.toHaveBeenCalled();
  art.ready(frames()[1].id);
  expect(fade).toHaveBeenCalledOnce();
  expect(frames().map(f => f.src)).toEqual(["first", "second"]);
  await finish();
  expect(frames().map(f => [f.src, f.alpha])).toEqual([["second", 1]]);
  expect(Math.max(...history.map(f => f.length))).toBe(2);
});

it("ignores retired loads, retains the old image after failure, and conflates changes during a fade", async () => {
  const { art, frames, finish } = setup();
  art.request("first"); art.ready(frames()[0].id);
  art.request("retired"); const retired = frames()[1].id;
  art.request("second"); art.ready(retired);
  expect(frames().map(f => f.src)).toEqual(["first", "second"]);
  art.failed(frames()[1].id);
  expect(frames().map(f => f.src)).toEqual(["first"]);
  art.request("third"); art.ready(frames()[1].id);
  art.request("fourth"); art.request("latest");
  expect(frames().map(f => f.src)).toEqual(["first", "third"]);
  await finish();
  expect(frames().map(f => f.src)).toEqual(["third", "latest"]);
});

it("does not publish late fade completions after disposal", async () => {
  const { art, frames, finish, history } = setup();
  art.request("first"); art.ready(frames()[0].id);
  art.request("second"); art.ready(frames()[1].id);
  art.dispose(); const count = history.length;
  await finish(); art.request("ignored");
  expect(history).toHaveLength(count);
});
