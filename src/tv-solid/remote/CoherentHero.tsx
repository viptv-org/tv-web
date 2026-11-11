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

const POSTER_BOX = { x: 1584, y: 144, width: 240, height: 360 };

type HeroMode = "hero" | "landscape" | "portrait" | "detail";
type Presentation = { card: Card; background?: string; poster?: string; kind: HeroMode; logoBox: HeroLogoBox };
type Frame = Presentation & { id: number; failed: ReadonlySet<string>; staged?: boolean };
export type HeroLogoBox = { x: number; y: number; width: number; height: number };

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
    const previous = currentScope === previousScope ? untrack(shown) ?? untrack(pending)?.value.card : undefined;
    const card=next ? presentationCard(previous,next) : undefined;
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
    return displayed ?? (preparing ? {...preparing,logo:null} : undefined);
  });
  return {card:displayCard,frames,current:() => current()?.id,mode:() => current()?.kind ?? pending()?.value.kind,
    retiring:() => retiring()?.id, retire:(id:number) => { if (untrack(retiring)?.id === id) setRetiring(undefined); },
    settled:(id:number,resource:string,failed=false) => gate.settled(id,resource,failed)};
}

/** Prepared nodes become the visible nodes; no second fetch or decode on commit. */
export function HeroArtwork(props: { presentation: ReturnType<typeof createCoherentHero>; logoBox: HeroLogoBox; dim: number }) {
  return <TvView w={1920} h={1080}>
    <KeyedFor each={props.presentation.frames()} keyOf={frame => frame.id}>{frame => {
      const id=frame().id;
      const [root,setRoot]=createSignal<any>();
      createEffect(() => {
        if (typeof (globalThis as any).__SolidTVRokuRenderer === "undefined" || props.presentation.retiring() !== id) return;
        const node=root();if (!node) return;
        const timer=setTimeout(() => {
          const animation=node.lng?.animation?.("alpha");
          void (animation?.waitUntilStopped() ?? Promise.resolve()).then(() => props.presentation.retire(id));
        },0);
        onCleanup(() => clearTimeout(timer));
      });
      const box=() => frame().kind === "detail" ? props.logoBox : frame().logoBox;
      const preview=() => frame().kind === "portrait" || frame().kind === "landscape";
      const backdropWidth=() => imagePixels(preview() ? 960 : 1920);
      const backdropHeight=() => imagePixels(preview() ? 540 : 1080);
      const done=(name:string,failed=false) => {void Promise.resolve().then(() => props.presentation.settled(id,name,failed));};
      return <TvView nodeRef={setRoot} w={1920} h={1080} alpha={props.presentation.current() === id ? 1 : 0}
        transition={frame().staged ? undefined : {alpha:{duration:reducedMotion() ? 0 : 150,easing:"ease-out"}}}>
        <Show when={frame().background && !frame().failed.has("background")}>
          <TvView w={1920} h={1080} decodeWidth={backdropWidth()} decodeHeight={backdropHeight()} fit="cover" preload
            src={imageSource(frame().background,backdropWidth(),backdropHeight(),"cover",preview() ? backdropWidth() / 120 : undefined)}
            onLoad={() => done("background")} onError={() => done("background",true)} />
        </Show>
        <Show when={frame().poster && !frame().failed.has("poster")}>
          <TvView x={POSTER_BOX.x} y={POSTER_BOX.y} w={POSTER_BOX.width} h={POSTER_BOX.height} fit="cover" preload src={imageSource(frame().poster,imagePixels(POSTER_BOX.width),imagePixels(POSTER_BOX.height))}
            onLoad={() => done("poster")} onError={() => done("poster",true)} />
        </Show>
        <TvView x={box().x} y={box().y}>
          <Show when={!!frame().card.logo && !frame().failed.has("logo")}>
            <Logo src={frame().card.logo!} h={box().height} maxWidth={box().width} boxH={box().height} fade={false}
              onReady={() => done("logo")} onError={() => done("logo",true)} />
          </Show>
        </TvView>
      </TvView>;
    }}</KeyedFor>
    <TvView w={1920} h={1080} src={backdropScrimSource()} />
    <TvView w={1920} h={1080} color={palette.bg} alpha={props.dim} />
  </TvView>;
}
