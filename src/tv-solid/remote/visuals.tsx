/** @jsxImportSource @solidtv/solid */
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { TvView, TvText } from "../runtime";
import { getRenderer } from "@solidtv/solid";
import { tokens } from "../../theme/viptv-tokens.generated";
import { buttonShadow } from "./button-shadow";
const [accentColor, setAccentColor] = createSignal<string>(
  tokens["color.accent.default"],
);
/** The server-owned display preference decides the accent; the designed
 * default applies until a profile's preference snapshot arrives. */
export function applyAccentColor(value: string) {
  setAccentColor(value);
}
export const palette = {
  bg: tokens["color.bg"],
  text: tokens["color.text.primary"],
  body: tokens["color.text.body"],
  muted: tokens["color.text.secondary"],
  surface: tokens["color.surface.1"],
  get accent() {
    return accentColor();
  },
};
const paths: Record<string, string> = {
  play: "M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  plus: "M12 5v14M5 12h14",
  info: "M12 16v-4M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  search: "M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  back: "M15 18l-6-6 6-6",
  down: "M6 9l6 6 6-6",
  space: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1",
  delete: "M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zM12 9l6 6M18 9l-6 6",
  refresh: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5",
  edit: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4",
  "profile-lock": "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  episodes: "M4 4h16v16H4zM8 4v16M4 9h4M4 15h4",
  check: "M5 12l4 4L19 6",
  chevron: "m9 18 6-6-6-6",
  close: "M6 6l12 12M6 18L18 6",
  audio: "M4 10v4h4l5 4V6l-5 4zM17 8a6 6 0 0 1 0 8",
};
const cache = new Map<string, string>();
export function outline(w:number,h:number,radius:number,width:number,color:string,opacity=1) {
  const key=`outline:${w}:${h}:${radius}:${width}:${color}:${opacity}`;
  let value=cache.get(key);
  if(!value){value="data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" fill="none"><rect x="${width/2}" y="${width/2}" width="${w-width}" height="${h-width}" rx="${radius-width/2}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}"/></svg>`);cache.set(key,value);}
  return value;
}
export function cardOutline(w: number, h: number, focused: boolean) {
  const key = `card-outline:${w}:${h}:${focused}`;
  let value = cache.get(key);
  if (!value) {
    value = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">` +
      (focused
        ? `<rect x="1.5" y="1.5" width="${w-3}" height="${h-3}" rx="8.5" stroke="white" stroke-width="3"/><rect x="4" y="4" width="${w-8}" height="${h-8}" rx="6" stroke="black" stroke-opacity=".35" stroke-width="2"/>`
        : `<rect x=".5" y=".5" width="${w-1}" height="${h-1}" rx="9.5" stroke="white" stroke-opacity=".08"/>`) + '</svg>',
    );
    cache.set(key, value);
  }
  return value;
}
export function icon(name: string, dark = false, strokeWidth = 2.2, tint?: string) {
  const key = name + dark + strokeWidth + (tint ?? "");
  let value = cache.get(key);
  if (!value) {
    value =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${name === "play" ? (tint ?? (dark ? "#111113" : "#F4F2EE")) : "none"}" stroke="${name === "play" ? "none" : (tint ?? (dark ? "#111113" : "#F4F2EE"))}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] ?? paths.info}"/></svg>`,
      );
    cache.set(key, value);
  }
  return value;
}
/** Settings nav icons: the Tv3 settings boards' exact 28px strokes. */
const navIconPaths: Record<string, string> = {
  Account:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  Profiles:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Playback:
    '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  "Subtitles & audio":
    '<rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
  "Add-ons":
    '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 0-3.014-3.015 1 1 0 0 1 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',
  "Source integrations":
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  Display:
    '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  "Parental controls":
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  About:
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};
export function navIcon(name: string, dark = false, active = false) {
  const key = `nav:${name}:${dark}:${active}`;
  let value = cache.get(key);
  if (!value) {
    const stroke = dark ? "#111113" : active ? "#F4F2EE" : "#B6B4AF";
    value =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${navIconPaths[name] ?? navIconPaths.About}</svg>`,
      );
    cache.set(key, value);
  }
  return value;
}
export function Label(props: Record<string, any>) {
  return <TvText font="Onest" color={palette.text} {...props} lineheight={props.lineheight ?? (props.font === "Onest700" && props.size >= 40 ? 1.15 : undefined)} />;
}
export function Button(props: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  pill?: boolean;
  label?: string;
  icon?: string;
  iconSize?: number;
  focused: boolean;
  round?: boolean;
  disabled?: boolean;
  shadow?: boolean;
}) {
  return (
    <TvView x={props.x} y={props.y}>
    <Show when={props.shadow}><TvView x={-100} y={-100} w={(props.w??72)+200} h={(props.h??72)+200} src={buttonShadow(props.w??72,props.h??72,props.round||props.pill?(props.h??72)/2:12)} show={props.focused}/></Show>
    <TvView
      w={props.w ?? 72}
      h={props.h ?? 72}
      rounded={props.round || props.pill ? (props.h ?? 72) / 2 : 12}
      color={props.focused ? palette.text : "rgba(255,255,255,.16)"}
      alpha={props.disabled ? 0.45 : 1}
    >
      <Show when={props.icon}>
        <TvView
          x={props.label ? 28 : ((props.w ?? 72) - (props.iconSize ?? 28)) / 2}
          y={((props.h ?? 72) - (props.iconSize ?? 28)) / 2}
          w={props.iconSize ?? 28}
          h={props.iconSize ?? 28}
          src={icon(props.icon!, props.focused)}
        />
      </Show>
      <Show when={props.label}>
        <Label
          x={props.icon ? 66 : 24}
          centerY={(props.h ?? 72) / 2}
          size={(props.h ?? 72) <= 56 ? 22 : 26}
          font="Onest700"
          maxwidth={(props.w ?? 260) - (props.icon ? 82 : 48)}
          maxlines={1}
          content={props.label}
          color={props.focused ? "#111113" : palette.text}
        />
      </Show>
    </TvView>
    </TvView>
  );
}
/** One small cached gradient mask replaces five full-screen blend passes.
 * Artwork retains its own texture; focus changes never read back 1080p pixels. */
export function Backdrop(props: { src?: string | null; dim?: boolean }) {
  const [current, setCurrent] = createSignal<string>(),
    [previous, setPrevious] = createSignal<string>(),
    [opacity, setOpacity] = createSignal(1);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pixels = new ImageData(512, 288);
  for (let y = 0; y < 288; y++)
    for (let x = 0; x < 512; x++) {
      const px = ((x + 0.5) / 512) * 1920,
        py = ((y + 0.5) / 288) * 1080;
      const left =
        px < 652.8
          ? 0.85 - (0.3 * px) / 652.8
          : px < 1190.4
            ? 0.55 * (1 - (px - 652.8) / 537.6)
            : 0;
      const bottom =
        py < 560
          ? 0
          : py < 846
            ? (0.92 * (py - 560)) / 286
            : 0.92 + (0.08 * (py - 846)) / 234;
      const top = py < 200 ? 0.7 * (1 - py / 200) : 0;
      const i = (y * 512 + x) * 4;
      pixels.data[i] = 11;
      pixels.data[i + 1] = 11;
      pixels.data[i + 2] = 12;
      pixels.data[i + 3] = Math.round(
        (1 - (1 - left) * (1 - bottom) * (1 - top)) * 255,
      );
    }
  const mask = getRenderer().createTexture("ImageTexture", {
    src: pixels,
    premultiplyAlpha: true,
    key: "tv3-backdrop-mask-v1",
  });
  createEffect(() => {
    const src = props.src;
    let cancelled = false,
      frame = 0;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      setPrevious(reduced ? undefined : current());
      setOpacity(reduced ? 1 : 0);
      setCurrent(src ?? undefined);
      if (!reduced) {
        frame = requestAnimationFrame(() => setOpacity(1));
        cleanupTimer = setTimeout(() => setPrevious(undefined), 350);
      }
    };
    if (src) image.src = src;
    else {
      setCurrent(undefined);
      setPrevious(undefined);
    }
    onCleanup(() => {
      cancelled = true;
      image.onload = null;
      cancelAnimationFrame(frame);
      clearTimeout(cleanupTimer);
    });
  });
  return (
    <TvView w={1920} h={1080}>
      <TvView w={1920} h={1080} show={!current()} color={palette.bg} />
      <TvView
        w={1920}
        h={1080}
        show={!!previous()}
        color="#ffffff"
        src={previous()}
        fit="cover"
      />
      <TvView
        w={1920}
        h={1080}
        show={!!current()}
        color="#ffffff"
        src={current()}
        fit="cover"
        alpha={opacity()}
        transition={{
          alpha: { duration: 300, timingFunction: "cubic-bezier(.2,0,0,1)" },
        }}
      />
      <TvView w={1920} h={1080} color="#ffffff" texture={mask} />
      <TvView w={1920} h={1080} color="#000000" alpha={props.dim ? 0.5 : 0} />
    </TvView>
  );
}

import vynxcAvatar from "../../../design-contract/viptv-design-system/reference/assets/5112cc304140378385555c10e98d120d.png";
import zayneAvatar from "../../../design-contract/viptv-design-system/reference/assets/e12f8d0854be9217fda190bd7a21aebd.png";
export const avatar = (id?: string | null) =>
  id === "vynxc" ? vynxcAvatar : id === "zayne" ? zayneAvatar : undefined;
/** The reference uses lighten blending for monochrome title artwork. Convert
 * the black matte to alpha in a bounded render texture, preserving its aspect. */
export function Logo(props: {
  src: string;
  h: number;
  w?: number;
  maxWidth?: number;
  title?: string;
  size?: number;
}) {
  const [pixels, setPixels] = createSignal<ImageData>(),
    [dimensions, setDimensions] = createSignal({ w: 0, h: 0 });
  createEffect(() => {
    const src = props.src,
      height = props.h,
      width = props.w,
      maxWidth = props.maxWidth ?? 800;
    setPixels(undefined);
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const aspect = image.width / image.height;
        const h = width ? Math.min(height, width / aspect) : Math.max(1, Math.round(Math.min(height, maxWidth / aspect))),
          w = width ? h * aspect : Math.max(1, Math.round(aspect * h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(w);
        canvas.height = Math.ceil(h);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const white = Math.max(
            data.data[i],
            data.data[i + 1],
            data.data[i + 2],
          );
          data.data[i + 3] = Math.round((data.data[i + 3] * white) / 255);
          if (white) {
            data.data[i] = (data.data[i] * 255) / white;
            data.data[i + 1] = (data.data[i + 1] * 255) / white;
            data.data[i + 2] = (data.data[i + 2] * 255) / white;
          }
        }
        setDimensions({ w, h });
        setPixels(data);
      } catch {
        setPixels(undefined);
      }
    };
    image.src = src;
    onCleanup(() => {
      cancelled = true;
      image.onload = null;
    });
  });
  return (
    <Show
      when={pixels()}
      fallback={
        <Label
          size={props.size ?? 56}
          font="Onest700"
          maxwidth={800}
          maxlines={2}
          content={props.title ?? ""}
        />
      }
    >
      {(data) => <TvView w={dimensions().w} h={dimensions().h} src={data()} />}
    </Show>
  );
}
