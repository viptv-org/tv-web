/** @jsxImportSource @solidtv/solid */
import { createSignal, onCleanup, onMount } from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { ImageTexture, RendererMain, ShaderNode } from "@solidtv/renderer";
import { TvView } from "../runtime";
import { registerTvShader } from "../shaders";
import { rendererStart } from "../renderer-clock";
import { entryArt } from "./entry-art";
import { welcomeShader } from "./welcome-shader";
import { NativeWelcomeWall } from "../platform/welcome-wall";
const registered = new WeakSet<RendererMain>();

/** One bounded wall texture keeps forty tile transforms off each frame.
 * Reference artwork is painted once at its native 236×354 display size.
 */
function BrowserPosterWall() {
  const renderer = getRenderer() as RendererMain,
    [wall, setWall] = createSignal<ImageTexture>();
  const canvasMode = renderer.getCapabilities().renderMode === ("canvas" as string);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const name = reduced ? "tvWelcomeStatic" : "tvWelcomeMotion";
  if (!canvasMode && !registered.has(renderer)) {
    registerTvShader(renderer, "tvWelcomeStatic", welcomeShader);
    registerTvShader(renderer, "tvWelcomeMotion", {
      ...welcomeShader,
      time: true,
    });
    registered.add(renderer);
  }
  // u_time is the renderer's elapsed time in 2.0; the drift starts at 0.
  const shader = canvasMode ? undefined : renderer.createShader(name, {
    startedAt: reduced ? 0 : performance.now() - rendererStart(renderer),
  }) as ShaderNode;
  let active = true;
  // The wall drifts on a time-uniform, which never creates a scene update, so
  // the renderer's idle pass would freeze it after the texture settles. While
  // the motion shader is mounted, request a frame each rAF so the drift stays
  // live; cleanup stops it the moment the wall leaves the screen.
  if (!reduced && !canvasMode) {
    let frame = 0;
    const drive = () => {
      if (!active) return;
      renderer.requestRender();
      frame = requestAnimationFrame(drive);
    };
    frame = requestAnimationFrame(drive);
    onCleanup(() => cancelAnimationFrame(frame));
  }
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
      ctx.rect(x, y, 236, 354);
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
    let pixels: ImageData;
    if (canvasMode) {
      const composed = document.createElement("canvas");
      composed.width = 1920;composed.height = 1080;
      const paint = composed.getContext("2d")!;
      paint.fillStyle = "#0b0b0c";paint.fillRect(0, 0, 1920, 1080);
      paint.globalAlpha = 0.32;
      paint.drawImage(canvas, 60, 100, 1920, 1080, 0, 0, 1920, 1080);
      paint.globalAlpha = 1;
      paint.translate(960, 540);paint.scale(1152, 756);
      const vignette = paint.createRadialGradient(0, 0, 0, 0, 0, 1);
      vignette.addColorStop(0, "rgba(11,11,12,.92)");vignette.addColorStop(.55, "rgba(11,11,12,.75)");vignette.addColorStop(1, "rgba(11,11,12,.45)");
      paint.fillStyle = vignette;paint.fillRect(-960/1152, -540/756, 1920/1152, 1080/756);
      pixels = paint.getImageData(0, 0, 1920, 1080);
    } else pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const texture = renderer.createTexture("ImageTexture", {
      src: pixels,
      key: canvasMode ? "tv-welcome-wall-canvas-v1" : "tv-welcome-wall-v1",
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

/** The browser wall uses a canvas texture and the shader; the Roku host draws
 * the packaged poster grid and scrim with native Posters. */
export function PosterWall() {
  return typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined"
    ? NativeWelcomeWall()
    : BrowserPosterWall();
}
