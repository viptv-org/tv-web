/** @jsxImportSource @solidtv/solid */
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, Show, type Accessor } from "solid-js";
import { ArtworkGate, type ArtworkRequest } from "../platform/artwork-gate";
import { KeyedFor, TvView } from "../runtime";
import { Logo, palette } from "./visuals";
import { imagePixels, imageSource } from "./image-source";
import { presentationCard, presentationKey } from "./presentation-card";
import { backdropScrimSource } from "./tv-artwork.generated";
import { reducedMotion } from "./motion";
import type { Card } from "./types";

type Presentation = { card: Card; background?: string; poster?: string };
type Frame = Presentation & { id: number; failed: ReadonlySet<string>; staged?: boolean };
export type HeroLogoBox = { x: number; y: number; width: number; height: number };

export function createCoherentHero(source: Accessor<Card | undefined>, scope: Accessor<string>,
  mode: Accessor<"hero" | "landscape" | "portrait" | "detail">) {
  const [shown, setShown] = createSignal<Card>();
  const [current, setCurrent] = createSignal<Frame>();
  const [retiring, setRetiring] = createSignal<Frame>();
  const [pending, setPending] = createSignal<ArtworkRequest<Presentation>>();
  let retireTimer: ReturnType<typeof setTimeout> | undefined;
  const gate = new ArtworkGate<Presentation>((value, failed) => batch(() => {
    if (!value) {
      clearTimeout(retireTimer);setShown(undefined);setCurrent(undefined);setRetiring(undefined);setPending(undefined);return;
    }
    const request=untrack(pending);
    if (request?.value === value) {
      const old=untrack(current);
      setRetiring(old);setCurrent({...value,id:request.id,failed:new Set(failed)});setPending(undefined);
      clearTimeout(retireTimer);
      retireTimer=setTimeout(() => setRetiring(undefined),reducedMotion() ? 0 : 160);
    }
    setShown(previous => {
      const card=presentationCard(previous,value.card);
      return !failed.size ? card : {...card,logo:failed.has("logo") ? null : card.logo,
        landscape:failed.has("background") ? null : card.landscape,
        poster:failed.has("background") || failed.has("poster") ? null : card.poster};
    });
  }), request => {
    if (request) {clearTimeout(retireTimer);setRetiring(undefined);}
    setPending(request);
  });
  let previousScope="";
  createEffect(() => {
    const currentScope=scope(), next=source(), kind=mode();
    const card=next ? presentationCard(currentScope === previousScope ? untrack(shown) : undefined,next) : undefined;
    previousScope=currentScope;
    const background=kind === "landscape" ? card?.view?.preview?.background ?? card?.landscape ?? card?.poster : card?.landscape ?? card?.poster;
    const poster=kind === "portrait" ? card?.poster ?? undefined : undefined;
    gate.request(currentScope,JSON.stringify([card && presentationKey(card),background,poster,card?.logo,kind]),
      card ? {card,background:background ?? undefined,poster} : undefined,
      [...(background ? ["background"] : []),...(poster ? ["poster"] : []),...(card?.logo ? ["logo"] : [])]);
  });
  createEffect(() => {
    const request=pending();if (!request) return;
    const timer=setTimeout(() => gate.finish(request.id),2500);
    onCleanup(() => clearTimeout(timer));
  });
  onCleanup(() => {clearTimeout(retireTimer);gate.request("disposed","",undefined,[]);});
  const frames=createMemo(() => {
    const displayed=current(), request=pending(), outgoing=retiring();
    if (request) return [...(displayed ? [displayed] : []),{...request.value,id:request.id,failed:new Set<string>(),staged:true}];
    return [...(outgoing ? [outgoing] : []),...(displayed ? [displayed] : [])];
  });
  return {card:shown,frames,current:() => current()?.id,
    settled:(id:number,resource:string,failed=false) => gate.settled(id,resource,failed)};
}

/** Prepared nodes become the visible nodes; no second fetch or decode on commit. */
export function HeroArtwork(props: { presentation: ReturnType<typeof createCoherentHero>; logoBox: HeroLogoBox; dim: number }) {
  return <TvView w={1920} h={1080}>
    <KeyedFor each={props.presentation.frames()} keyOf={frame => frame.id}>{frame => {
      const id=frame().id;
      const done=(name:string,failed=false) => {void Promise.resolve().then(() => props.presentation.settled(id,name,failed));};
      return <TvView w={1920} h={1080} alpha={props.presentation.current() === id ? 1 : 0}
        transition={frame().staged ? undefined : {alpha:{duration:reducedMotion() ? 0 : 150,easing:"ease-out"}}}>
        <Show when={frame().background && !frame().failed.has("background")}>
          <TvView w={1920} h={1080} fit="cover" preload src={imageSource(frame().background,imagePixels(1920),imagePixels(1080))}
            onLoad={() => done("background")} onError={() => done("background",true)} />
        </Show>
        <Show when={frame().poster && !frame().failed.has("poster")}>
          <TvView x={1520} y={96} w={280} h={420} fit="cover" preload src={imageSource(frame().poster,imagePixels(280),imagePixels(420))}
            onLoad={() => done("poster")} onError={() => done("poster",true)} />
        </Show>
        <TvView x={props.logoBox.x} y={props.logoBox.y}>
          {frame().card.logo && !frame().failed.has("logo") && <Logo src={frame().card.logo!}
            h={props.logoBox.height} maxWidth={props.logoBox.width} boxH={props.logoBox.height} fade={false}
            onReady={() => done("logo")} onError={() => done("logo",true)} />}
        </TvView>
      </TvView>;
    }}</KeyedFor>
    <TvView w={1920} h={1080} src={backdropScrimSource()} />
    <TvView w={1920} h={1080} color={palette.bg} alpha={props.dim} />
  </TvView>;
}
