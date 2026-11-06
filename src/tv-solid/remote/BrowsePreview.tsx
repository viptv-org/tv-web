/** @jsxImportSource @solidtv/solid */
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { RendererMain, ShaderNode, WebGlShaderType } from "@solidtv/renderer";
import { sameShader } from "../shaders";
import { KeyedFor, TvView } from "../runtime";
import { registerTvShader } from "../shaders";
import { DelayedTitle, Label, Logo, palette } from "./visuals";
import { imageSource } from "./image-source";
import { TitleMetadata } from "./TitleMetadata";
import { textMetrics } from "./text-measure";
import type { Card } from "./types";
type BrowsePreviewProps = { uvSize: number[]; uvOrigin: number[] };
const shader: WebGlShaderType<BrowsePreviewProps> = {
  props: { uvSize: [1, 1], uvOrigin: [0, 0] },
  update(this: any) {
    const p = this.props as BrowsePreviewProps;
    this.uniform2fa("u_uvSize", p.uvSize);
    this.uniform2fa("u_uvOrigin", p.uvOrigin);
  },
  canBatch: sameShader,
  vertex: `
precision highp float;
attribute vec2 a_position;attribute vec2 a_nodeCoords;attribute vec4 a_color;
uniform vec2 u_resolution;uniform float u_pixelRatio;uniform vec2 u_uvOrigin;uniform vec2 u_uvSize;
varying vec2 v_uv;varying vec2 v_local;varying vec4 v_color;
void main(){v_uv=u_uvOrigin+a_nodeCoords*u_uvSize;v_local=a_nodeCoords;v_color=a_color;gl_Position=vec4(a_position*u_pixelRatio*vec2(2.0/u_resolution.x,-2.0/u_resolution.y)+vec2(-1.0,1.0),0.0,1.0);}`,
  fragment: `
precision highp float;
uniform sampler2D u_texture;varying vec2 v_uv;varying vec2 v_local;varying vec4 v_color;
void main(){vec4 art=texture2D(u_texture,v_uv);vec3 bg=vec3(11.0,11.0,12.0)/255.0;float visible=clamp(v_local.x*1160.0/560.0,0.0,1.0)*(1.0-clamp((v_local.y*620.0-380.0)/241.0,0.0,1.0));gl_FragColor=vec4(mix(bg,art.rgb+bg*(1.0-art.a),visible),1.0)*v_color;}`,
};
const registered = new WeakSet<RendererMain>();
type Frame = {
  id: number;
  src: string;
  width: number;
  height: number;
  ambient?: ImageData;
};
function ambientArtwork(image: HTMLImageElement): ImageData | undefined {
  const source = document.createElement("canvas"),
    output = document.createElement("canvas");
  source.width = 32;
  source.height = 18;
  output.width = 256;
  output.height = 144;
  try {
    const small = source.getContext("2d"),
      large = output.getContext("2d");
    if (!small || !large) return undefined;
    const scale = Math.max(32 / image.naturalWidth, 18 / image.naturalHeight),
      width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    small.drawImage(image, (32 - width) / 2, (18 - height) / 2, width, height);
    large.imageSmoothingEnabled = true;
    large.drawImage(source, 0, 0, 256, 144);
    return large.getImageData(0, 0, 256, 144);
  } catch {
    return undefined;
  } finally {
    source.width = source.height = output.width = output.height = 0;
  }
}
function Artwork(props: { frame: Frame; alpha: number }) {
  const renderer = getRenderer() as RendererMain;
  if (!registered.has(renderer)) {
    registerTvShader(renderer, "tvBrowsePreview", shader);
    registered.add(renderer);
  }
  const scale = Math.max(1160 / props.frame.width, 620 / props.frame.height),
    w = 1160 / (props.frame.width * scale),
    h = 620 / (props.frame.height * scale);
  const paint = renderer.createShader("tvBrowsePreview", {
    uvSize: [w, h],
    uvOrigin: [(1 - w) * 0.6, (1 - h) * 0.25],
  }) as ShaderNode;
  return (
    <>
      <Show when={props.frame.ambient}>
        {(ambient) => (
          <TvView
            w={1920}
            h={1080}
            src={ambient()}
            fit="cover"
            alpha={0.6 * props.alpha}
          />
        )}
      </Show>
      <TvView
      x={760}
      w={1160}
      h={620}
      src={props.frame.src}
      shader={paint}
      alpha={props.alpha}
      transition={{
        alpha: { duration: 300, timingFunction: "cubic-bezier(.2,0,0,1)" },
      }}
      />
    </>
  );
}
export function BrowseBackdrop(props: { card?: Card | null }) {
  const [frames, setFrames] = createSignal<Frame[]>([]),
    [visible, setVisible] = createSignal(true);
  let serial = 0;
  const selected = createMemo(() =>
    props.card?.view?.preview?.background ??
    props.card?.landscape ??
    props.card?.poster,
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
            alpha={i() === frames().length - 1 ? (visible() ? 1 : 0) : 1}
          />
        )}
      </KeyedFor>
    </TvView>
  );
}
export function BrowsePreview(props: { card: Card }) {
  const titleY = () => {
    const width = textMetrics("48px Onest700").measureText(
      props.card.title ?? "",
    ).width;
    const lines = Math.min(2, Math.max(1, Math.ceil(width / 1000)));
    return 120 - lines * 57.6;
  };
  return (
    <TvView x={96} y={96}>
      <Show
        when={props.card.logo}
        fallback={
          <DelayedTitle
            title={props.card.title}
            y={titleY()}
            size={48}
            lineheight={1.2}
            maxwidth={1000}
            maxlines={2}
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
