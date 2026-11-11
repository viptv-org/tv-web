/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { TvView } from "../runtime";
import { Button, Label, palette } from "./visuals";
import { reducedMotion } from "./motion";
import type { Card } from "./types";
import type { CountdownState } from "./autoplay-countdown";

const isRokuUi = typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";
const nextPanelMotion = {
  y: { duration: 450, delay: 350, timingFunction: "cubic-bezier(.2,0,0,1)" },
  alpha: { duration: 450, delay: 350, timingFunction: "cubic-bezier(.2,0,0,1)" },
};

export function NextEpisodePanel(props: { currentTitle: string; episode?: Card; countdown: CountdownState; selected: number; entered: boolean }) {
  return <>
    <TvView w={1920} h={1080} zIndex={-1} src={`${import.meta.env.BASE_URL}assets/player/end-scrim.png`} />
    <TvView x={96} y={reducedMotion() || props.entered ? 616 : 632} alpha={reducedMotion() || props.entered ? 1 : 0} transition={reducedMotion() ? undefined : nextPanelMotion}>
      <Label w={900} maxlines={1} size={22} content={`${props.currentTitle} · Credits`} color={palette.body} />
    </TvView>
    <TvView x={1040} y={reducedMotion() || props.entered ? 120 : 136} w={784} h={520} alpha={reducedMotion() || props.entered ? 1 : 0} transition={reducedMotion() ? undefined : nextPanelMotion}>
      <Label size={24} content="Next episode" color={palette.body} />
      <Label y={53} w={784} size={52} font="Onest700" letterspacing={-1.04} content={`${props.episode?.identity.episode?.episode ?? ""}. ${props.episode?.title ?? ""}`} maxlines={2} />
      <Label y={191} w={784} size={30} content={props.episode?.subtitle ?? ""} maxlines={1} />
      <Label y={239} w={784} size={26} lineheight={1.45} color={palette.body} content={props.episode?.description ?? ""} maxlines={3} />
      <Button x={0} y={373} w={428} h={72} icon="play" iconSize={props.countdown.running && !reducedMotion() ? 18 : 24} label={props.countdown.running ? `Next episode in ${props.countdown.remaining}` : "Play next episode"} focused={props.selected === 0} />
      <Button x={444} y={373} w={340} h={72} label="Keep watching credits" focused={props.selected === 1} />
      <Show when={props.countdown.running && !reducedMotion()}>
        <Show when={isRokuUi} fallback={
          <TvView x={17} y={389} w={40} h={40} clipping={true}>
            <TvView x={-(Math.round(props.countdown.progress * 100) % 10) * 40} y={-Math.floor(Math.round(props.countdown.progress * 100) / 10) * 40} w={400} h={440} src={`${import.meta.env.BASE_URL}assets/player/countdown/ring-atlas.png`} />
          </TvView>
        }>
          <TvView x={17} y={389} w={40} h={40} src={`${import.meta.env.BASE_URL}assets/player/countdown/ring-${String(Math.round(props.countdown.progress * 100)).padStart(3, "0")}.png`} />
        </Show>
      </Show>
      <Label y={451} w={784} size={22} content={props.countdown.running ? "Starts automatically. Press any button to cancel." : "Nothing plays on its own."} color={palette.body} />
    </TvView>

  </>;
}
