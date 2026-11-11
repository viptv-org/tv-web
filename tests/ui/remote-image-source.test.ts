import { expect, it, vi } from "vitest";
import { clearlogoSource, configureImageDelivery, imagePixels, imageSource } from "../../src/tv-solid/remote/image-source";

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

it("opts into the public prepared clearlogo only on capable backends", () => {
  const source="https://images.metahub.space/logo/medium/tt123/img";
  configureImageDelivery(false);expect(clearlogoSource(source)).toBeUndefined();
  configureImageDelivery(true);
  expect(new URL(clearlogoSource(source)!).pathname).toBe("/api/images/clearlogo/v1/tt123.png");
  expect(clearlogoSource(imageSource(source,640))).toBe(clearlogoSource(source));
  for (const url of [source+"?token=private",source+"#private",source.replace("images.metahub.space","private.test"),
    source.replace("https://","https://user@"),source.replace("tt123","other")])
    expect(clearlogoSource(url)).toBeUndefined();
  configureImageDelivery(false);
});

it("requests the physical stage pixels instead of doubling every TV image", () => {
  const width=Object.getOwnPropertyDescriptor(window,"innerWidth")!,height=Object.getOwnPropertyDescriptor(window,"innerHeight")!;
  try {
    Object.defineProperty(window,"innerWidth",{value:1280,configurable:true});Object.defineProperty(window,"innerHeight",{value:720,configurable:true});
    expect(imagePixels(1920)).toBe(1280);expect(imagePixels(255.2)).toBe(171);
    Object.defineProperty(window,"innerWidth",{value:3840});Object.defineProperty(window,"innerHeight",{value:2160});
    expect(imagePixels(255.2)).toBe(511);
  } finally {Object.defineProperty(window,"innerWidth",width);Object.defineProperty(window,"innerHeight",height);}
});

it("resizes the known public Simkl proxy while leaving account images private", () => {
  vi.stubGlobal("location",new URL("https://tv.example.com/tv/"));
  try {
    const publicImage="https://tv.example.com/api/images/simkl/posters/11/abc_m.webp";
    const resized=new URL(imageSource(publicImage,255,383));
    expect(resized.hostname).toBe("wsrv.nl");expect(resized.searchParams.get("url")).toBe(publicImage);
    expect(resized.searchParams.get("w")).toBe("255");expect(resized.searchParams.get("h")).toBe("383");
    for(const url of [publicImage+"?signature=private","https://tv.example.com/api/profiles/1/avatar","https://tv.example.com/api/images/private/11/abc_m.webp"])
      expect(imageSource(url,255)).toBe(url);
  } finally {vi.unstubAllGlobals();}
});


it("blurs public backdrops at the proxy and preserves blur through native sizing", () => {
  const source="https://image.tmdb.org/t/p/original/backdrop.jpg";
  const blurred=new URL(imageSource(source,1920,1080,"cover",16));
  expect(blurred.hostname).toBe("wsrv.nl");expect(blurred.searchParams.get("blur")).toBe("16");
  expect(blurred.searchParams.get("url")).toBe(source);
  const native=new URL(imageSource(blurred.toString(),1920,1080));
  expect(native.searchParams.get("blur")).toBe("16");expect(native.searchParams.get("url")).toBe(source);
  expect(new URL(imageSource(source,240,360)).searchParams.has("blur")).toBe(false);
  expect(new URL(imageSource(blurred.toString(),1920,1080,"cover",0)).searchParams.has("blur")).toBe(false);
  const privateImage=new URL("/api/profiles/1/avatar?signature=private",location.href).toString();
  expect(imageSource(privateImage,240,360,"cover",16)).toBe(privateImage);
});
