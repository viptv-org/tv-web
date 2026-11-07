import { expect, it } from "vitest";
import { imageSource } from "../../src/tv-solid/remote/image-source";

it("resizes existing proxy requests to the slot without nesting or losing source parameters", () => {
  const asset = "https://image.tmdb.org/t/p/original/image.png?token=fixture&part=2";
  const existing = new URL("https://wsrv.nl/");
  existing.searchParams.set("url", asset);
  existing.searchParams.set("w", "1920"); existing.searchParams.set("h", "1080");
  existing.searchParams.set("output", "png"); existing.searchParams.set("q", "82");
  existing.searchParams.set("dpr", "2");
  const card = new URL(imageSource(existing.toString(), 510));
  expect(card.searchParams.get("url")).toBe(asset);
  expect(card.searchParams.get("w")).toBe("510");
  expect(card.searchParams.has("h")).toBe(false);
  expect(card.searchParams.has("dpr")).toBe(false);
  expect(card.searchParams.get("output")).toBe("png");
  expect(card.searchParams.get("q")).toBe("82");
  expect(imageSource(existing.toString(), 1920)).not.toBe(card.toString());
});

it("keeps authenticated and same-origin image URLs intact", () => {
  const sameOrigin = new URL("/api/images/posters/image.jpg?signature=fixture", location.href).toString();
  expect(imageSource(sameOrigin, 510)).toBe(sameOrigin);
  const privateImage = "https://private.example.test/image.jpg?signature=fixture";
  expect(imageSource(privateImage, 510)).toBe(privateImage);
});
