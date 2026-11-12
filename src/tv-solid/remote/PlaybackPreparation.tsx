/** @jsxImportSource @solidtv/solid */
import { Show, createEffect, createSignal } from "solid-js";
import { TvView } from "../runtime";
import { Label, Logo, palette } from "./visuals";
import { BusySpinner } from "./BusyIndicator";
import { imagePixels, imageSource } from "./image-source";
import { homeScrimSource } from "./tv-artwork.generated";
import type { Card } from "./types";

export function PlaybackPreparation(props: { card?: Card; discovering?: boolean }) {
  const [logoReady, setLogoReady] = createSignal(false);
  createEffect(() => { props.card?.logo; setLogoReady(false); });
  return <TvView w={1920} h={1080} color={palette.bg}>
    <Show when={props.card?.landscape}>
      <TvView x={480} w={1440} h={810} decodeWidth={imagePixels(1440)} decodeHeight={imagePixels(810)} fit="cover" src={imageSource(props.card!.landscape, imagePixels(1440), imagePixels(810), "cover", 0)} />
      <TvView w={1920} h={1080} src={homeScrimSource()} />
    </Show>
    <TvView w={1920} h={1080} color="rgba(0,0,0,.55)" />
    <TvView x={560} y={250} w={800} h={180}>
      <Show when={!logoReady()}>
        <Label w={800} centerY={90} align="center" size={56} font="Onest700" maxlines={2} content={props.card?.title ?? ""} />
      </Show>
      <Show when={props.card?.logo}>
        <Logo src={props.card!.logo!} h={180} maxWidth={800} boxH={180} fade={false} centered onReady={() => setLogoReady(true)} />
      </Show>
    </TvView>
    <BusySpinner x={932} y={512} size={56} />
    <Label x={560} y={610} w={800} align="center" size={26} color={palette.body} content={props.discovering ? "Finding a matching source…" : "Opening stream…"} />
    <Label x={560} y={662} w={800} align="center" size={22} color={palette.muted} content="Press Back to cancel" />
  </TvView>;
}
