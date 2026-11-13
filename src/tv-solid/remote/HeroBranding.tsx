/** @jsxImportSource @solidtv/solid */
import { Show, createSignal, onCleanup, type Accessor } from 'solid-js';
import { KeyedFor, TvView } from '../runtime';
import { Logo } from './visuals';
import { BRANDING_MOTION, logoScale, type HeroLogoBox } from './hero-layout';
import { reducedMotion } from './motion';
import type { Frame } from './CoherentHero';
import { HERO_SCROLL_MS } from './heroCycle';
import { heroArtworkLayout } from './hero-layout';

interface BrandingProps {
  frames: Frame[];
  current?: number;
  box: HeroLogoBox;
  settled: (id: number, resource: string, failed?: boolean) => void;
  register: (id: number, node?: any) => void;
}
function BrandingFrame(props: Pick<BrandingProps, 'current' | 'settled' | 'register' | 'box'> & {
  frame: Accessor<Frame>;
}) {
  const id = props.frame().id;
  const height = props.frame().logoBox.rasterHeight ?? props.frame().logoBox.height;
  const [pixels, setPixels] = createSignal<{width:number;height:number}>();
  const scale = () => logoScale(props.box, pixels()?.width ?? 640, pixels()?.height ?? height);
  const done = (failed = false) => { void Promise.resolve().then(() => props.settled(id, 'logo', failed)); };
  onCleanup(() => props.register(id));
  return <TvView nodeRef={(node: any) => props.register(id, node)} w={640} h={height}
    x={!props.frame().scrolling ? 0 : props.frame().staged ? heroArtworkLayout(props.frame().kind).viewport.width
      : props.current === id ? 0 : -heroArtworkLayout(props.frame().kind).viewport.width}
    scale={scale()} pivotX={0} pivotY={1} mountX={0} mountY={1}
    alpha={!props.frame().staged && (props.current === id || props.frame().scrolling) ? 1 : 0}
    transition={{x:{duration: reducedMotion() ? 0 : HERO_SCROLL_MS, easing: 'ease-out'}, alpha: { duration: reducedMotion() ? 0 : 150, easing: 'ease-out' }, scale: reducedMotion() ? undefined : BRANDING_MOTION.scale }}>
    <Show when={props.frame().card.logo && !props.frame().failed.has('logo')}>
      <Logo src={props.frame().card.logo!} h={height} maxWidth={640} boxH={height} fade={false}
        onReady={geometry => { if (geometry) setPixels(geometry); done(); }} onError={() => done(true)} />
    </Show>
  </TvView>;
}
/** All fading logos inherit one actual motion phase and keep their prepared pixels. */
export function HeroBranding(props: BrandingProps) {
  return <TvView x={props.box.x} y={props.box.y + props.box.height}
    transition={reducedMotion() ? undefined : BRANDING_MOTION}>
    <KeyedFor each={props.frames} keyOf={frame => frame.id}>{frame =>
      <BrandingFrame frame={frame} current={props.current} box={props.box}
        settled={props.settled} register={props.register} />
    }</KeyedFor>
  </TvView>;
}
