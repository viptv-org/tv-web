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
import type { Stage } from "@solidtv/renderer";
import type { WebGlShaderNode, WebGlShaderType } from "@solidtv/renderer/webgl";
import { KeyedFor, TvView } from "../runtime";
import { Label, Logo, palette } from "./visuals";
import { TitleMetadata } from "./TitleMetadata";
import type { Card } from "./types";
import { HomeProgress } from "./HomeTileEffects";
const shader: WebGlShaderType = {
  props: {},
  canBatch: (node, op) => node.props.shader === op.shader,
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
const registered = new WeakSet<Stage>();
type Frame = { id: number; src: string; width: number; height: number };
function Artwork(props: { frame: Frame; alpha: number }) {
  const renderer = getRenderer(),
    stage = renderer.stage as Stage;
  if (!registered.has(stage)) {
    stage.shManager.registerShaderType("tvBrowsePreview", shader);
    registered.add(stage);
  }
  const paint = renderer.createShader("tvBrowsePreview", {}) as WebGlShaderNode;
  const scale = Math.max(1160 / props.frame.width, 620 / props.frame.height),
    w = 1160 / (props.frame.width * scale),
    h = 620 / (props.frame.height * scale);
  paint.uniform2f("u_uvSize", w, h);
  paint.uniform2f("u_uvOrigin", (1 - w) * 0.6, (1 - h) * 0.25);
  return (
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
  );
}
export function BrowseBackdrop(props: { card?: Card | null }) {
  const [frames, setFrames] = createSignal<Frame[]>([]),
    [visible, setVisible] = createSignal(true);
  let serial = 0;
  const selected = createMemo(() =>
    props.card?.view?.preview
      ? props.card.view.preview.background
      : props.card?.landscape,
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  createEffect(() => {
    const src = selected();
    let cancelled = false,
      raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
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
          src: src!,
          width: image.naturalWidth,
          height: image.naturalHeight,
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
    if (src) image.src = src;
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
  const view = () => props.card.view?.preview;
  return (
    <TvView x={96} y={96}>
      <Show
        when={props.card.logo}
        fallback={
          <Label
            size={44}
            font="Onest700"
            maxwidth={700}
            maxlines={2}
            content={props.card.title}
          />
        }
      >
        <Logo
          src={props.card.logo!}
          w={420}
          h={144}
          title={props.card.title}
          size={44}
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
      <Show when={view()?.progress != null}>
        <TvView y={336}>
          <HomeProgress width={160} progress={view()!.progress!} />
        </TvView>
      </Show>
      <Show when={view()?.caption}>
        <Label
          x={view()?.progress != null ? 174 : 0}
          y={324}
          size={22}
          font="Onest600"
          content={view()!.caption!}
          maxwidth={1100}
          maxlines={1}
        />
      </Show>
    </TvView>
  );
}
