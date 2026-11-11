import {
  For,
  batch,
  createEffect,
  createMemo,
  createContext,
  createComponent,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  useContext,
  type Component,
  type JSX,
} from "solid-js";
import type { ImageTexture, RendererMain } from "@solidtv/renderer";
import { sdfFontFamily, sdfLineHeight } from "./fonts";
import {
  Config,
  activeElement,
  createElement,
  getRenderer,
  insert,
  spread,
  type ElementNode,
} from "@solidtv/solid";
import {
  useFocusManager,
  suppressKeyUntilRelease,
  releaseKeySuppression,
} from "@solidtv/solid/primitives";

// Native fonts publish asynchronously. Text layout memos subscribe to this
// epoch so a face that becomes measurable after the first frame reflows the
// shared tree instead of freezing zero-width metrics. The browser never bumps
// it, so the DOM build is unchanged.
const [fontEpoch, setFontEpoch] = createSignal(0);
export const fontEpochSignal = () => fontEpoch();
(globalThis as any).__solidtvNotifyFont = () => setFontEpoch((value) => value + 1);

/** The screen controller contract keeps the existing remote actions intact.
 * Solid owns every signal, component lifetime and rendered node. */
interface ScreenActions {
  $select(ref: string): ScreenInstance | undefined;
  $focus(): void;
  $emit(name: string, value?: unknown): void;
  $listen<T>(name: string, callback: (value: T) => void): void;
}
type ScreenInstance = ScreenActions & Record<string, any>;
type Methods = Record<string, (...args: any[]) => any>;
type Definition<P, S, M> = {
  props?: P;
  state?: (this: Readonly<P> & ScreenActions) => S;
  components?: Record<string, Component<any>>;
  render: (state: NoInfer<P & S & M> & ScreenActions) => JSX.Element;
  hooks?: Methods & ThisType<P & S & M & ScreenActions>;
  methods?: M & ThisType<P & S & M & ScreenActions>;
  input?: Methods & ThisType<P & S & M & ScreenActions>;
  watch?: Methods & ThisType<P & S & M & ScreenActions>;
};
interface ScreenScope {
  instance: ScreenInstance;
  parent?: ScreenScope;
  refs: Map<string, ScreenInstance>;
  input: Methods;
  hooks: Methods;
  node?: ElementNode;
  cancelReleases: Set<() => void>;
  leafFocused: boolean;
}
const Scope = createContext<ScreenScope>();
/** Native SceneGraph cannot express a z-index per node. Shared overlay content
 * marks its subtree so the Roku host can paint it above ordinary screen text. */
export const ModalLayerContext = createContext(false);
const nodeScopes = new WeakMap<ElementNode, ScreenScope>();
const pendingReleases = new Set<() => void>();
function unfocusScope(scope: ScreenScope | undefined) {
  if (!scope?.leafFocused) return;
  scope.leafFocused = false;
  scope.hooks.unfocus?.();
}
function focusScope(scope: ScreenScope | undefined) {
  if (!scope || scope.leafFocused) return;
  scope.leafFocused = true;
  scope.hooks.focus?.();
}

export function defineScreen<
  P extends object = {},
  S extends object = {},
  M extends Methods = {},
