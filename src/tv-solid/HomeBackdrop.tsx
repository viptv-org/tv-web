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
 * It is also the TV-042 static fallback (Sources, reduced motion, no WebGL or
 * GL failure); its soft art edges differ from TV-042's "no edge fade" wording,
 * a design follow-up recorded in TESTING.md.
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
      canvas.width = 1920; canvas.height = 950;
      const context = canvas.getContext("2d")!;
      const ground = tokens["color.bg"];
      context.fillStyle = ground;
      context.fillRect(0, 0, 1920, 950);
      if (wash) {
        context.save(); context.globalAlpha = .6; context.filter = "blur(72px)";
        cover(context, wash, 0, 0, 1920, 950); context.restore();
      }
      if (art) {
        const layer=document.createElement("canvas");layer.width=1120;layer.height=720;
        const paint=layer.getContext("2d")!;cover(paint,art,0,0,1120,720);
        paint.globalCompositeOperation="destination-in";
        const horizontal=paint.createLinearGradient(0,0,320,0);horizontal.addColorStop(0,"transparent");horizontal.addColorStop(1,"#fff");
        paint.fillStyle=horizontal;paint.fillRect(0,0,1120,720);
        const vertical=paint.createLinearGradient(0,480,0,720);vertical.addColorStop(0,"#fff");vertical.addColorStop(1,"transparent");
        paint.fillStyle=vertical;paint.fillRect(0,0,1120,720);
        context.drawImage(layer,800,0);
      }
      const left = context.createLinearGradient(0, 0, 1920, 0);
      left.addColorStop(0, ground); left.addColorStop(.5, ground + "eb"); left.addColorStop(1, "transparent");
      context.fillStyle = left; context.fillRect(0, 0, 1920, 950);
      const bottom = context.createLinearGradient(0, 440, 0, 950);
      bottom.addColorStop(0, "transparent"); bottom.addColorStop(1, ground);
      context.fillStyle = bottom; context.fillRect(0, 440, 1920, 510);
      setPixels(context.getImageData(0, 0, 1920, 950));
    });
    onCleanup(() => {
      cancelled = true;
      images.forEach(image => { image.onload = null; image.onerror = null; });
    });
  });
  return <TvView w={1920} h={950}>
    <Show when={pixels()}>{image => <TvView w={1920} h={950} src={image()} />}</Show>
  </TvView>;
}
