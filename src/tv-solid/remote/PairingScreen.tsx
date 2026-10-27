/** @jsxImportSource @solidtv/solid */
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, outline, palette } from "./visuals";
import type { Pairing } from "./types";
import { easeProgress } from "./motion";

export function PairingScreen(props: {
  pairing?: Pairing;
  qr: string;
  deadline: number;
  focused: boolean;
}) {
  const [now, setNow] = createSignal(performance.now());
  const [pulse, setPulse] = createSignal(0);
  onMount(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });
  onMount(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const t = ((time - start) % 1600) / 800;
      setPulse(easeProgress(t <= 1 ? t : 2 - t, 0.42, 0.58));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(frame));
  });
  const remaining = () =>
    Math.max(
      0,
      Math.min(
        props.pairing?.expires_in ?? 0,
        Math.ceil((props.deadline - now()) / 1000),
      ),
    );
  const remainingText = () =>
    `${Math.floor(remaining() / 60)}:${String(remaining() % 60).padStart(2, "0")}`;
  const address = () =>
    props.pairing?.verification_uri.replace(/^https:\/\//, "") ?? "";
  const lines = createMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = "44px Onest700";
    return Math.max(
      1,
      Math.min(2, Math.ceil(ctx.measureText(address()).width / 698)),
    );
  });
  const step2 = () => 375.5 + 63.8 * lines() + 32;
  const codeY = () => step2() + 66;
  const refreshX = createMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = "22px Onest";
    return (
      1126 + ctx.measureText(`Code expires in ${remainingText()}`).width + 24
    );
  });
  const refreshWidth = createMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = "22px Onest600";
    return ctx.measureText("New code").width + 68;
  });
  return (
    <>
      <Label
        x={96}
        y={96}
        size={56}
        font="Onest700"
        letterspacing={-1.12}
        content="Sign in to VIPTV"
      />
      <Label
        x={96}
        y={250}
        size={30}
        font="Onest700"
        lineheight={1.45}
        content="Scan with your phone"
      />
      <Label
        x={96}
        y={315.5}
        size={26}
        lineheight={1.45}
        maxwidth={760}
        maxlines={2}
        color={palette.muted}
        content="Point your camera at the code. You’ll finish on your phone and this TV signs in by itself."
      />
      <TvView
        x={96}
        y={422.9}
        w={340}
        h={340}
        rounded={20}
        color={props.qr ? "#FFFFFF" : "#212124"}
      >
        <Show when={props.qr}>
          <TvView x={20} y={20} w={300} h={300} src={props.qr} />
        </Show>
      </TvView>
      <TvView x={959} y={250} w={2} h={560} color="rgba(255,255,255,.12)" />
      <TvView x={930} y={500} w={60} h={60} rounded={30} color={palette.bg}>
        <TvView w={60} h={60} src={outline(60, 60, 30, 2, "#FFFFFF", 0.12)} />
        <Label
          w={60}
          centerY={30}
          align="center"
          size={22}
          color={palette.muted}
          content="or"
        />
      </TvView>
      <Label
        x={1064}
        y={250}
        size={30}
        font="Onest700"
        lineheight={1.45}
        content="Use any browser"
      />
      <For each={[1, 2]}>
        {(number) => (
          <TvView x={1064} y={number === 1 ? 315.5 : step2()}>
            <TvView
              w={44}
              h={44}
              src={outline(44, 44, 22, 2, "#FFFFFF", 0.3)}
            />
            <Label
              w={44}
              centerY={22}
              align="center"
              size={22}
              font="Onest700"
              content={String(number)}
            />
            <Label
              x={62}
              centerY={22}
              size={26}
              lineheight={1.45}
              color={palette.muted}
              content={number === 1 ? "Go to" : "Enter this code"}
            />
          </TvView>
        )}
      </For>
      <Label
        x={1126}
        y={375.5}
        size={44}
        font="Onest700"
        lineheight={1.45}
        maxwidth={698}
        maxlines={2}
        content={address()}
      />
      <TvView
        x={1126}
        y={codeY()}
        w={640}
        h={120}
        rounded={16}
        color="rgba(255,255,255,.08)"
      >
        <TvView
          w={640}
          h={120}
          src={outline(640, 120, 16, 1, "#FFFFFF", 0.12)}
        />
        <Label
          w={640}
          centerY={60}
          align="center"
          size={72}
          font="Onest700Tabular"
          letterspacing={5.76}
          content={props.pairing?.user_code ?? ""}
        />
      </TvView>
      <Show when={props.pairing}>
        <Label
          x={1126}
          centerY={codeY() + 166}
          size={22}
          color="#8F8D89"
          content={`Code expires in ${remainingText()}`}
        />
        <TvView
          x={refreshX()}
          y={codeY() + 142}
          w={refreshWidth()}
          h={48}
          rounded={10}
          color={props.focused ? palette.text : "rgba(255,255,255,.16)"}
        >
          <TvView
            x={18}
            y={13}
            w={22}
            h={22}
            src={icon("refresh", props.focused, 2.2)}
          />
          <Label
            x={50}
            centerY={24}
            size={22}
            font="Onest600"
            color={props.focused ? "#111113" : palette.text}
            content="New code"
          />
        </TvView>
      </Show>
      <TvView
        x={96}
        y={909}
        w={12}
        h={12}
        rounded={6}
        color={palette.accent}
        alpha={1 - 0.65 * pulse()}
        scale={1 - 0.2 * pulse()}
      />
      <Label
        x={122}
        y={900}
        size={24}
        color={palette.muted}
        content="Waiting for you to sign in…"
      />
    </>
  );
}