>(definition: Definition<P, S, M>): Component<any> {
  return (props: Record<string, any>) => {
    const parent = useContext(Scope);
    if (!parent) useRemoteInput();
    const listeners = new Map<string, Set<(value: any) => void>>();
    const data: Record<string, any> = {};
    const instance = data as ScreenInstance;
    const scope: ScreenScope = {
      instance,
      parent,
      refs: new Map(),
      input: {},
      hooks: {},
      cancelReleases: new Set(),
      leafFocused: false,
    };
    const initial = untrack(
      () => definition.state?.call(props as P & ScreenActions) ?? {},
    );
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(initial),
    )) {
      // Static textures are built only when their first visible screen reads
      // them. Preserve the getter rather than evaluating it during setup.
      if (descriptor.get) {
        let initialized = false;
        let value: unknown;
        Object.defineProperty(data, key, {
          enumerable: true,
          get() {
            if (!initialized) {
              value = untrack(() => descriptor.get!.call(initial));
              initialized = true;
            }
            return value;
          },
        });
        continue;
      }
      const value = descriptor.value;
      const [read, write] = createSignal(value);
      Object.defineProperty(data, key, {
        enumerable: true,
        get: read,
        set: (next) => write(() => next),
      });
    }
    for (const key of (definition.props as unknown as string[] | undefined) ??
      []) {
      if (!(key in data))
        Object.defineProperty(data, key, {
          enumerable: true,
          get: () => props[key],
        });
    }
    Object.assign(data, {
      $select: (ref: string) => scope.refs.get(ref),
      $focus: () => batch(() => scope.node?.setFocus()),
      $listen: (name: string, callback: (value: any) => void) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add(callback);
      },
      $emit: (name: string, value?: unknown) => {
        let current: ScreenScope | undefined = scope;
        while (current) {
          current.instance.__dispatch(name, value);
          current = current.parent;
        }
      },
      __dispatch: (name: string, value: unknown) =>
        listeners.get(name)?.forEach((callback) => callback(value)),
    });
    for (const [key, fn] of Object.entries(definition.methods ?? {}))
      data[key] = (fn as Function).bind(data);
    for (const [key, fn] of Object.entries(definition.hooks ?? {}))
      scope.hooks[key] = fn.bind(data);
    for (const [key, fn] of Object.entries(definition.input ?? {}))
      scope.input[key] = fn.bind(data);
    createRenderEffect(() => {
      const ref = props.screenRef;
      if (parent && ref !== undefined) {
        parent.refs.set(String(ref), instance);
        onCleanup(() => {
          if (parent.refs.get(String(ref)) === instance)
            parent.refs.delete(String(ref));
        });
      }
    });
    for (const [key, fn] of Object.entries(definition.watch ?? {})) {
      let first = true;
      createRenderEffect(() => {
        const value = data[key];
        if (!first) untrack(() => fn.call(data, value));
        first = false;
      });
    }
    onMount(() => {
      if (!parent) instance.$focus();
      scope.hooks.ready?.();
    });
    onCleanup(() => {
      scope.hooks.destroy?.();
      for (const cancel of scope.cancelReleases) cancel();
      unfocusScope(scope);
      if (scope.node) nodeScopes.delete(scope.node);
      listeners.clear();
    });
    return createComponent(Scope.Provider, {
      value: scope,
      get children() {
        return TvView({
          w: 1920,
          h: 1080,
          nodeRef: (node: ElementNode) => { scope.node = node; nodeScopes.set(node,scope); },
          onFocus: (current: ElementNode, previous?: ElementNode) => {
            if (current !== scope.node) return;
            batch(() => {
              if (previous) unfocusScope(nodeScopes.get(previous));
              focusScope(scope);
            });
          },
          onBlur: () => unfocusScope(scope),
          onKeyPress: (event: KeyboardEvent, mappedKey?: string) => {
            const handler = scope.input[mappedKey?.toLowerCase() ?? ""] ?? scope.input.any;
            if (!handler) return false;
            const release = handler(event);
            if (typeof release === "function") {
              let cancelled = false;
              const cancel = () => {
                cancelled = true;
                if (typeof instance.pressed === "boolean") instance.pressed = false;
                releaseKeySuppression(event);
              };
              scope.cancelReleases.add(cancel);
              pendingReleases.add(cancel);
              suppressKeyUntilRelease(event, () => {
                scope.cancelReleases.delete(cancel);
                pendingReleases.delete(cancel);
                if (!cancelled) release();
              });
            }
            return true;
          },
          get x() {
            return props.x ?? 0;
          },
          get y() {
            return props.y ?? 0;
          },
          get show() {
            return props.show ?? true;
          },
          get children() {
            return definition.render(instance as P & S & M & ScreenActions);
          },
        });
      },
    });
  };
}

