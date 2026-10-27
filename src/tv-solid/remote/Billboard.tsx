/** @jsxImportSource @solidtv/solid */
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type Accessor,
} from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { Stage } from "@solidtv/renderer";
import type { WebGlShaderNode } from "@solidtv/renderer/webgl";
import { KeyedFor, TvView } from "../runtime";
import { icon, palette } from "./visuals";
import {
  billboardShader,
  billboardGlassShader,
  billboardGlassAtlasShader,
  heroProgressShader,
} from "./billboard-shaders";
import { billboardBlur } from "./billboard-blur";
import { buttonShadow } from "./button-shadow";
const registered = new WeakSet<Stage>();
function setup() {
  const renderer = getRenderer(),
    stage = renderer.stage as Stage;
  if (!registered.has(stage)) {
    for (const [name, shader] of [
      ["tvBillboard", billboardShader],
      ["tvBillboardGlass", billboardGlassShader],
      ["tvBillboardGlassAtlas", billboardGlassAtlasShader],
    ] as const) {
      stage.shManager.registerShaderType(name, shader);
      stage.shManager.registerShaderType(name + "Motion", {
        ...shader,
        time: true,
      });
    }
    stage.shManager.registerShaderType("tvHeroProgress", heroProgressShader);
    registered.add(stage);
  }
  return { renderer, stage };
}
type Frame = {
  id: number;
  src: string;
  width: number;
  height: number;
  started: number;
  glass?: ImageData;
};
export function createBillboardArt(
  source: Accessor<string | null | undefined>,
  identity: Accessor<string | undefined>,
) {
  const [frames, setFrames] = createSignal<Frame[]>([]),
    [visible, setVisible] = createSignal(true);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let serial = 0;
  const selected = createMemo(source);
  const selectedIdentity = createMemo(identity);
  createEffect(() => {
    const src = selected();
    selectedIdentity();
    let cancelled = false,
      frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = async () => {
      if (cancelled) return;
      if (image.naturalWidth < 1 || image.naturalHeight < 1) {
        setFrames([]);
        return;
      }
      const glass = await billboardBlur(image, () => cancelled).catch(
        () => undefined,
      );
      if (cancelled) return;
      const value = {
        id: ++serial,
        src: src!,
        width: image.naturalWidth,
        height: image.naturalHeight,
        started: performance.now(),
        glass,
      };
      const previous = frames().slice(-1),
        crossfade = !reduced && previous.length > 0;
      batch(() => {
        setVisible(!crossfade);
        setFrames(crossfade ? [...previous, value] : [value]);
      });
      if (crossfade) {
        frame = requestAnimationFrame(() => setVisible(true));
        timer = setTimeout(() => setFrames([value]), 350);
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
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    });
  });
  return { frames, visible, reduced };
}
type Art = ReturnType<typeof createBillboardArt>;
function Photo(props: {
  frame: Frame;
  alpha: number;
  glass?: boolean;
  pageX?: number;
  pageY?: number;
}) {
  const { renderer, stage } = setup(),
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [ended, setEnded] = createSignal(
    reduced || performance.now() - props.frame.started >= 14000,
  );
  onMount(() => {
    if (reduced) return;
    const timer = setTimeout(
      () => setEnded(true),
      Math.max(0, 14000 - (performance.now() - props.frame.started)),
    );
    onCleanup(() => clearTimeout(timer));
  });
  const width = props.glass ? 72 : 1920,
    height = props.glass ? 72 : 1080;
  const scale = Math.max(1920 / props.frame.width, 1080 / props.frame.height);
  const uvSize = [
    1920 / (props.frame.width * scale),
    1080 / (props.frame.height * scale),
  ];
  const make = (motion: boolean) => {
    const shader = renderer.createShader(
      (props.glass
        ? props.frame.glass
          ? "tvBillboardGlassAtlas"
          : "tvBillboardGlass"
        : "tvBillboard") + (motion ? "Motion" : ""),
      {},
    ) as WebGlShaderNode;
    shader.uniform1f("u_startedAt", props.frame.started - stage.startTime);
    shader.uniform1f("u_animate", motion ? 1 : 0);
    shader.uniform1f("u_zoom", reduced ? 1 : 1.06);
    if (props.glass && props.frame.glass)
      shader.uniform1f("u_row", props.pageX === 336 ? 0 : 1);
    else {
      shader.uniform2f("u_origin", props.pageX ?? 0, props.pageY ?? 0);
      shader.uniform2f("u_size", width, height);
      shader.uniform2f("u_uvSize", uvSize[0], uvSize[1]);
      shader.uniform2f(
        "u_uvOrigin",
        (1 - uvSize[0]) * 0.5,
        (1 - uvSize[1]) * 0.3,
      );
    }
    return shader;
  };
  const moving = reduced ? undefined : make(true),
    still = make(false);
  const image =
    props.glass && props.frame.glass
      ? {
          texture: renderer.createTexture("ImageTexture", {
            src: props.frame.glass,
            key: "tv-billboard-glass-v1:" + props.frame.src,
            premultiplyAlpha: true,
          }),
          color: "#FFFFFF",
        }
      : { src: props.frame.src };
  return (
    <TvView
      w={width}
      h={height}
      {...image}
      shader={ended() ? still : moving}
      alpha={props.alpha}
      transition={{
        alpha: { duration: 300, timingFunction: "cubic-bezier(.2,0,0,1)" },
      }}
    />
  );
}
function Layers(props: {
  art: Art;
  glass?: boolean;
  pageX?: number;
  pageY?: number;
}) {
  return (
    <KeyedFor each={props.art.frames()} keyOf={(frame) => frame.id}>
      {(frame, i) => (
        <Photo
          frame={frame()}
          glass={props.glass}
          pageX={props.pageX}
          pageY={props.pageY}
          alpha={
            i() === props.art.frames().length - 1
              ? props.art.visible()
                ? 1
                : 0
              : 1
          }
        />
      )}
    </KeyedFor>
  );
}
export function BillboardBackdrop(props: { art: Art }) {
  return (
    <TvView w={1920} h={1080}>
      <TvView
        w={1920}
        h={1080}
        show={!props.art.frames().length}
        color={palette.bg}
      />
      <Layers art={props.art} />
    </TvView>
  );
}
export function BillboardButton(props: {
  art: Art;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  focused: boolean;
  icon: string;
}) {
  return (
    <TvView x={props.x} y={props.y} w={72} h={72}>
      <TvView
        x={-100}
        y={-100}
        w={272}
        h={272}
        src={buttonShadow(72, 72, 36)}
        show={props.focused}
      />
      <TvView w={72} h={72}>
        <Show
          when={!props.focused && props.art.frames().length}
          fallback={
            <TvView
              w={72}
              h={72}
              rounded={36}
              color={props.focused ? palette.text : "rgba(255,255,255,.16)"}
            />
          }
        >
          <Layers
            art={props.art}
            glass
            pageX={props.pageX}
            pageY={props.pageY}
          />
        </Show>
      </TvView>
      <TvView
        x={21}
        y={21}
        w={30}
        h={30}
        src={icon(props.icon, props.focused, 2.2)}
      />
    </TvView>
  );
}
export function HeroProgress(props: { started: number; running: boolean }) {
  const { renderer, stage } = setup();
  const shader = createMemo(() => {
    if (!props.running) return undefined;
    const value = renderer.createShader(
      "tvHeroProgress",
      {},
    ) as WebGlShaderNode;
    value.uniform1f("u_startedAt", props.started - stage.startTime);
    return value;
  });
  return (
    <Show
      when={props.running}
      fallback={<TvView w={48} h={4} rounded={2} color={palette.text} />}
    >
      <TvView w={48} h={4} color="#FFFFFF" shader={shader()} />
    </Show>
  );
}
