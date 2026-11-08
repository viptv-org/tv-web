import { expect, it, vi } from "vitest";
import { PosterImage } from "../../roku/src/roku/poster-image";

function setup(poster: Record<string, any> = {}) {
  const writes: string[] = [], publish = vi.fn();
  const image = new PosterImage(poster, (name, value) => { writes.push(name); poster[name] = value; }, publish);
  return { image, poster, writes, publish };
}

it("sets decode bounds before the URI and waits for native acknowledgement", () => {
  const { image, poster, writes, publish } = setup();
  image.load("https://example.test/image.jpg", 400, 225);
  expect(writes.indexOf("loadWidth")).toBeLessThan(writes.indexOf("uri"));
  expect(writes.indexOf("loadHeight")).toBeLessThan(writes.indexOf("uri"));
  expect(publish).not.toHaveBeenCalled();
  poster.onLoadStatus("loading");
  expect(publish).not.toHaveBeenCalled();
  poster.onLoadStatus("ready"); poster.onLoadStatus("ready");
  expect(publish).toHaveBeenCalledExactlyOnceWith("loaded");
  expect(image.ready).toBe(true);
});

it("rejects stale completions and never turns failures into successful loads", () => {
  const { image, poster, publish } = setup();
  image.load("first.jpg", 400, 225);
  const oldStatus = poster.onLoadStatus;
  image.load("second.jpg", 400, 225);
  oldStatus("ready");
  expect(publish).not.toHaveBeenCalled();
  poster.onLoadStatus("failed");
  expect(publish).toHaveBeenCalledExactlyOnceWith("failed");
  expect(image.ready).toBe(false);
  image.invalidate(); poster.onLoadStatus("ready");
  expect(publish).toHaveBeenCalledTimes(1);
});

it("acknowledges an already loaded matching bitmap without inventing a timeout", () => {
  const { image, publish } = setup({ uri: "cached.jpg", loadStatus: "ready", bitmapWidth: 400, bitmapHeight: 225 });
  image.load("cached.jpg", 400, 225);
  expect(publish).toHaveBeenCalledExactlyOnceWith("loaded");
});

it("keeps compact packaged masks at their original decode size", () => {
  const { image, poster } = setup();
  image.load("pkg:/assets/hero-scrim.png", 1920, 1080);
  expect(poster.loadWidth).toBe(0);
  expect(poster.loadHeight).toBe(0);
});

it("accepts native events from opaque SDK handles which do not mirror assigned properties", () => {
  const poster: Record<string, any> = {}, handlers: Record<string, any> = {}, publish = vi.fn();
  const image = new PosterImage(poster, (name, value) => { handlers[name] = value; }, publish);
  image.load("https://example.test/image.jpg", 400, 225);
  expect(poster.uri).toBeUndefined();
  handlers.onLoadStatus(3);
  expect(image.ready).toBe(true);
  expect(publish).toHaveBeenCalledWith("loaded");
  handlers.onBitmapWidth(400); handlers.onBitmapHeight(225);
  expect(poster.bitmapWidth).toBe(400);
  expect(poster.bitmapHeight).toBe(225);
});
