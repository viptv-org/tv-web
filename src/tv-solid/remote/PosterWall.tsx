/** @jsxImportSource @solidtv/solid */
import { createSignal, onCleanup, onMount } from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { ImageTexture, Stage } from "@solidtv/renderer";
import type { WebGlShaderNode } from "@solidtv/renderer/webgl";
import { TvView } from "../runtime";
import { entryArt } from "./entry-art";
import { welcomeShader } from "./welcome-shader";
const registered = new WeakSet<Stage>();

/** One bounded wall texture keeps forty tile transforms off each frame.
 * Reference artwork is painted once at its native 236×354 display size.
 */
export function PosterWall() {
  const renderer = getRenderer(),
    [wall, setWall] = createSignal<ImageTexture>();
  const stage = renderer.stage as Stage;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const name = reduced ? "tvWelcomeStatic" : "tvWelcomeMotion";
  if (!registered.has(stage)) {
    stage.shManager.registerShaderType("tvWelcomeStatic", welcomeShader);
    stage.shManager.registerShaderType("tvWelcomeMotion", {
      ...welcomeShader,
      time: true,
    });
    registered.add(stage);
  }
  const shader = renderer.createShader(name, {}) as WebGlShaderNode;
  // Static uniforms are installed once. A continuously changing shader prop
  // would retain a value-cache entry for every animation frame in renderer 1.9.4.
  shader.uniform1f(
    "u_startedAt",
    reduced ? 0 : performance.now() - stage.startTime,
  );
  let active = true;
  onCleanup(() => {
    active = false;
  });
  onMount(async () => {
    const sources = [...new Set(entryArt.slice(0, 40))];
    const images = await Promise.all(
      sources.map(
        (src) =>
          new Promise<HTMLImageElement | undefined>((resolve) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(undefined);
            image.src = src;
          }),
      ),
    );
    if (!active) return;
    const canvas = document.createElement("canvas");
    canvas.width = 2520;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 40; i++) {
      const image = images[sources.indexOf(entryArt[i])];
      if (!image) continue;
      const x = (i % 10) * 252,
        y = Math.floor(i / 10) * 372;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + 10, y);
      ctx.arcTo(x + 236, y, x + 236, y + 354, 10);
      ctx.arcTo(x + 236, y + 354, x, y + 354, 10);
      ctx.arcTo(x, y + 354, x, y, 10);
      ctx.arcTo(x, y, x + 236, y, 10);
      ctx.clip();
      const scale = Math.max(
          236 / image.naturalWidth,
          354 / image.naturalHeight,
        ),
        w = 236 / scale,
        h = 354 / scale;
      ctx.drawImage(
        image,
        (image.naturalWidth - w) / 2,
        (image.naturalHeight - h) / 2,
        w,
        h,
        x,
        y,
        236,
        354,
      );
      ctx.restore();
    }
    const texture = renderer.createTexture("ImageTexture", {
      src: ctx.getImageData(0, 0, canvas.width, canvas.height),
      key: "tv-welcome-wall-v1",
      premultiplyAlpha: true,
    });
    setWall(texture);
    canvas.width = canvas.height = 0;
  });
  return (
    <TvView
      w={1920}
      h={1080}
      texture={wall()}
      shader={shader}
      color={wall() ? "#FFFFFF" : "rgba(0,0,0,0)"}
    />
  );
}
