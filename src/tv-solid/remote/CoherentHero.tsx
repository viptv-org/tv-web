/** @jsxImportSource @solidtv/solid */
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, Show, type Accessor } from "solid-js";
import { ArtworkGate, type ArtworkRequest } from "../platform/artwork-gate";
import { KeyedFor, TvView } from "../runtime";
import { palette } from "./visuals";
import { HeroBranding } from "./HeroBranding";
import { heroArtworkLayout, type HeroLogoBox, type HeroMode } from "./hero-layout";
import { imagePixels, imageSource } from "./image-source";
import { presentationCard, presentationKey } from "./presentation-card";
import { backdropScrimSource, homeScrimSource } from "./tv-artwork.generated";
import { reducedMotion } from "./motion";
import { retireAfterHeroAnimations } from "./hero-retirement";
import type { Card } from "./types";

const POSTER_BOX = { x: 1584, y: 144, width: 240, height: 360 };

type Presentation = { card: Card; background?: string; poster?: string; kind: HeroMode; logoBox: HeroLogoBox };
export type Frame = Presentation & { id: number; failed: ReadonlySet<string>; staged?: boolean };
export type { HeroLogoBox } from "./hero-layout";

export function createCoherentHero(source: Accessor<Card | undefined>, scope: Accessor<string>,
  mode: Accessor<HeroMode>, logoBox: Accessor<HeroLogoBox>, ready: Accessor<boolean>) {
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
      if (typeof (globalThis as any).__SolidTVRokuRenderer === "undefined")
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
    const currentScope=scope();
    if (!ready()) {gate.hold(currentScope);return;}
    const next=source(), kind=mode(), box=logoBox();
    const sameScope = currentScope === previousScope;
    const card=next ? presentationCard(sameScope ? untrack(shown) : undefined, next,
      sameScope ? untrack(pending)?.value.card : undefined) : undefined;
    previousScope=currentScope;
    const background=kind === "landscape" ? card?.view?.preview?.background ?? card?.landscape ?? card?.poster : card?.landscape ?? card?.poster;
    const poster=kind === "portrait" ? card?.poster ?? undefined : undefined;
    gate.request(currentScope,JSON.stringify([card && presentationKey(card),background,poster,card?.logo,kind]),
      card ? {card,background:background ?? undefined,poster,kind,logoBox:box} : undefined,
      [...(background ? ["background"] : []),...(poster ? ["poster"] : []),...(card?.logo ? ["logo"] : [])]);
  });
  onCleanup(() => {clearTimeout(retireTimer);gate.request("disposed","",undefined,[]);});
  const frames=createMemo(() => {
    const displayed=current(), request=pending(), outgoing=retiring();
    if (request) return [...(displayed ? [displayed] : []),{...request.value,id:request.id,failed:new Set<string>(),staged:true}];
    return [...(outgoing ? [outgoing] : []),...(displayed ? [displayed] : [])];
  });
  const displayCard = createMemo(() => {
    const displayed = shown(), preparing = pending()?.value.card;
    return displayed ?? preparing;
  });
  return {card:displayCard,frames,scope,current:() => current()?.id,mode:() => current()?.kind ?? pending()?.value.kind,
    retiring:() => retiring()?.id, retire:(id:number) => { if (untrack(retiring)?.id === id) setRetiring(undefined); },
    settled:(id:number,resource:string,failed=false) => gate.settled(id,resource,failed)};
}

type ArtworkProps = { presentation: ReturnType<typeof createCoherentHero>; logoBox: HeroLogoBox; dim: number };

