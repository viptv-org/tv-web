import {
  For,
  batch,
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
import type { ImageTexture } from "@solidtv/renderer";
import {
  createElement,
  getRenderer,
  insert,
  spread,
  type ElementNode,
} from "@solidtv/solid";

/** The screen controller contract keeps the existing remote actions intact.
 * Solid owns every signal, component lifetime and rendered node. */
export interface ScreenActions {
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
}
const Scope = createContext<ScreenScope>();
let focused: ScreenScope | undefined;

export function defineScreen<
  P extends object = {},
  S extends object = {},
  M extends Methods = {},
>(definition: Definition<P, S, M>): Component<any> {
  return (props: Record<string, any>) => {
    const parent = useContext(Scope);
    const listeners = new Map<string, Set<(value: any) => void>>();
    const data: Record<string, any> = {};
    const instance = data as ScreenInstance;
    const scope: ScreenScope = {
      instance,
      parent,
      refs: new Map(),
      input: {},
      hooks: {},
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
      $focus: () => {
        if (focused === scope) return;
        const previous = focused;
        focused = scope;
        batch(() => {
          previous?.hooks.unfocus?.();
          scope.hooks.focus?.();
        });
      },
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
      if (focused === scope) {
        scope.hooks.unfocus?.();
        focused = undefined;
      }
      listeners.clear();
    });
    return createComponent(Scope.Provider, {
      value: scope,
      get children() {
        return TvView({
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

/** Preserve key-down navigation and key-up activation, including 700ms holds. */
export function installRemoteInput() {
  const releases = new Map<string, () => void>();
  const keys: Record<string, string> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Enter: "enter",
    Escape: "back",
    Backspace: "back",
    ContextMenu: "menu",
  };
  const codes: Record<number, string> = {
    10009: "back",
    461: "back",
    457: "menu",
    93: "menu",
    8: "back",
    27: "back",
    13: "enter",
    37: "left",
    38: "up",
    39: "right",
    40: "down",
  };
  const down = (event: KeyboardEvent) => {
    const action = codes[event.keyCode] ?? keys[event.key];
    let target = focused;
    while (target) {
      const handler = target.input[action] ?? target.input.any;
      if (handler) {
        event.preventDefault();
        const release = handler(event);
        if (
          typeof release === "function" &&
          !releases.has(event.code || event.key)
        )
          releases.set(event.code || event.key, release);
        return;
      }
      target = target.parent;
    }
  };
  const up = (event: KeyboardEvent) => {
    const key = event.code || event.key;
    const release = releases.get(key);
    releases.delete(key);
    release?.();
  };
  const blur = () => {
    releases.clear();
    focused?.hooks.unfocus?.();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    releases.clear();
  };
}

const names: Record<string, string> = {
  w: "width",
  h: "height",
  rounded: "borderRadius",
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
const colorCache = new Map<string, number>();
export function tvColor(value: string): number {
  if (!value) return 0;
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
// The previous canvas used a hanging baseline. SolidTV uses alphabetic
// line boxes; measure the font's baseline distance to preserve screen geometry.
const baselineCache = new Map<string, number>();
let measure: CanvasRenderingContext2D | null;
function baselineOffset(font: string, size: number): number {
  const key = `${font}:${size}`;
  if (baselineCache.has(key)) return baselineCache.get(key)!;
  measure ??= document.createElement("canvas").getContext("2d")!;
  measure.font = `${size}px Unknown, ${font}`;
  measure.textBaseline = "alphabetic";
  const alphabetic = measure.measureText("Mg").actualBoundingBoxAscent;
  measure.textBaseline = "hanging";
  const hanging = measure.measureText("Mg").actualBoundingBoxAscent;
  const offset = alphabetic - hanging - size * 0.8;
  baselineCache.set(key, offset);
  return offset;
}
const imageTextures = new WeakMap<ImageData, ImageTexture>();
function imageTexture(image: ImageData) {
  let texture = imageTextures.get(image);
  if (!texture) {
    texture = getRenderer().createTexture("ImageTexture", {
      src: image,
      premultiplyAlpha: true,
    });
    imageTextures.set(image, texture);
  }
  return texture;
}

function visualNode(
  kind: "node" | "text",
  props: Record<string, any>,
): JSX.Element {
  const node = createElement(kind) as ElementNode;
  const mapped: Record<string, any> = { color: 0x00000000 };
  if (kind === "node") Object.assign(mapped, { width: 0, height: 0 });
  if (kind === "text")
    Object.assign(mapped, {
      color: 0xffffffff,
      fontFamily: "Onest",
      fontSize: 32,
      contain: props.maxwidth !== undefined ? "width" : undefined,
    });
  for (const key of Object.keys(props)) {
    if (
      ["children", "show", "alpha", "fit", "nodeRef", "onError"].includes(key)
    )
      continue;
    if (key === "src" && props.src instanceof ImageData) {
      Object.defineProperty(mapped, "texture", {
        enumerable: true,
        get: () => imageTexture(props.src),
      });
      continue;
    }
    const name = names[key] ?? key;
    Object.defineProperty(mapped, name, {
      enumerable: true,
      configurable: true,
      get: () =>
        name.startsWith("color")
          ? tvColor(props[key])
          : name === "text"
            ? String(props[key] ?? "")
            : props[key],
    });
  }
  if (props.src !== undefined && props.color === undefined)
    mapped.color = 0xffffffff;
  Object.defineProperty(mapped, "alpha", {
    enumerable: true,
    get: () => (props.show === false ? 0 : (props.alpha ?? 1)),
  });
  if (props.fit !== undefined)
    Object.defineProperty(mapped, "textureOptions", {
      enumerable: true,
      get: () => ({ resizeMode: { type: props.fit } }),
    });
  if (kind === "text")
    Object.defineProperty(mapped, "y", {
      enumerable: true,
      configurable: true,
      get: () =>
        (props.y ?? 0) +
        baselineOffset(props.font ?? "Onest", props.size ?? 32),
    });
  if (props.onError) mapped.onEvent = { failed: () => props.onError() };
  spread(node, mapped, true);
  // Keep each node's original sibling position even while invisible. Only
  // defer its subtree; late insertion of an outline/image can cover siblings.
  const mounted = createMemo(
    (wasMounted) => wasMounted || props.show !== false,
    false,
  );
  insert(node, () => (mounted() ? props.children : undefined));
  return node as unknown as JSX.Element;
}
export const TvView = (props: Record<string, any>) => visualNode("node", props);
// Canvas text colors are baked into glyph textures. Replace the text node on
// a color change so a reused glyph texture cannot retain the previous focus tint.
export const TvText = (props: Record<string, any>) =>
  createMemo(() => {
    props.color;
    return untrack(() => visualNode("text", props));
  }) as unknown as JSX.Element;

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