/** SolidTV owns the active element, focus path, key bubbling and releases. */
function useRemoteInput() {
  Config.preventDefaultOnHandledKeys = true;
  useFocusManager({
    Left: ["ArrowLeft", 37], Right: ["ArrowRight", 39],
    Up: ["ArrowUp", 38], Down: ["ArrowDown", 40], Enter: ["Enter", 13],
    Back: ["Escape", "Backspace", "GoBack", "BrowserBack", 10009, 461, 8, 27],
    Menu: ["ContextMenu", 457, 93],
  });
  const blur = () => {
    for (const cancel of pendingReleases) cancel();
    const node = activeElement();
    if (node) unfocusScope(nodeScopes.get(node));
  };
  const focus = () => {
    const node = activeElement();
    if (node) focusScope(nodeScopes.get(node));
  };
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  onCleanup(() => {
    for (const cancel of pendingReleases) cancel();
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", focus);
  });
}

const names: Record<string, string> = {
  w: "width",
  h: "height",
  font: "fontFamily",
  size: "fontSize",
  maxwidth: "maxWidth",
  maxheight: "maxHeight",
  maxlines: "maxLines",
  letterspacing: "letterSpacing",
  lineheight: "lineHeight",
  align: "textAlign",
  content: "text",
};
const ROKU = typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";
const colorCache = new Map<string, number>();
function tvColor(value: string | number): number {
  if (!value) return 0;
  if (typeof value === "number") return value >>> 0;
  if (typeof value !== "string") return 0;
  if (value.startsWith("#"))
    return parseInt(value.slice(1) + (value.length === 7 ? "ff" : ""), 16);
  const cached = colorCache.get(value);
  if (cached) return cached;
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match) throw new Error(`Unsupported TV color: ${value}`);
  const [r, g, b, a = 1] = match[1].split(",").map(Number);
  const color = ((r << 24) | (g << 16) | (b << 8) | Math.round(a * 255)) >>> 0;
  colorCache.set(value, color);
  return color;
}
const imageTextures = new WeakMap<ImageData, ImageTexture>();
function imageTexture(image: ImageData) {
  let texture = imageTextures.get(image);
  if (!texture) {
    texture = ROKU
      ? getRenderer().createTexture("ImageTexture", {
          src: "",
          w: image.width,
          h: image.height,
        })
      : getRenderer().createTexture("ImageTexture", {
          src: image,
          premultiplyAlpha: true,
        });
    imageTextures.set(image, texture);
  }
  return texture;
}