/** Both halves retain their prepared nodes and share the same opacity target. */
function ArtworkFrame(props: ArtworkProps & { frame: Accessor<Frame>; foreground: boolean; scrimReady: boolean; register: (id: number, layer: 0 | 1 | 2, node?: any) => void }) {
  const id=props.frame().id;
  const layer = props.foreground ? 1 : 0;
  onCleanup(() => props.register(id,layer));
  const frame=props.frame;
  const layout = () => heroArtworkLayout(frame().kind);
  const backdropWidth=() => imagePixels(layout().decodeWidth);
  const backdropHeight=() => imagePixels(layout().decodeHeight);
  const done=(name:string,failed=false) => {void Promise.resolve().then(() => props.presentation.settled(id,name,failed));};
  return <TvView nodeRef={(node:any) => props.register(id,layer,node)} w={1920} h={1080} alpha={props.presentation.current() === id && (props.foreground || props.scrimReady) ? 1 : 0}
    transition={frame().staged ? undefined : {alpha:{duration:reducedMotion() ? 0 : 150,easing:"ease-out"}}}>
    {props.foreground ? <>
      <Show when={frame().poster && !frame().failed.has("poster")}>
        <TvView x={POSTER_BOX.x} y={POSTER_BOX.y} w={POSTER_BOX.width} h={POSTER_BOX.height} fit="cover" preload src={imageSource(frame().poster,imagePixels(POSTER_BOX.width),imagePixels(POSTER_BOX.height))}
          onLoad={() => done("poster")} onError={() => done("poster",true)} />
      </Show>
    </> : <Show when={frame().background && !frame().failed.has("background")}>
      <TvView x={layout().viewport.x} y={layout().viewport.y} w={layout().viewport.width} h={layout().viewport.height} clipping={layout().clipped}>
        <TvView nativePaintBand="backdrop" x={layout().image.x} y={layout().image.y} w={layout().image.width} h={layout().image.height}
          decodeWidth={backdropWidth()} decodeHeight={backdropHeight()} fit="cover" preload
          src={imageSource(frame().background,backdropWidth(),backdropHeight(),"cover",layout().blur)}
          onLoad={() => done("background")} onError={() => done("background",true)} />
      </TvView>
    </Show>}
  </TvView>;
}

/** Prepared nodes become the visible nodes; no second fetch or decode on commit. */
export function HeroArtwork(props: ArtworkProps) {
  const native = typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";
  const portrait = () => props.presentation.mode() === "portrait";
  const scrim = createMemo(() => props.presentation.mode() === "detail" ? backdropScrimSource() : homeScrimSource());
  const [loadedScrim, setLoadedScrim] = createSignal<string>();
  const [roots,setRoots]=createSignal(new Map<number, [any?, any?, any?]>());
  const register=(id:number,layer:0|1|2,node?:any) => setRoots(previous => {
    const next=new Map(previous), pair: [any?,any?,any?]=[...(previous.get(id) ?? [])];
    pair[layer]=node;
    if (pair[0] || pair[1] || pair[2]) next.set(id,pair); else next.delete(id);
    return next;
  });
  createEffect(() => {
    if (typeof (globalThis as any).__SolidTVRokuRenderer === "undefined") return;
    const id=props.presentation.retiring();
    if (id === undefined) return;
    const pair=roots().get(id);
    if (!pair?.[0] || !pair[1] || !pair[2]) return;
    onCleanup(retireAfterHeroAnimations(pair,() => props.presentation.retire(id)));
  });
  // Keep dynamic insertion inside fixed paint bands. A frame adopted after
  // mount must never append above the scrim, and masks must not dim foreground
  // artwork or multiply as current/preparing frames crossfade.
  return <TvView w={1920} h={1080}>
    <TvView w={1920} h={1080}>
      <KeyedFor each={props.presentation.frames()} keyOf={frame => frame.id}>{frame =>
        <ArtworkFrame {...props} frame={frame} foreground={false} scrimReady={portrait() || native || loadedScrim() === scrim()} register={register} />
      }</KeyedFor>
    </TvView>
    {native ? <TvView nativePaintBand="scrim" w={1920} h={1080} alpha={portrait() ? 0 : 1} src={scrim()} /> : <TvView w={1920} h={1080} alpha={portrait() ? 0 : 1}>
      <Show when={scrim()} keyed>{source =>
        <TvView nativePaintBand="scrim" w={1920} h={1080} src={source} preload onLoad={() => setLoadedScrim(source)} />
      }</Show>
    </TvView>}
    <TvView w={1920} h={1080} color={palette.bg} alpha={props.dim} />
    <TvView w={1920} h={1080}>
      <KeyedFor each={props.presentation.frames()} keyOf={frame => frame.id}>{frame =>
        <ArtworkFrame {...props} frame={frame} foreground={true} scrimReady register={register} />
      }</KeyedFor>
      <Show when={props.presentation.scope()} keyed>{(_scope) =>
        <HeroBranding frames={props.presentation.frames()} current={props.presentation.current()} box={props.logoBox}
          settled={props.presentation.settled} register={(id, node) => register(id, 2, node)} />
      }</Show>
    </TvView>
  </TvView>;
}
