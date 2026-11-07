/**
 * Roku entry for the shared tv-web SolidTV application.
 *
 * The native host supplies the SceneGraph renderer and browser-shaped globals.
 * This entry only bridges the renderer API differences and starts the same
 * createRemoteTvApp component the browser entry uses.
 */
import "./platform/roku-shims";
import { createRenderer, Config } from "@solidtv/solid";
import { createElement, insertNode, setProp, tmTransaction } from "@roku-sdk/solid";
import { createComponent } from "solid-js";
import { setRendererStart } from "./renderer-clock";
import { createRemoteTvApp } from "./remote/App";
import { RemoteTvApi, type SessionStore } from "./remote/api";
import type { Tokens } from "./remote/types";
import QRCode from "qrcode/lib/core/qrcode";
import { createRokuPlayer } from "./platform/roku-player";

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
      let width = Number(measured?.width ?? measured?.w ?? 0);
      const text = String(value.text ?? "");
      const size = Number(value.fontSize ?? 32);
      if ((!width || !isFinite(width)) && text)
        width = Math.max(1, text.length * size * 0.55);
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
      // Canvas-generated masks/shadows cannot be uploaded to SceneGraph. Keep
      // the host node transparent instead of showing the fallback poster over
      // the native labels.
      return nativeTexture(type, { ...props, src: "", w: src.width, h: src.height });
    }
    if (typeof src === "string" && src.startsWith("data:image/svg+xml")) {
      return nativeTexture(type, { ...props, src: "", w: props.w ?? 48, h: props.h ?? 48 });
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
(globalThis as any).__viptvCreatePlayer = createRokuPlayer;

// The shared UI is drawn with SolidTV's renderer nodes, but the browser
// renderer's text/image visuals are not SceneGraph nodes. This bridge turns
// every shared TvText / TvView into a native Label / Rectangle / Poster in two
// ordered top-level layers. Native nodes are removed with their owning Solid
// nodes, and translations are re-synced after layout so centered groups and
// wrapped labels land on their real positions.
type NativeRecord = {
  kind: "label" | "rect" | "poster" | "qr";
  node: any;
  holder: any;
  visual: any;
  layer?: any;
  effect?: any;
  key?: string;
  sync: () => void;
};

const nativeRecords = new Map<any, NativeRecord>();
const nativeFonts = new Map<string, any>();
let backdropLayer: any = null;
let backdropScrimLayer: any = null;
let visualLayer: any = null;
let chromeLayer: any = null;
let labelLayer: any = null;
let qrLayer: any = null;
let modalLayer: any = null;

function ensureLayers() {
  const root = (globalThis as any).__solidtvNativeRoot;
  if (!root || visualLayer) return root;
  const renderer = (globalThis as any).__rokuRenderer;
  if (renderer?.createNode && renderer.root) {
    // High zIndex keeps the native overlay above every shared host visual.
    // The renderer's reorder pass owns these containers, so they cannot be
    // pushed behind the shared tree when a late host visual is inserted.
    const backdrop = renderer.createNode({ w: 1920, h: 1080, zIndex: 8000 });
    backdrop.parent = renderer.root;
    backdropLayer = backdrop.dom;
    const backdropScrim = renderer.createNode({ w: 1920, h: 1080, zIndex: 8500 });
    backdropScrim.parent = renderer.root;
    backdropScrimLayer = backdropScrim.dom;
    const visual = renderer.createNode({ w: 1920, h: 1080, zIndex: 9000 });
    visual.parent = renderer.root;
    visualLayer = visual.dom;
    const chrome = renderer.createNode({ w: 1920, h: 1080, zIndex: 9500 });
    chrome.parent = renderer.root;
    chromeLayer = chrome.dom;
    const text = renderer.createNode({ w: 1920, h: 1080, zIndex: 10000 });
    text.parent = renderer.root;
    labelLayer = text.dom;
    qrLayer = visualLayer;
    const modal = renderer.createNode({ w: 1920, h: 1080, zIndex: 11000 });
    modal.parent = renderer.root;
    modalLayer = modal.dom;
  } else {
    backdropLayer = createElement("group");
    insertNode(root, backdropLayer);
    backdropScrimLayer = createElement("group");
    insertNode(root, backdropScrimLayer);
    visualLayer = createElement("group");
    insertNode(root, visualLayer);
    chromeLayer = createElement("group");
    insertNode(root, chromeLayer);
    labelLayer = createElement("group");
    insertNode(root, labelLayer);
    qrLayer = createElement("group");
    insertNode(root, qrLayer);
    modalLayer = createElement("group");
    insertNode(root, modalLayer);
  }
  return root;
}

function holderAt(node: any, w: number, h: number): any {
  const renderer = (globalThis as any).__rokuRenderer || (globalThis as any).__SolidTVRokuRenderer;
  const holder = renderer.createNode({ x: 0, y: 0, w, h });
  holder.parent = null;
  return holder;
}

function syncHolder(record: NativeRecord) {
  const node = record.node;
  const holder = record.holder;
  if (!holder) return;
  const x = Number(node.absX || 0);
  const y = Number(node.absY || 0);
  if (holder.x !== x || holder.y !== y) {
    holder.x = x;
    holder.y = y;
    holder.markTransform();
    holder.flush();
  }
}

function fontUri(family: string | undefined): string {
  const value = String(family ?? "Onest").toLowerCase();
  if (value.includes("bricolage")) return "pkg:/fonts/remote_bricolage_800.ttf";
  if (value.includes("onest")) {
    if (value.includes("700") || value.includes("tabular")) return "pkg:/fonts/remote_onest_700.ttf";
    if (value.includes("600")) return "pkg:/fonts/remote_onest_600.ttf";
    if (value.includes("500")) return "pkg:/fonts/remote_onest_500.ttf";
    return "pkg:/fonts/remote_onest_400.ttf";
  }
  return "pkg:/fonts/Roboto-Regular.ttf";
}

function hex(value: number): string {
  return "0x" + (value >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function rokuColor(value: any): string {
  if (typeof value === "number") return hex(value);
  if (typeof value !== "string" || !value) return "0xFFFFFFFF";
  if (value.charAt(0) === "#") {
    const raw = value.slice(1);
    const expanded =
      raw.length === 3
        ? raw.split("").map((c) => c + c).join("") + "ff"
        : raw.length === 4
          ? raw.split("").map((c) => c + c).join("")
          : raw.length === 6
            ? raw + "ff"
            : raw;
    return "0x" + expanded.toUpperCase();
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (match) {
    const parts = match[1].split(",").map(Number);
    const alpha = parts.length > 3 ? Math.round(parts[3] * 255) : 255;
    return hex(((parts[0] & 255) << 24) | ((parts[1] & 255) << 16) | ((parts[2] & 255) << 8) | (alpha & 255));
  }
  return "0xFFFFFFFF";
}

function removeRecord(node: any) {
  const record = nativeRecords.get(node);
  if (!record) return;
  nativeRecords.delete(node);
  try {
    const layer = record.layer || (record.kind === "label" ? labelLayer : record.kind === "qr" ? qrLayer : visualLayer);
    if (record.visual && record.holder?.dom)
      tmTransaction.removeNode(record.holder.dom, record.visual);
    if (record.holder) record.holder.destroy();
    if (layer && record.holder?.dom) tmTransaction.removeNode(layer, record.holder.dom);
  } catch (error) {
    // The owning SceneGraph group may already have been removed.
  }
}

function fontFace(family: string | undefined, size: number): any {
  const uri = fontUri(family);
  const key = uri + "@" + size;
  let font = nativeFonts.get(key);
  if (!font) {
    // The host's loadFace publishes preUpdate before uri/size and keeps the
    // face measurable; a plain Font created before publication renders blank.
    font = (globalThis as any).__viptvRokuFont?.(family, size);
    if (!font) {
      const root = ensureLayers();
      font = createElement("font");
      setProp(font, "preUpdate", true);
      setProp(font, "uri", uri);
      setProp(font, "size", size);
      insertNode(root, font);
    }
    nativeFonts.set(key, font);
  }
  return font;
}

(globalThis as any).__viptvNativeText = (node: any, p: any) => {
  try {
    if (!node) return;
    ensureLayers();
    let record = nativeRecords.get(node);
    if (!record || record.kind !== "label") {
      removeRecord(node);
      const label = createElement("label");
      const holder = holderAt(node, 1, 1);
      const layer = (globalThis as any).__viptvModal ? modalLayer : labelLayer;
      insertNode(layer, holder.dom);
      insertNode(holder.dom, label);
      record = { kind: "label", node, holder, visual: label, layer, sync: () => syncHolder(record!) };
      nativeRecords.set(node, record);
      syncHolder(record);
    }
    const label = record.visual;
    const size = Math.max(1, Math.round(Number(p.size) || 32));
    setProp(label, "font", fontFace(p.font, size));
    const rawWidth = Math.max(1, Number(p.textWidth) || Number(p.width) || 1);
    const multiline = Number(p.maxlines) > 1;
    const labelWidth = Math.min(
      1920,
      Math.ceil(
        multiline
          ? (Number(p.width) || rawWidth) + 8
          : Number(p.maxlines) === 1
            ? Math.max(Number(p.width) || rawWidth, rawWidth) + 8
            : rawWidth * 1.35 + 24,
      ),
    );
    let labelHeight = Math.max(1, Math.ceil(Number(p.height) || size));
    let text = String(p.text ?? "");
    if (multiline && labelWidth > 1 && text.length > 0) {
      // Roku's Label wrap behaves inconsistently across firmware builds. Break
      // words here and feed explicit newlines; this keeps multi-line copy
      // readable and matches the layout the shared text measured.
      const maxWidth = Math.max(1, Number(p.width) || labelWidth) * 0.94;
      const perCharacter = Math.max(1, (Number(p.textWidth) || labelWidth) / Math.max(1, text.length));
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? line + " " + word : word;
        if (line && candidate.length * perCharacter > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      const maxLines = Math.max(1, Number(p.maxlines));
      if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:!?]*$/, "") + "…";
      }
      text = lines.join("\n");
      labelHeight = Math.max(labelHeight, Math.ceil(lines.length * Number(p.lineHeight || size)) + 10);
      setProp(label, "wrap", true);
      setProp(label, "maxLines", lines.length);
    }
    setProp(label, "text", text);
    setProp(label, "width", labelWidth);
    setProp(label, "height", labelHeight);
    // The shared text node's x already includes its alignment offset, so the
    // native label starts at the holder and paints left-to-right.
    setProp(label, "horizAlign", "left");
    setProp(label, "vertAlign", "center");
    setProp(label, "color", rokuColor(p.color ?? "#ffffff"));
    if (record.holder) {
      record.holder.w = labelWidth;
      record.holder.h = labelHeight;
      record.holder.markTransform();
      record.holder.flush();
    }
    syncHolder(record);
  } catch (error: any) {
    console.error("ROKU_NATIVE_TEXT_ERROR " + String(error?.stack || error));
  }
};

(globalThis as any).__viptvNativeTextRemove = (node: any) => {
  if (node) removeRecord(node);
};

function clearEffect(record: NativeRecord) {
  if (!record.effect) return;
  try {
    tmTransaction.removeNode(record.visual, record.effect);
  } catch (error) {
    // Already removed.
  }
  record.effect = undefined;
}

function renderQr(record: NativeRecord, uri: string, width: number, height: number) {
  const text = decodeURIComponent(uri.slice("data:image/x-viptv-qr,".length));
  const code: any = (QRCode as any).create
    ? (QRCode as any).create(text, { errorCorrectionLevel: "M" })
    : (QRCode as any)(text, { errorCorrectionLevel: "M" });
  const modules = code.modules;
  const size = Number(modules.size || (modules.size = Math.sqrt(modules.data.length)));
  const cell = Math.max(1, Math.floor(Math.min(width, height) / (size + 4)));
  const offsetX = Math.floor((width - cell * size) / 2);
  const offsetY = Math.floor((height - cell * size) / 2);
  if (!record.key || record.key !== text) {
    record.key = text;
    const previous = (record as any).qrGroup;
    if (previous) {
      try { tmTransaction.removeNode(record.visual, previous); } catch (error) { /* detached */ }
    }
    const group = createElement("group");
    insertNode(record.visual, group);
    (record as any).qrGroup = group;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let dark = false;
        try {
          dark = typeof modules.get === "function" ? modules.get(row, col) : modules.data[row * size + col] === 1;
        } catch (error) {
          dark = false;
        }
        if (!dark) continue;
        const dot = createElement("rectangle");
        setProp(dot, "width", cell + 1);
        setProp(dot, "height", cell + 1);
        setProp(dot, "color", "0x000000FF");
        setProp(dot, "translation", [offsetX + col * cell, offsetY + row * cell]);
        insertNode(group, dot);
      }
    }
  }
}