function visualNode(
  props: Record<string, any>,
  kind: "node" | "text" = "node",
): JSX.Element {
  const modalLayer = useContext(ModalLayerContext);
  const node = createElement(kind) as ElementNode;
  const transitions = props.transition;
  if (ROKU && 'children' in props && transitions &&
    ['x','y','alpha'].some(key => key in props && (transitions === true || transitions[key]))) {
    (node.lng as any).nativeMotionRoot = true;
    (node.lng as any).nativeCompositorPrepared = true;
  }
  // The browser renderer reads width/height; the native SceneGraph host's
  // RokuNode reads w/h. Keep the platform mapping in one place so the shared
  // tv-web tree does not have to fork.
  const mapped: Record<string, any> = ROKU
    ? { color: 0x00000000, w: 0, h: 0 }
    : { color: 0x00000000, width: 0, height: 0 };
  // Roku's JS engine loses per-iteration `const` bindings captured by
  // closures; use forEach so each mapped getter closes over its own key.
  Object.keys(props).forEach((key) => {
    if (
      ["children", "show", "alpha", "fit", "preload", "decodeWidth", "decodeHeight", "focusRing", "nodeRef", "onError", "onLoad", "cssLineBox"].includes(key)
    )
      return;
    if (key === "src" && props[key] == null) {
      // Async artwork starts empty; retain the URL binding for its later load.
      Object.defineProperty(mapped, "src", { enumerable: true, get: () => props.src ?? "" });
      return;
    }
    if (key === "texture") {
      Object.defineProperty(mapped, "texture", { enumerable: true, get: () => props.texture ?? null });
      return;
    }
    if (
      key === "src" &&
      typeof props.src === "string" &&
      props.src.startsWith("data:image/x-viptv-qr,")
    ) {
      Object.defineProperty(mapped, "src", { enumerable: true, get: () => "" });
      return;
    }
    if (key === "src" && props.src instanceof ImageData) {
      if (ROKU && props.src.width === 480 && props.src.height === 33) {
        // The shared top-bar scrim is a canvas-generated alpha gradient. Use
        // the packaged equivalent so the nav remains legible on SceneGraph.
        Object.defineProperty(mapped, "src", {
          enumerable: true,
          get: () => "pkg:/assets/topbar-scrim.png",
        });
      } else {
        Object.defineProperty(mapped, "texture", {
          enumerable: true,
          get: () => imageTexture(props.src),
        });
      }
      return;
    }
    if (key === "src" && typeof props.src === "string" && props.src.startsWith("data:image/svg+xml")) {
      // The renderer's URL detector recognizes .svg files, not SVG data URIs.
      // SceneGraph cannot rasterize SVG text; the native bridge below maps
      // icon data URIs to packaged PNGs, so keep the string instead of an
      // empty texture on Roku.
      if (!ROKU) {
        Object.defineProperty(mapped, "texture", {
          enumerable: true,
          get: () =>
            getRenderer().createTexture("ImageTexture", {src:props.src,type:"svg",w:props.w,h:props.h}),
        });
      }
      // Roku: leave the host node without a URI. The native bridge below
      // maps the SVG to a packaged PNG and owns the SceneGraph poster.
      return;
    }
    const name = ROKU && (key === "w" || key === "h") ? key : (names[key] ?? key);
    Object.defineProperty(mapped, name, {
      enumerable: true,
      configurable: true,
      get: () =>
        name.startsWith("color")
          ? tvColor(props[key])
          : name === "fontFamily"
            ? sdfFontFamily(props[key], props.size ?? 32)
          : name === "text"
            ? String(props[key] ?? "")
            : props[key],
    });
  });
  if (
    ROKU &&
    (props.w ?? 0) >= 1900 &&
    (props.h ?? 0) >= 1000 &&
    typeof props.src !== "string"
  ) {
    // Full-screen masks/scrims are canvas textures on the browser. Their host
    // visual would be an opaque white rectangle when the texture is empty.
    Object.defineProperty(mapped, "color", {
      enumerable: true,
      configurable: true,
      get: () => 0,
    });
  }
  const topBarScrim =
    ROKU &&
    props.src instanceof ImageData &&
    props.src.width === 480 &&
    props.src.height === 33;
  if (props.src !== undefined && props.color === undefined)
    mapped.color =
      ROKU && !topBarScrim &&
      (props.src instanceof ImageData ||
        (typeof props.src === "string" && props.src.startsWith("data:image/svg+xml")))
        ? 0x00000000
        : topBarScrim
          ? 0x00000000
          : 0xffffffff;
  Object.defineProperty(mapped, "alpha", {
    enumerable: true,
    get: () => (props.show === false ? 0 : (props.alpha ?? 1)),
  });
  if (props.fit !== undefined || props.preload !== undefined)
    Object.defineProperty(mapped, "textureOptions", {
      enumerable: true,
      get: () => ({ ...props.textureOptions, ...(props.fit ? { resizeMode: { type: props.fit } } : {}),
        ...(props.preload !== undefined ? { preload: props.preload } : {}) }),
    });
  if (props.onError || props.onLoad)
    mapped.onEvent = ROKU ? { failed: () => props.onError?.() }
      : { failed: () => props.onError?.(), loaded: () => props.onLoad?.() };
  // The shared runtime uses `nodeRef` as a post-render callback, not the
  // Solid `ref` field. The core ignores it, so call it once the ElementNode
  // exists; text/native bridges and the screen focus scope depend on this.
  if (props.nodeRef) onMount(() => props.nodeRef(node));
  spread(node, mapped, true);
  // The native host's RokuNode reads x/y/w/h from the plain props object.
  // Ensure the tv-web getters are materialised there as well; the generic
  // spread path can miss getter-only layout values on the native renderer.
  if (ROKU) {
    const read = (value: any) => (typeof value === "function" ? value() : value);
    const x = read(props.x);
    const y = read(props.y);
    const w = read(props.w);
    const h = read(props.h);
    if (x !== undefined) node.x = x;
    if (y !== undefined) node.y = y;
    if (w !== undefined) node.w = w;
    if (h !== undefined) node.h = h;
    if (
      typeof (globalThis as any).__viptvNativeVisual === "function" &&
      (props.shader === undefined || typeof props.src === "string" || topBarScrim) &&
      (props.src === undefined || typeof props.src === "string" || topBarScrim) &&
      (props.color !== undefined || props.src !== undefined || props.texture !== undefined)
    ) {
      const spec = () => ({
        color: props.color,
        src: topBarScrim
          ? "pkg:/assets/topbar-scrim.png"
          : typeof props.src === "string"
            ? props.src
            : undefined,
        texture: props.texture,
        w: props.w,
        h: props.h,
        alpha: props.show === false ? 0 : (props.alpha ?? 1),
        fit: props.fit,
        modal: modalLayer,
        logo: props.logo === true,
        focusRing: props.focusRing === true,
        decodeWidth: props.decodeWidth,
        decodeHeight: props.decodeHeight,
        onLoad: props.onLoad,
      });
      const update = () => {
        const current = node as any;
        if (current?.lng?.dom)
          (globalThis as any).__viptvNativeVisual(current.lng, spec());
      };
      createEffect(update);
      onMount(update);
      onCleanup(() => {
        const current = node as any;
        (globalThis as any).__viptvNativeVisualRemove?.(current?.lng);
      });
    }
  }
  props.nodeRef?.(node);
  // Keep each node's original sibling position even while invisible. Only
  // defer its subtree; late insertion of an outline/image can cover siblings.
  const mounted = createMemo(
    (wasMounted) => wasMounted || props.show !== false,
    false,
  );
  insert(node, () => (mounted() ? props.children : undefined));
  return node as unknown as JSX.Element;
}
/** Server-owned display preference: profile text size scales every rasterized
 * label. Layout positions are unchanged; only glyph rasterization scales. */
