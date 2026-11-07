/** @jsxImportSource @solidtv/solid */
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import {
  bottomScrimGradient,
  browseWideScrimGradient,
  Label,
  Logo,
  NativeBackdrop,
  palette,
} from "./visuals";
import { imageSource } from "./image-source";
import { TitleMetadata } from "./TitleMetadata";
import { sdfTextMetrics } from "./text-measure";
import type { Card } from "./types";
type Frame = {
  id: number;
  src: string;
  width: number;
  height: number;
  ambient?: ImageData;
  plane?: ImageData;
};
function ambientArtwork(image: HTMLImageElement): ImageData | undefined {
  const output = document.createElement("canvas");
  output.width = 480;
  output.height = 270;
  try {
    const context = output.getContext("2d");
    if (!context) return undefined;
    const scale = Math.max(480 / image.naturalWidth, 270 / image.naturalHeight),
      width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    const filtered = context as CanvasRenderingContext2D & {
      filter?: string;
    };
    if (filtered.filter !== undefined) {
      filtered.filter = "blur(26px)";
      context.drawImage(
        image,
        (480 - width) / 2,
        (270 - height) / 2,
        width,
        height,
      );
      filtered.filter = "none";
    } else {
      const source = document.createElement("canvas");
      source.width = 60;
      source.height = 34;
      const small = source.getContext("2d");
      if (!small) return undefined;
      const smallScale = Math.max(
        60 / image.naturalWidth,
        34 / image.naturalHeight,
      );
      small.drawImage(
        image,
        (60 - image.naturalWidth * smallScale) / 2,
        (34 - image.naturalHeight * smallScale) / 2,
        image.naturalWidth * smallScale,
        image.naturalHeight * smallScale,
      );
      context.imageSmoothingEnabled = true;
      context.drawImage(source, 0, 0, 480, 270);
      source.width = source.height = 0;
    }
    return context.getImageData(0, 0, 480, 270);
  } catch {
    return undefined;
  } finally {
    output.width = output.height = 0;
  }
}
/** The sharp landscape plane, pre-masked at its left edge. The renderer's
 * custom shader path is not dependable on every TV browser, so the fade is
 * baked into the texture: the plane starts transparent and becomes fully
 * opaque over its left 560 logical pixels, revealing the blurred ambient
 * artwork underneath instead of a hard vertical seam. */