(globalThis as any).__viptvNativeVisual = (node: any, p: any) => {
  try {
    if (!node) return;
    ensureLayers();
    const width = Math.max(1, Math.ceil(Number(p.w) || 1));
    const height = Math.max(1, Math.ceil(Number(p.h) || 1));
    const rawSrc = typeof p.src === "string" ? p.src : p.texture?.src;
    const qr = typeof rawSrc === "string" && rawSrc.indexOf("data:image/x-viptv-qr,") === 0;
    const poster = typeof rawSrc === "string" && rawSrc.length > 0 && !rawSrc.startsWith("data:");
    const kind: NativeRecord["kind"] = qr ? "qr" : poster ? "poster" : "rect";
    const modal = !!(globalThis as any).__viptvModal;
    if (kind === "rect" && width >= 1900 && height >= 1000 && !modal) {
      removeRecord(node);
      return;
    }
    let record = nativeRecords.get(node);
    if (!record || record.kind !== kind) {
      removeRecord(node);
      const chrome = rawSrc === "pkg:/assets/topbar-scrim.png";
      const heroScrim = rawSrc === "pkg:/assets/hero-scrim.png";
      const fullScreenBackdrop =
        kind === "poster" &&
        width >= 1900 &&
        height >= 1000 &&
        !String(rawSrc).includes("welcome-");
      const layer = modal
        ? modalLayer
        : chrome
          ? chromeLayer
          : heroScrim
            ? backdropScrimLayer
            : fullScreenBackdrop
              ? backdropLayer
              : kind === "qr"
                ? qrLayer
                : visualLayer;
      const holder = holderAt(node, width, height);
      insertNode(layer, holder.dom);
      const visual = createElement(kind === "poster" ? "poster" : kind === "qr" ? "group" : "rectangle");
      insertNode(holder.dom, visual);
      record = { kind, node, holder, visual, layer, sync: () => syncHolder(record!) };
      nativeRecords.set(node, record);
      if (kind === "poster") setProp(visual, "loadDisplayMode", p.fit === "contain" ? "scaleToFit" : p.fit === "cover" ? "scaleToZoom" : "scaleToFill");
      syncHolder(record);
    }
    const visual = record.visual;
    if (kind === "qr") {
      renderQr(record, String(rawSrc), width, height);
    } else if (kind === "poster") {
      const key = String(rawSrc);
      if (record.key !== key) {
        record.key = key;
        setProp(visual, "uri", key);
      }
      setProp(visual, "width", width);
      setProp(visual, "height", height);
      setProp(visual, "opacity", Number(p.alpha ?? 1));
    } else if (kind === "rect") {
      const radius = typeof p.rounded === "object" ? Number(p.rounded?.radius ?? 0) : Number(p.rounded ?? 0);
      setProp(visual, "color", rokuColor(p.color ?? "rgba(0,0,0,0)"));
      setProp(visual, "width", width);
      setProp(visual, "height", height);
      setProp(visual, "opacity", Number(p.alpha ?? 1));
      if (radius > 0) {
        if (!record.effect) {
          record.effect = createElement("effect");
          insertNode(record.holder.dom, record.effect);
        }
        setProp(record.effect, "borderRadius", radius);
        setProp(record.effect, "borderWidth", 0);
        try { setProp(visual, "effect", record.effect); } catch (error) { /* optional field */ }
      } else {
        clearEffect(record);
      }
    }
    if (record.holder) {
      record.holder.w = width;
      record.holder.h = height;
      record.holder.markTransform();
      record.holder.flush();
    }
    syncHolder(record);
  } catch (error: any) {
    console.error("ROKU_NATIVE_VISUAL_ERROR " + String(error?.stack || error));
  }
};

(globalThis as any).__viptvNativeVisualRemove = (node: any) => {
  if (node) removeRecord(node);
};

(globalThis as any).__viptvSyncOverlays = () => {
  nativeRecords.forEach((record) => {
    try {
      record.sync();
    } catch (error) {
      // A node can be destroyed between layout and the sync pass.
    }
  });
};

try {
  render(() => createComponent(createRemoteTvApp(api, "web", { initialLoading: false }), {}));


// Font faces publish asynchronously after the shared entry mounts. Bump the
// layout epoch once the native faces are measurable so TvText reflows.
for (const delay of [800, 1800, 3200]) {
  setTimeout(() => (globalThis as any).__solidtvNotifyFont?.(), delay);
}
} catch (error: any) {
  console.error("ROKU_RENDER_ERROR " + String(error?.stack || error));
}

