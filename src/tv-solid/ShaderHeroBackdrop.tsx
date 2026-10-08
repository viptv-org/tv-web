/** @jsxImportSource @solidtv/solid */
/**
 * TV-042 hero backdrop for Home and Details. A WebGL 1 canvas beneath the
 * transparent SolidTV stage draws the art with transitions, drift and a
 * category edge fade; the scrims stay in the SolidTV scene above it. The
 * static compositor ({@link HomeBackdrop}) is used for reduced motion, the
 * Sources screen, and for the rest of the visit after any GL failure.
 * The renderer and its bundled shaders load lazily on first use.
 */
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { tokens } from "../theme/viptv-tokens.generated";
import { heroEdgePool } from "../core/presentations";
import { HomeBackdrop } from "./HomeBackdrop";
import { TvView } from "./runtime";
import {
  BACKDROP_HEIGHT,
  BACKDROP_WIDTH,
  artDecodeSize,
  backdropMode,
  backdropScale,
  chooseBackdropArt,
  groundRgb,
  needsStill,
  prefersReducedMotion,
  settleDelay,
  type BackdropTarget,
} from "./heroBackdropModel";
import { HeroMotionPolicy, type HeroEdgeChoice } from "./heroMotionPolicy";
import type { HeroArt, HeroGlRenderer, HeroPick } from "./heroGlRenderer";

/** A focused Details episode: its identity and still (empty when it has none). */
export interface HeroFocus {
  readonly key: string;
  readonly image: string;
}

export interface ShaderHeroBackdropProps {
  /** Hero art at the art-box size (Home hero, or the series/movie on Details). */
  image: string;
  /** Small art for the static compositor's ambient layer. */
  ambient: string;
  /** Details: the episode focus has rested on. Absent elsewhere. */
  focus?: HeroFocus | null;
  /** Title facts for Core's edge pool; on Details always the series or movie. */
  mediaType: string;
  genres: readonly string[];
  /** False on the Sources screen: the static compositor is used. */
  motion: boolean;
  /** False while scrolled out of view; rendering pauses. */
  visible?: boolean;
  /** Home: logical scroll offset of the hero. */
  scrollY?: number;
}

export function ShaderHeroBackdrop(props: ShaderHeroBackdropProps) {
  // Evaluated as the screen opens, like Android's animator scale.
  const reducedMotion = prefersReducedMotion();
  const [failed, setFailed] = createSignal(false);
  const mode = createMemo(() => backdropMode({ motion: props.motion, reducedMotion, failed: failed() }));
  return (
    <Show
      when={mode() === "shader"}
      fallback={<Show when={props.visible !== false}><HomeBackdrop sharp={props.image} ambient={props.ambient} /></Show>}
    >
      <ShaderLayer {...props} onFailure={() => setFailed(true)} />
    </Show>
  );
}

const [shownCanvases, setShownCanvases] = createSignal(0);
/** True while a shader backdrop canvas is on screen beneath the SolidTV stage,
 * which must then leave its ground transparent (the page body is the ground). */
export const heroCanvasShown = () => shownCanvases() > 0;

let scrimCache: { ground: string; horizontal: ImageData; vertical: ImageData } | undefined;

/** Tiny gradient textures stretched over the backdrop: the left text scrim
 * (ground → 0.9 at 22% → 0.35 at 40% → clear at 52%) and the 440–950 lower fade. */
function scrims(ground: string) {
  if (scrimCache?.ground === ground) return scrimCache;
  const [r, g, b] = groundRgb(ground).map(value => Math.round(value * 255));
  const rgba = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
  const paint = (width: number, height: number, stops: readonly [number, number][]) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    const horizontal = width > height;
    const length = horizontal ? width : height;
    const gradient = horizontal
      ? context.createLinearGradient(0.5, 0, length - 0.5, 0)
      : context.createLinearGradient(0, 0.5, 0, length - 0.5);
    for (const [offset, alpha] of stops) gradient.addColorStop(offset, rgba(alpha));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  };
  scrimCache = {
    ground,
    horizontal: paint(256, 1, [[0, 1], [0.22, 0.9], [0.4, 0.35], [0.52, 0], [1, 0]]),
    vertical: paint(1, 64, [[0, 0], [1, 1]]),
  };
  return scrimCache;
}

type RendererModule = typeof import("./heroGlRenderer");

function loadArt(url: string, cancelled: () => boolean): Promise<HeroArt | undefined> {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    const done = () => {
      image.onload = image.onerror = null;
      if (cancelled() || !(image.naturalWidth > 0)) { resolve(undefined); return; }
      const size = artDecodeSize(image.naturalWidth, image.naturalHeight);
      if (size.width === image.naturalWidth && size.height === image.naturalHeight) {
        resolve({ source: image, width: size.width, height: size.height });
        return;
      }
      // Never upload more than the art box; scale down once on a 2D canvas.
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) { resolve(undefined); return; }
      context.drawImage(image, 0, 0, size.width, size.height);
      resolve({ source: canvas, width: size.width, height: size.height });
    };
    image.onload = () => {
      if (typeof image.decode === "function") image.decode().then(done, () => resolve(undefined));
      else done();
    };
    image.onerror = () => { image.onload = image.onerror = null; resolve(undefined); };
    image.src = url;
  });
}