function landscapePlane(image: HTMLImageElement): ImageData | undefined {
  const width = 580,
    height = 310,
    output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  try {
    const context = output.getContext("2d");
    if (!context) return undefined;
    const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight,
      ),
      drawWidth = image.naturalWidth * scale,
      drawHeight = image.naturalHeight * scale;
    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    const mask = context.createLinearGradient(0, 0, width, 0);
    mask.addColorStop(0, "rgba(0,0,0,0)");
    mask.addColorStop(0.15, "rgba(0,0,0,.25)");
    mask.addColorStop(0.48, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,1)");
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = mask;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    return context.getImageData(0, 0, width, height);
  } catch {
    return undefined;
  } finally {
    output.width = output.height = 0;
  }
}
function Artwork(props: { frame: Frame; alpha: number; portrait: boolean }) {
  return (
    <>
      <Show when={props.frame.ambient}>
        {(ambient) => (
          <TvView
            w={1920}
            h={620}
            src={ambient()}
            fit="cover"
            alpha={(props.portrait ? 0.45 : 0.6) * props.alpha}
          />
        )}
      </Show>
      <TvView
        w={1920}
        h={620}
        src={browseWideScrimGradient()}
        fit="cover"
        alpha={props.portrait ? 0.65 : 1}
      />
      <Show when={!props.portrait}>
        <TvView
          x={760}
          w={1160}
          h={620}
          src={props.frame.plane ?? props.frame.src}
          alpha={props.alpha}
          transition={{
            alpha: { duration: 300, timingFunction: "cubic-bezier(.2,0,0,1)" },
          }}
        />
      </Show>
      <Show when={props.portrait}>
        <TvView
          x={1520}
          y={96}
          w={280}
          h={420}
          src={props.frame.src}
          fit="cover"
          alpha={props.alpha}
          transition={{
            alpha: { duration: 300, timingFunction: "cubic-bezier(.2,0,0,1)" },
          }}
        />
      </Show>
      <TvView
        y={380}
        w={1920}
        h={240}
        src={bottomScrimGradient()}
        fit="cover"
        alpha={props.alpha}
      />
    </>
  );
}
export function BrowseBackdrop(props: {
  card?: Card | null;
  portrait?: boolean;
}) {
  if (typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined") {
    // SceneGraph gets the raw poster; the browser's ambient/masked canvas
    // planes cannot be uploaded. Keep the packaged scrim for legibility.
    const background = () =>
      props.portrait
        ? (props.card?.landscape ?? props.card?.poster)
        : (props.card?.view?.preview?.background ??
          props.card?.landscape ??
          props.card?.poster);
    return (
      <NativeBackdrop src={background()}>
        <Show when={props.portrait && props.card?.poster}>
          <TvView
            x={1520}
            y={96}
            w={280}
            h={420}
            src={imageSource(props.card!.poster!, 560)}
            fit="cover"
          />
        </Show>
      </NativeBackdrop>
    );
  }
  const [frames, setFrames] = createSignal<Frame[]>([]),
    [visible, setVisible] = createSignal(true);
  let serial = 0;
  const selected = createMemo(() =>
    props.portrait
      ? (props.card?.poster ?? props.card?.landscape)
      : (props.card?.view?.preview?.background ??
        props.card?.landscape ??
        props.card?.poster),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  createEffect(() => {
    const src = selected();
    let cancelled = false,
      raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadSrc = src ? imageSource(src, 1160) : undefined;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      if (!image.naturalWidth || !image.naturalHeight) {
        setFrames([]);
        return;
      }
      const next = {
          id: ++serial,
          src: loadSrc!,
          width: image.naturalWidth,
          height: image.naturalHeight,
          ambient: ambientArtwork(image),
          plane: landscapePlane(image),
        },
        previous = frames().slice(-1),
        fade = !reduced && previous.length > 0;
      batch(() => {
        setVisible(!fade);
        setFrames(fade ? [...previous, next] : [next]);
      });
      if (fade) {
        raf = requestAnimationFrame(() => setVisible(true));
        timer = setTimeout(() => setFrames([next]), 350);
      }
    };
    image.onerror = () => {
      if (!cancelled) setFrames([]);
    };
    if (loadSrc) image.src = loadSrc;
    else setFrames([]);
    onCleanup(() => {
      cancelled = true;
      image.onload = image.onerror = null;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    });
  });
  return (
    <TvView w={1920} h={1080} color={palette.bg}>
      <KeyedFor each={frames()} keyOf={(frame) => frame.id}>
        {(frame, i) => (
          <Artwork
            frame={frame()}
            portrait={!!props.portrait}
            alpha={i() === frames().length - 1 ? (visible() ? 1 : 0) : 1}
          />
        )}
      </KeyedFor>
    </TvView>
  );
}
export function BrowsePreview(props: { card: Card; summaryBottom?: number }) {
  /** The summary sits in the space between the navigation and the focused
   * row's shelf, not pinned to the top of a full-screen backdrop. */
  const summaryY = () => {
    const bottom = props.summaryBottom ?? 690,
      body = 310;
    return Math.max(96, 132 + Math.max(0, bottom - 40 - 132 - body) / 2);
  };
  const titleY = () => {
    const width = sdfTextMetrics("48px Onest700").measureText(
      props.card.title ?? "",
    ).width;
    const lines = Math.min(2, Math.max(1, Math.ceil(width / 1000)));
    return 120 - lines * 57.6;
  };
  return (
    <TvView x={96} y={summaryY()}>
      <Show
        when={props.card.logo}
        fallback={
          <Label
            y={titleY()}
            size={48}
            font="Onest700"
            lineheight={1.2}
            maxwidth={1000}
            maxlines={2}
            content={props.card.title}
          />
        }
      >
        <Logo
          src={props.card.logo!}
          w={420}
          h={120}
          title={props.card.title}
          size={44}
          boxH={120}
        />
      </Show>
      <TitleMetadata card={props.card} y={144} detail />
      <Label
        y={194}
        size={26}
        lineheight={1.45}
        maxwidth={700}
        maxlines={3}
        color={palette.body}
        content={props.card.description ?? ""}
      />
    </TvView>
  );
}
