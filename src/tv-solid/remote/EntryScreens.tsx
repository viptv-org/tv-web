/** @jsxImportSource @solidtv/solid */
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { TvView } from "../runtime";
import { canvasFont } from "../fonts";
import { PosterWall } from "./PosterWall";
import { Label, palette } from "./visuals";
import { easeProgress } from "./motion";

let shadow: ImageData | undefined;
function signInShadow() {
  if (!shadow) {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 136;
    const ctx = canvas.getContext("2d")!;
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 9;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    // A half-resolution cached mask keeps the 50px blur off the animation path.
    ctx.moveTo(56, 50);
    ctx.arcTo(230, 50, 230, 86, 6);
    ctx.arcTo(230, 86, 50, 86, 6);
    ctx.arcTo(50, 86, 50, 50, 6);
    ctx.arcTo(50, 50, 230, 50, 6);
    ctx.fill();
    shadow = ctx.getImageData(0, 0, 280, 136);
  }
  return shadow;
}
function Brand(props: { splash: boolean }) {
  const size = () => (props.splash ? 104 : 92),
    mark = () => (props.splash ? 88 : 80),
    gap = () => (props.splash ? 22 : 20);
  const width = createMemo(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `${size()}px ${canvasFont("Bricolage800", size())}`;
    if (Reflect.has(context, "letterSpacing")) {
      (
        context as CanvasRenderingContext2D & { letterSpacing: string }
      ).letterSpacing = `${-0.04 * size()}px`;
      return context.measureText("VIPTV").width;
    }
    return context.measureText("VIPTV").width - 0.04 * size() * 4;
  });
  return (
    <TvView
      x={(1920 - mark() - gap() - width()) / 2}
      y={props.splash ? 440 : 330}
    >
      <TvView
        y={(size() - mark()) / 2}
        w={mark()}
        h={mark()}
        rounded={props.splash ? 25 : 22}
        color={palette.accent}
      >
        <Label
          w={mark()}
          centerY={mark() / 2}
          align="center"
          font="Bricolage800"
          size={props.splash ? 55 : 50}
          content="V"
          color="#15130F"
        />
      </TvView>
      <Label
        x={mark() + gap()}
        size={size()}
        lineheight={1}
        font="Bricolage800"
        letterspacing={-0.04 * size()}
        content="VIPTV"
      />
    </TvView>
  );
}
export function EntryScreen(props: { loading: boolean; focused: boolean }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [elapsed, setElapsed] = createSignal(0);
  createEffect(() => {
    if (reduced || !props.loading) return;
    setElapsed(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(frame));
  });
  // CSS cubic-bezier(.4,0,.2,1), evaluated only for the four-pixel indicator.
  const indicator = () =>
    -96 + 345.6 * easeProgress((elapsed() % 1200) / 1200, 0.4, 0.2);
  return (
    <Show
      when={props.loading}
      fallback={
        <>
          <PosterWall />
          <Brand splash={false} />
          <Label
            y={470}
            w={1920}
            align="center"
            size={34}
            lineheight={1.45}
            content="Your shows, channels and progress. All in one place."
          />
          <TvView x={680} y={484} w={560} h={272} src={signInShadow()} />
          <TvView
            x={780}
            y={584}
            w={360}
            h={72}
            rounded={12}
            color={props.focused ? palette.text : "rgba(255,255,255,.16)"}
          >
            <Label
              w={360}
              centerY={36}
              align="center"
              size={26}
              font="Onest700"
              content="Sign in"
              color={props.focused ? "#111113" : palette.text}
            />
          </TvView>
        </>
      }
    >
      <TvView alpha={!reduced ? easeProgress(elapsed() / 600, 0, 0.58) : 1}>
        <Brand splash />
      </TvView>
      <TvView
        x={840}
        y={600}
        w={240}
        h={4}
        rounded={2}
        clipping
        color="rgba(255,255,255,.12)"
      >
        <TvView
          x={reduced ? 0 : indicator()}
          w={96}
          h={4}
          rounded={2}
          color={palette.text}
        />
      </TvView>
    </Show>
  );
}