const [textScaleSignal, setTextScaleSignal] = createSignal(1);
export const textScale = () => textScaleSignal();
export function setTextScale(value: number) {
  setTextScaleSignal(value);
}
export const TvView = (props: Record<string, any>) => visualNode(props);
/** Keep one visible node. Upload a replacement before swapping; color is a
 * quad tint, so focus changes never evict glyphs or rasterize the same label. */
function rokuText(props: Record<string, any>): JSX.Element {
  const modalLayer = useContext(ModalLayerContext);
  const [node, setNode] = createSignal<ElementNode>();
  const spec = createMemo(() => {
    fontEpoch();
    const fontSize = Number(props.size ?? 32);
    const family = sdfFontFamily(props.font ?? "Onest", fontSize);
    return {
      text: String(props.content ?? ""),
      fontFamily: family,
      fontSize,
      maxWidth: props.maxwidth ?? props.w ?? 0,
      maxHeight: props.maxheight ?? 0,
      maxLines: props.maxlines ?? 0,
      lineHeight:
        props.lineheight !== undefined
          ? fontSize * props.lineheight
          : sdfLineHeight(family, fontSize),
      letterSpacing: props.letterspacing ?? 0,
    };
  });
  const size = createMemo(() => {
    const value = spec();
    const measured = (getRenderer() as RendererMain).measureText(value);
    if (measured && Number(measured.w) > 1) return measured;
    // Native FontMeasure is unavailable until the firmware publishes the
    // face. Keep the first layout close enough to render and let the font
    // epoch reflow to the exact width when the host reports readiness.
    return {
      w: value.maxWidth || Math.max(1, value.text.length * value.fontSize * 0.55),
      h: value.lineHeight,
    };
  });
  const boxW = () => props.maxwidth ?? props.w ?? size().w ?? 0;
  const boxX = () =>
    (props.x ?? 0) +
    (boxW() > 0
      ? Math.max(0, boxW() - (size().w ?? 0)) *
        (props.align === "right" ? 1 : props.align === "center" ? 0.5 : 0)
      : 0);
  const boxY = () =>
    props.centerY !== undefined
      ? props.centerY - (size().h ?? 0) / 2
      : (props.y ?? 0);
  const update = (current: any) => {
    if (!current?.lng?.dom) return;
    (globalThis as any).__viptvNativeText(current.lng, {
      text: spec().text,
      width: boxW(),
      textWidth: size().w ?? 0,
      height: size().h ?? props.h ?? 0,
      font: props.font,
      size: spec().fontSize,
      color: props.color ?? "#ffffff",
      align: props.align,
      maxlines: props.maxlines,
      lineHeight: spec().lineHeight,
      alpha: props.show === false ? 0 : (props.alpha ?? 1),
      modal: modalLayer,
      auto: (props.maxwidth ?? props.w) === undefined,
    });
  };
  createEffect(() => update(node()));
  onMount(() => update(node()));
  onCleanup(() => (globalThis as any).__viptvNativeTextRemove?.(node()?.lng));
  return visualNode(
    {
      get x() {
        return boxX();
      },
      get y() {
        return boxY();
      },
      get w() {
        return boxW();
      },
      get h() {
        return size().h ?? props.h ?? 0;
      },
      get alpha() {
        return props.alpha ?? 1;
      },
      get show() {
        return props.show ?? true;
      },
      nodeRef: (value: ElementNode) => {
        setNode(value);
        props.nodeRef?.(value);
      },
    },
    "node",
  );
}

