/**
 * Roku entry for the shared tv-web SolidTV application.
 *
 * The native host supplies the SceneGraph renderer and browser-shaped globals.
 * This entry only bridges the renderer API differences and starts the same
 * createRemoteTvApp component the browser entry uses.
 */
import "./platform/roku-shims";
import { createRenderer, Config } from "@solidtv/solid";
import { createElement, insertNode, setProp } from "@roku-sdk/solid";
import { createComponent } from "solid-js";
import { setRendererStart } from "./renderer-clock";
import { createRemoteTvApp } from "./remote/App";
import { RemoteTvApi, type SessionStore } from "./remote/api";
import type { Tokens } from "./remote/types";

const STORE_KEY = "viptv-device:roku";
const API_ORIGIN = "https://beta-viptv.syek.tech";

const store: SessionStore = {
  async load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "null") as Tokens | null;
    } catch {
      return null;
    }
  },
  async save(tokens) {
    localStorage.setItem(STORE_KEY, JSON.stringify(tokens));
  },
  async clear() {
    localStorage.removeItem(STORE_KEY);
  },
  withLock(work) {
    return work();
  },
};

const api = new RemoteTvApi(API_ORIGIN, store, undefined, "web");

Config.fontSettings = { fontFamily: "Onest", fontSize: 32 };
Config.animationsEnabled = true;

const { renderer, render } = createRenderer(
  {
    appWidth: 1920,
    appHeight: 1080,
    deviceLogicalPixelRatio: 1,
    devicePhysicalPixelRatio: 1,
    clearColor: 0x00000000,
    targetFPS: 60,
    textBaselineMode: "linebox",
  },
  "app",
);

const native = renderer as any;

// The shared runtime passes a text spec object and expects { w, h }; the
// native renderer exposes the older positional measureText signature.
const nativeMeasure = native.measureText?.bind(native);
if (nativeMeasure) {
  native.measureText = (value: any, ...rest: any[]) => {
    if (value && typeof value === "object") {
      const measured = nativeMeasure(
        String(value.text ?? ""),
        value.fontFamily,
        value.fontWeight,
        value.fontSize ?? 32,
        value.letterSpacing ?? 0,
        value.maxWidth ?? 0,
      );
      const width = Number(measured?.width ?? measured?.w ?? 0);
      const height = Number(measured?.height ?? measured?.h ?? value.lineHeight ?? value.fontSize ?? 32);
      return { ...measured, w: width, h: height, width, height };
    }
    return nativeMeasure(value, ...rest);
  };
}

// SceneGraph cannot upload raw ImageData/SVG data URIs at runtime. Until the
// platform image-effects adapter replaces those paths, use the packaged
// fallback poster so layout still renders.
const nativeTexture = native.createTexture?.bind(native);
if (nativeTexture) {
  native.createTexture = (type: any, props: any = {}) => {
    const src = props?.src;
    if (src && typeof src === "object" && "data" in src) {
      return nativeTexture(type, {
        ...props,
        src: "pkg:/assets/fallback.png",
        w: src.width,
        h: src.height,
      });
    }
    if (typeof src === "string" && src.startsWith("data:image/svg+xml")) {
      return nativeTexture(type, {
        ...props,
        src: "pkg:/assets/fallback.png",
        w: props.w ?? 48,
        h: props.h ?? 48,
      });
    }
    return nativeTexture(type, props);
  };
}

// Native SceneGraph has no arbitrary WebGL shader pass. The platform effects
// adapter will replace these visuals; keep the node tree alive in the meantime.
native.registerShaderType = () => {};
native.registerShader = () => {};
native.createShader = () => null;

setRendererStart(native, performance.now());

// The shared UI's text node is a browser-renderer construct. On Roku, give
// each TvText a native SceneGraph label inside its transparent positioning
// group. This is the same primitive path the official SolidTV demo uses.
const nativeLabels = new WeakMap<any, any>();
const nativeFonts = new Map<string, any>();
function fontUri(family: string | undefined): string {
  const value = String(family ?? "Onest").toLowerCase();
  if (value.includes("bricolage")) return "pkg:/fonts/remote_bricolage_800.ttf";
  if (value.includes("onest")) {
    if (value.includes("700")) return "pkg:/fonts/remote_onest_700.ttf";
    if (value.includes("600")) return "pkg:/fonts/remote_onest_600.ttf";
    if (value.includes("500")) return "pkg:/fonts/remote_onest_500.ttf";
    return "pkg:/fonts/remote_onest_400.ttf";
  }
  return "pkg:/fonts/Roboto-Regular.ttf";
}
function rokuColor(value: any): any {
  if (typeof value === "number") return value >>> 0;
  if (typeof value !== "string" || !value) return 0xffffffff;
  if (value.charAt(0) === "#") {
    const hex = value.slice(1);
    return parseInt(hex.length === 6 ? hex + "ff" : hex, 16) >>> 0;
  }
  return 0xffffffff;
}
(globalThis as any).__viptvNativeText = (group: any, p: any) => {
  if (!group) return;
  let label = nativeLabels.get(group);
  if (!label) {
    label = createElement("label");
    insertNode(group, label);
    nativeLabels.set(group, label);
  }
  const size = Math.max(1, Math.round(Number(p.size) || 32));
  const uri = fontUri(p.font);
  const key = uri + "@" + size;
  let font = nativeFonts.get(key);
  if (!font) {
    font = createElement("font");
    setProp(font, "uri", uri);
    setProp(font, "size", size);
    insertNode(group, font);
    nativeFonts.set(key, font);
  }
  setProp(label, "font", font);
  setProp(label, "text", String(p.text ?? ""));
  setProp(label, "width", Math.max(1, Math.ceil(Number(p.width) || 1)));
  setProp(label, "height", Math.max(1, Math.ceil(Number(p.height) || 1)));
  setProp(label, "horizAlign", p.align === "center" ? "center" : p.align === "right" ? "right" : "left");
  setProp(label, "vertAlign", "center");
  setProp(label, "wrap", true);
  setProp(label, "maxLines", Math.max(0, Math.floor(Number(p.maxlines) || 0)));
  setProp(label, "color", rokuColor(p.color));
  setProp(label, "translation", [0, 0]);
};

try {
  render(() => createComponent(createRemoteTvApp(api, "web"), {}));
} catch (error: any) {
  console.error("ROKU_RENDER_ERROR " + String(error?.stack || error));
}

