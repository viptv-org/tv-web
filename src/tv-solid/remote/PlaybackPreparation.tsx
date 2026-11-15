/** @jsxImportSource @solidtv/solid */
import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { TvView } from "../runtime";
import { Label, Logo, palette } from "./visuals";
import { BusySurface } from "./BusySurface";
import { imagePixels, imageSource } from "./image-source";
import { homeScrimSource } from "./tv-artwork.generated";
import type { Card } from "./types";

export function PlaybackPreparation(props: { card?: Card }) {
  const logo = createMemo(() => props.card?.logo?.trim() || undefined);
  const [logoReady, setLogoReady] = createSignal(false);
  createEffect(() => { logo(); setLogoReady(false); });
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
      <Show when={logo()}>
        <Logo src={logo()!} h={180} maxWidth={800} boxH={180} fade={false} centered onReady={() => setLogoReady(true)} onError={() => setLogoReady(false)} />
      </Show>
    </TvView>
    <BusySurface label="Press Back to cancel" />
  </TvView>;
}
