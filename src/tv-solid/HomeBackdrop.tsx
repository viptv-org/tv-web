/** @jsxImportSource @solidtv/solid */
import { Show, createMemo, createRenderEffect, createSignal, onCleanup } from "solid-js";
import { tokens } from "../theme/viptv-tokens.generated";
import { TvView } from "./runtime";

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sw = width / scale, sh = height / scale;
  context.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, width, height);
}

/** The pinned Home backdrop's CSS layers, composed once per artwork change.
 * Focus movement reuses the texture; it does not blur or encode images again. */
export function HomeBackdrop(props: { sharp: string; ambient: string }) {
  const [pixels, setPixels] = createSignal<ImageData>();
  const sources = createMemo(() => ({sharp:props.sharp, ambient:props.ambient}), undefined,
    {equals:(before,after)=>before.sharp===after.sharp&&before.ambient===after.ambient});
  createRenderEffect(() => {
    const {sharp, ambient} = sources();
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    const load = (src: string) => new Promise<HTMLImageElement | undefined>(resolve => {
      if (!src) { resolve(undefined); return; }
      const image = new Image();
      images.push(image);
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(undefined);
      image.src = src;
    });
    void Promise.all([load(sharp), load(ambient)]).then(([art, wash]) => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 1920; canvas.height = 1080;
      const context = canvas.getContext("2d")!;
      context.fillStyle = tokens["color.bg"];
      context.fillRect(0, 0, 1920, 1080);
      if (wash) {
        context.save();
        context.globalAlpha = 0.35;
        context.filter = `blur(${tokens["size.blur.ambient-tv"]}) saturate(1.2)`;
        cover(context, wash, 384, -216, 1728, 1296);
        context.restore();
      }
      if (art) {
        const layer = document.createElement("canvas");
        layer.width = 800; layer.height = 720;
        const sharpContext = layer.getContext("2d")!;
        cover(sharpContext, art, 0, 0, 800, 720);
        sharpContext.globalCompositeOperation = "destination-in";
        const mask = sharpContext.createLinearGradient(0, 0, 304, 0);
        mask.addColorStop(0, "transparent"); mask.addColorStop(1, "white");
        sharpContext.fillStyle = mask;
        sharpContext.fillRect(0, 0, 800, 720);
        context.drawImage(layer, 1120, 0);
      }
      const bottom = context.createLinearGradient(0, 560, 0, 924);
      bottom.addColorStop(0, "transparent"); bottom.addColorStop(1, tokens["color.bg"]);
      context.fillStyle = bottom; context.fillRect(0, 560, 1920, 520);
      const left = context.createLinearGradient(330, 0, 1100, 0);
      left.addColorStop(0, tokens["color.bg"]); left.addColorStop(1, "transparent");
      context.fillStyle = left; context.fillRect(0, 0, 1100, 1080);
      setPixels(context.getImageData(0, 0, 1920, 1080));
    });
    onCleanup(() => {
      cancelled = true;
      images.forEach(image => { image.onload = null; image.onerror = null; });
    });
  });
  return <TvView w={1920} h={1080}>
    <Show when={pixels()}>{image => <TvView w={1920} h={1080} src={image()} />}</Show>
  </TvView>;
}