export function TvText(props: Record<string, any>): JSX.Element {
  if (ROKU && typeof (globalThis as any).__viptvNativeText === "function") return rokuText(props);
  let debugNode: ElementNode | undefined;
  const [mountedNode, setMountedNode] = createSignal<ElementNode>();
  const scaledSize = () => (props.size ?? 32) * textScale();
  const family = () => sdfFontFamily(props.font ?? "Onest", scaledSize());
  const lineHeight = () =>
    props.lineheight !== undefined
      ? scaledSize() * props.lineheight
      : sdfLineHeight(family(), scaledSize());
  const textProps = createMemo(
    () => ({
      text: String(props.content ?? ""),
      fontFamily: family(),
      fontSize: scaledSize(),
      maxWidth: props.maxwidth ?? props.w ?? 0,
      maxHeight: props.maxheight ?? 0,
      maxLines: props.maxlines ?? 0,
      lineHeight: lineHeight(),
      letterSpacing: props.letterspacing ?? 0,
      overflowSuffix: "…",
      wordBreak: (props.maxlines === 1 ? "break-all" : "break-word") as
        | "break-all"
        | "break-word",
    }),
    undefined,
    {
      equals: (a, b) =>
        a.text === b.text &&
        a.fontFamily === b.fontFamily &&
        a.fontSize === b.fontSize &&
        a.maxWidth === b.maxWidth &&
        a.maxHeight === b.maxHeight &&
        a.maxLines === b.maxLines &&
        a.lineHeight === b.lineHeight &&
        a.letterSpacing === b.letterSpacing &&
        a.wordBreak === b.wordBreak,
    },
  );
  // The renderer lays the text out from its SDF atlas; measuring it gives the
  // same block size the rasterized label used to report, so every caller's
  // geometry (alignment shift, flex width) is unchanged. Alignment is applied
  // to the block here: the design aligns only single-line labels, so a text
  // node's own line alignment is not needed (and `contain` would feed the
  // measured width back into maxWidth).
  const size = createMemo(() => {
    fontEpoch();
    const value = textProps();
    return (getRenderer() as RendererMain).measureText(value) ?? { w: value.maxWidth, h: value.lineHeight };
  });
  if (new URLSearchParams(location.search).get("focusdebug") === "1")
    onMount(() => {
      if (debugNode?.lng)
        Object.defineProperty(debugNode.lng, "viptvText", {
          get: () => String(props.content ?? ""),
        });
    });
  // Roku's native text node does not receive the solidtv text props through
  // the generic prop bridge. Apply the resolved string directly once the
  // ElementNode has its native node, and keep it in sync on content changes.
  // The browser renderer receives text through its normal prop path.
  createEffect(() => {
    const node = mountedNode() as any;
    const value = textProps().text;
    if (node?.lng && (globalThis as any).__SolidTVRokuRenderer)
      node.lng.text = value;
  });
  return visualNode(
    {
      get x() {
        const width = props.maxwidth ?? props.w ?? 0;
        return (
          (props.x ?? 0) +
          (width > 0
            ? Math.max(0, width - (size().w ?? 0)) *
              (props.align === "right" ? 1 : props.align === "center" ? 0.5 : 0)
            : 0)
        );
      },
      get y() {
        return props.centerY !== undefined
          ? props.centerY - (size().h ?? 0) / 2
          : (props.y ?? 0);
      },
      get w() {
        // A boxed label (w/maxwidth) reports the box, not the measured glyph
        // run: the renderer derives a text node's maxWidth from its width when
        // it has none, so a measured width would wrap the text at its own edge.
        return props.maxwidth ?? props.w ?? size().w ?? 0;
      },
      get h() {
        return size().h ?? 0;
      },
      get text() {
        return textProps().text;
      },
      get fontFamily() {
        return textProps().fontFamily;
      },
      get fontSize() {
        return textProps().fontSize;
      },
      get lineHeight() {
        return textProps().lineHeight;
      },
      get letterSpacing() {
        return textProps().letterSpacing;
      },
      get maxWidth() {
        return textProps().maxWidth;
      },
      get maxHeight() {
        return textProps().maxHeight;
      },
      get maxLines() {
        return textProps().maxLines;
      },
      get overflowSuffix() {
        return textProps().overflowSuffix;
      },
      get wordBreak() {
        return textProps().wordBreak;
      },
      get color() {
        return props.color ?? "#ffffff";
      },
      get alpha() {
        return String(props.content ?? "").length === 0 ? 0 : (props.alpha ?? 1);
      },
      get show() {
        return props.show ?? true;
      },
      nodeRef: (node: ElementNode) => {
        debugNode = node;
        setMountedNode(node);
        props.nodeRef?.(node);
      },
    },
    "text",
  );
}

/** Keep controller/focus lifetimes stable when a view model is reprojected. */
export function KeyedFor<T>(props: {
  each: T[];
  keyOf: (item: T) => unknown;
  children: (item: () => T, index: () => number) => JSX.Element;
}): JSX.Element {
  type Entry = { value: () => T; update: (value: T) => void };
  let cache = new Map<unknown, Entry>();
  const entries = createMemo(() => {
    const next = new Map<unknown, Entry>();
    const result = props.each.map((item) => {
      const key = props.keyOf(item);
      let entry = cache.get(key);
      if (!entry) {
        const [value, update] = createSignal(item);
        entry = { value, update: (item) => update(() => item) };
      } else entry.update(item);
      next.set(key, entry);
      return entry;
    });
    cache = next;
    return result;
  });
  return createComponent(For, {
    get each() {
      return entries();
    },
    children: (entry: Entry, index: () => number) =>
      props.children(entry.value, index),
  });
}