function ShaderLayer(props: ShaderHeroBackdropProps & { onFailure: () => void }) {
  const ground = tokens["color.bg"];
  const ratio = window.innerWidth / BACKDROP_WIDTH;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    `position:fixed;left:0;top:0;z-index:1;pointer-events:none;display:none;` +
    `width:${BACKDROP_WIDTH * ratio}px;height:${BACKDROP_HEIGHT * ratio}px`;
  const app = document.getElementById("app");
  if (app?.parentNode) app.parentNode.insertBefore(canvas, app);
  else document.body.appendChild(canvas);

  let renderer: HeroGlRenderer | undefined;
  let policy: HeroMotionPolicy | undefined;
  let edgeIds: readonly string[] = [];
  let disposed = false;
  let presented = false;
  let shown: string | undefined;
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: { base: string; focus: HeroFocus | null } | undefined;

  const fail = () => {
    if (disposed) return;
    props.onFailure();
  };
  const active = () => props.visible !== false && !document.hidden;
  let displayed = false;
  const display = (value: boolean) => {
    if (value === displayed) return;
    displayed = value;
    canvas.style.display = value ? "block" : "none";
    setShownCanvases(count => count + (value ? 1 : -1));
  };
  const updateVisibility = () => {
    renderer?.setActive(active());
    display(presented && props.visible !== false && !disposed);
  };
  // heroEdgePool never throws; an empty pool selects the linear baseline.
  const edgeChoice = (): HeroEdgeChoice => heroEdgePool(props.mediaType, props.genres ?? [], edgeIds);
  const pick: HeroPick = {
    transition: current => policy!.nextTransition(current),
    edge: current => policy!.nextEdge(edgeChoice(), current),
  };

  /** Latest change wins: a newer target cancels the settle wait and decodes. */
  const request = (base: string, focus: HeroFocus | null) => {
    latest = { base, focus };
    if (!renderer) return;
    const id = ++token;
    clearTimeout(timer);
    const cancelled = () => id !== token || disposed;
    const target = (): BackdropTarget => ({ base, focus: focus?.image ?? "", focused: !!focus, shown });
    const run = async () => {
      let still: HeroArt | undefined;
      if (needsStill(target())) {
        still = await loadArt(focus!.image, cancelled);
        if (cancelled()) return;
      }
      const subject = chooseBackdropArt(target(), still?.width);
      if (!subject) return;
      const art = subject === focus?.image && still ? still : await loadArt(subject, cancelled);
      // Art that fails to decode keeps the current art.
      if (cancelled() || !art || !renderer) return;
      shown = subject;
      renderer.show(art, pick);
      renderer.prepare(policy!.peekTransition(), policy!.peekEdge(edgeChoice()));
    };
    const delay = settleDelay(target());
    if (delay) timer = setTimeout(() => void run(), delay);
    else void run();
  };

  void import("./heroGlRenderer").then((module: RendererModule) => {
    if (disposed) return;
    const gl = module.createHeroContext(canvas);
    if (!gl) { fail(); return; }
    try {
      policy = new HeroMotionPolicy(module.heroShaderIndex.transitions);
      edgeIds = module.heroEdgeIds;
      const crossfade = policy.crossfade ?? { id: "fade", name: "Crossfade", duration: 1.6 };
      renderer = new module.HeroGlRenderer(canvas, gl, {
        scale: backdropScale(window.innerWidth, window.devicePixelRatio || 1),
        ground: groundRgb(ground),
        crossfade,
        onFailure: fail,
        onFirstFrame: () => { presented = true; updateVisibility(); },
      });
    } catch (cause) {
      console.warn("Hero shader backdrop unavailable", cause);
      fail();
      return;
    }
    updateVisibility();
    if (latest) request(latest.base, latest.focus);
  }, cause => {
    console.warn("Hero renderer failed to load", cause);
    fail();
  });

  createEffect(on(() => [props.image, props.focus ?? null] as const, ([base, focus]) => request(base, focus)));
  createEffect(on(() => props.visible !== false, updateVisibility));
  createEffect(() => {
    canvas.style.transform = `translate3d(0,${-(props.scrollY ?? 0) * ratio}px,0)`;
  });
  document.addEventListener("visibilitychange", updateVisibility);
  onCleanup(() => {
    disposed = true;
    token++;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", updateVisibility);
    display(false);
    renderer?.release();
    renderer = undefined;
    canvas.remove();
  });

  const layers = scrims(ground);
  return (
    <TvView w={BACKDROP_WIDTH} h={BACKDROP_HEIGHT}>
      <TvView w={BACKDROP_WIDTH} h={BACKDROP_HEIGHT} src={layers.horizontal} />
      <TvView y={440} w={BACKDROP_WIDTH} h={BACKDROP_HEIGHT - 440} src={layers.vertical} />
    </TvView>
  );
}
