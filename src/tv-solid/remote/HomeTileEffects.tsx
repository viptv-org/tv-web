/** @jsxImportSource @solidtv/solid */
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { RendererMain, ShaderNode, WebGlShaderType } from "@solidtv/renderer";
import { sameShader } from "../shaders";
import { TvView } from "../runtime";
import { registerTvShader } from "../shaders";
import { icon } from "./visuals";
type ProgressProps = { size: number[]; top: number; radius: number; progress: number };
const progressShader: WebGlShaderType<ProgressProps> = {
  props: { size: [0, 4], top: 0, radius: 2, progress: 0 },
  update(this: any) {
    const p = this.props as ProgressProps;
    this.uniform2fa("u_size", p.size);
    this.uniform1f("u_top", p.top);
    this.uniform1f("u_radius", p.radius);
    this.uniform1f("u_progress", p.progress);
  },
  canBatch: sameShader,
  vertex: `
precision highp float;attribute vec2 a_position;attribute vec2 a_nodeCoords;attribute vec4 a_color;uniform vec2 u_resolution;uniform float u_pixelRatio;varying vec2 v_local;varying vec4 v_color;void main(){v_local=a_nodeCoords;v_color=a_color;gl_Position=vec4(a_position*u_pixelRatio*vec2(2.0/u_resolution.x,-2.0/u_resolution.y)+vec2(-1.0,1.0),0.0,1.0);}`,
  fragment: `
precision highp float;uniform vec2 u_size;uniform float u_top;uniform float u_radius;uniform float u_progress;uniform float u_pixelRatio;varying vec2 v_local;varying vec4 v_color;void main(){vec2 p=v_local*vec2(u_size.x,4.0)+vec2(0.0,u_top)-u_size*.5;vec2 q=abs(p)-u_size*.5+u_radius;float d=min(max(q.x,q.y),0.0)+length(max(q,0.0))-u_radius;float a=1.0-smoothstep(-.5/u_pixelRatio,.5/u_pixelRatio,d);vec4 c=mix(vec4(.25),vec4(245.0/255.0,197.0/255.0,66.0/255.0,1.0),1.0-step(u_progress,v_local.x));gl_FragColor=c*a*v_color;}`,
};
const registered = new WeakSet<RendererMain>();
export function HomeProgress(props: {
  width: number;
  progress: number;
  tileHeight?: number;
}) {
  const renderer = getRenderer() as RendererMain;
  if (!registered.has(renderer)) {
    registerTvShader(renderer, "tvHomeProgress", progressShader);
    registered.add(renderer);
  }
  const shader = createMemo(() =>
    renderer.createShader("tvHomeProgress", {
      size: [props.width, props.tileHeight ?? 4],
      top: props.tileHeight ? props.tileHeight - 4 : 0,
      radius: props.tileHeight ? 10 : 2,
      progress: props.progress,
    }) as ShaderNode,
  );
  return <TvView w={props.width} h={4} color="#FFFFFF" shader={shader()} />;
}
export type TilePlayArt = {
  src?: string | null;
  width: number;
  height: number;
  pixels?: ImageData;
};
export function TilePlay(props: { art: TilePlayArt }) {
  const [blur, setBlur] = createSignal<ImageData>();
  createEffect(() => {
    const art = props.art;
    let cancelled = false;
    setBlur(art.pixels);
    if (art.pixels) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      const source = document.createElement("canvas"),
        output = document.createElement("canvas");
      source.width = source.height = output.width = output.height = 216;
      try {
        const ctx = source.getContext("2d")!,
          filtered = output.getContext("2d")!;
        if (!("filter" in filtered)) return;
        const scale = Math.max(
            art.width / image.naturalWidth,
            art.height / image.naturalHeight,
          ),
          w = image.naturalWidth * scale,
          h = image.naturalHeight * scale;
        ctx.drawImage(
          image,
          (art.width - w) / 2 - (art.width / 2 - 108),
          (art.height - h) / 2 - (art.height / 2 - 108),
          w,
          h,
        );
        filtered.filter = "blur(24px)";
        filtered.drawImage(source, 0, 0);
        art.pixels = filtered.getImageData(72, 72, 72, 72);
        setBlur(art.pixels);
      } catch {
      } finally {
        source.width = output.width = 0;
      }
    };
    if (art.src) image.src = art.src;
    onCleanup(() => {
      cancelled = true;
      image.onload = null;
    });
  });
  return (
    <TvView
      x={(props.art.width - 72) / 2}
      y={(props.art.height - 72) / 2}
      w={72}
      h={72}
    >
      <TvView w={72} h={72}>
        <Show when={blur()}>
          {(pixels) => <TvView w={72} h={72} src={pixels()} />}
        </Show>
      </TvView>
      <TvView w={72} h={72} color="rgba(255,255,255,.16)" />
      <TvView
        x={24}
        y={22}
        w={28}
        h={28}
        src={icon("play", false, 0, "#FFFFFF")}
      />
    </TvView>
  );
}
