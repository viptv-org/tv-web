/**
 * Browser-shaped globals for the shared tv-web entry when it runs inside the
 * native Roku SceneGraph host.
 *
 * This is the compatibility boundary, not application logic: the host has
 * already installed window/document/location/history/localStorage/fetch; this
 * module adds the canvas, media-element, animation-frame and visibility shapes
 * the shared UI reads. Rendering still goes through SolidTV SceneGraph nodes.
 */
type Any = Record<string, any>;

class RokuImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }
}

function imageData(width: number, height: number) {
  const Ctor = (globalThis as Any).ImageData || RokuImageData;
  return new Ctor(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
}

function gradient() {
  return { addColorStop() {} };
}

function context(canvas: Any): Any {
  const ctx: Any = {
    canvas,
    font: "32px Onest",
    letterSpacing: "0px",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    filter: "none",
    shadowColor: "rgba(0,0,0,0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    rect() {},
    roundRect() {},
    bezierCurveTo() {},
    quadraticCurveTo() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    fillText() {},
    strokeText() {},
    translate() {},
    scale() {},
    rotate() {},
    setTransform() {},
    resetTransform() {},
    drawImage() {},
    putImageData() {},
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern: gradient,
    measureText(text: string) {
      return { width: String(text ?? "").length * 8 };
    },
    getImageData(_x: number, _y: number, width: number, height: number) {
      return imageData(width, height);
    },
    createImageData(width: number, height: number) {
      return imageData(width, height);
    },
  };
  return ctx;
}

function canvas() {
  const node: Any = {
    width: 1,
    height: 1,
    style: {},
    dataset: {},
    tagName: "CANVAS",
    getContext() {
      return context(node);
    },
    toDataURL() {
      return "";
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child: Any) {
      return child;
    },
    removeChild(child: Any) {
      return child;
    },
    remove() {},
  };
  return node;
}

class RokuImage {
  onload: (() => void) | null = null;
  onerror: ((error?: any) => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  private _src = "";
  set src(value: string) {
    this._src = String(value ?? "");
    setTimeout(() => {
      try {
        this.onerror?.(new Error("Roku image decode unavailable"));
      } catch (error) {
        console.error("ROKU_IMAGE error handler failed " + String(error));
      }
    }, 0);
  }
  get src() {
    return this._src;
  }
}

function videoElement(): Any {
  const video: Any = {
    tagName: "VIDEO",
    src: "",
    currentTime: 0,
    duration: 0,
    paused: true,
    readyState: 0,
    style: {},
    dataset: {},
    addEventListener() {},
    removeEventListener() {},
    play() {
      video.paused = false;
      return Promise.resolve();
    },
    pause() {
      video.paused = true;
    },
    load() {},
    remove() {},
    appendChild(child: Any) {
      return child;
    },
  };
  return video;
}

function installDocumentShape() {
  const g = globalThis as Any;
  const doc = g.document;
  if (!doc) return;
  const root = doc.documentElement || (doc.documentElement = {});
  root.clientWidth = root.clientWidth || 1920;
  root.clientHeight = root.clientHeight || 1080;
  if (!root.dataset) root.dataset = {};
  if (!root.attributes) root.attributes = [];
  if (!root.style) root.style = {};
  if (typeof root.append !== "function") root.append = () => {};
  if (typeof root.appendChild !== "function") root.appendChild = (child: Any) => child;
  if (!doc.head) doc.head = doc;
  if (typeof doc.head.append !== "function") doc.head.append = () => {};
  if (typeof doc.head.appendChild !== "function") doc.head.appendChild = (child: Any) => child;
  if (!doc.body) doc.body = doc;
  if (typeof doc.body.append !== "function") doc.body.append = () => {};
  if (typeof doc.body.appendChild !== "function") doc.body.appendChild = (child: Any) => child;
  if (!doc.fonts) doc.fonts = { ready: Promise.resolve() };
  if (doc.visibilityState === undefined) doc.visibilityState = "visible";
  if (doc.hidden === undefined) doc.hidden = false;
  const baseCreate = typeof doc.createElement === "function" ? doc.createElement.bind(doc) : null;
  doc.createElement = (tag: string) => {
    const name = String(tag ?? "").toLowerCase();
    if (name === "canvas") return canvas();
    if (name === "img" || name === "image") return new RokuImage();
    if (name === "video") return videoElement();
    return baseCreate ? baseCreate(tag) : canvas();
  };
  const baseGetById = doc.getElementById?.bind(doc);
  doc.getElementById = (id: string) => {
    const name = String(id ?? "");
    if (name === "tv-video") return videoElement();
    if (name === "video-layer" || name === "app" || name === "solid-preparing-spinner")
      return { style: {}, dataset: {}, appendChild: (child: Any) => child, remove() {} };
    return baseGetById ? baseGetById(id) : null;
  };
}

function installMatchMedia() {
  const g = globalThis as Any;
  if (typeof g.matchMedia === "function") return;
  g.matchMedia = (query: string) => ({
    matches: false,
    media: String(query ?? ""),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

function installMutationObserver() {
  const g = globalThis as Any;
  if (g.MutationObserver) return;
  g.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

class RokuDOMException extends Error {
  constructor(message = "", name = "Error") {
    super(String(message));
    this.name = String(name);
  }
}

class RokuAbortSignal {
  aborted = false;
  reason: any = undefined;
  onabort: ((event: any) => void) | null = null;
  private listeners = new Set<(event: any) => void>();
  addEventListener(type: string, fn: (event: any) => void) {
    if (type === "abort") this.listeners.add(fn);
  }
  removeEventListener(type: string, fn: (event: any) => void) {
    if (type === "abort") this.listeners.delete(fn);
  }
  throwIfAborted() {
    if (this.aborted) throw this.reason;
  }
  _abort(reason?: any) {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = reason ?? new RokuDOMException("Aborted", "AbortError");
    const event = { type: "abort", target: this };
    try {
      this.onabort?.(event);
    } catch (error) {
      console.error("ROKU_ABORT handler failed " + String(error));
    }
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(event);
      } catch (error) {
        console.error("ROKU_ABORT listener failed " + String(error));
      }
    }
  }
  static timeout(ms: number) {
    const controller = new RokuAbortController();
    setTimeout(() => controller.abort(new RokuDOMException("Timeout", "TimeoutError")), ms);
    return controller.signal;
  }
  static any(signals: RokuAbortSignal[]) {
    const controller = new RokuAbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason));
    }
    return controller.signal;
  }
}

class RokuAbortController {
  readonly signal = new RokuAbortSignal();
  abort(reason?: any) {
    this.signal._abort(reason);
  }
}

class RokuTextDecoder {
  readonly encoding = "utf-8";
  decode(input?: any) {
    if (!input) return "";
    const bytes =
      input instanceof Uint8Array ? input : new Uint8Array(input.buffer || input);
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    try {
      return decodeURIComponent(escape(out));
    } catch {
      return out;
    }
  }
}

function installAbortAndText() {
  const g = globalThis as Any;
  if (!g.DOMException) g.DOMException = RokuDOMException;
  if (!g.AbortSignal) g.AbortSignal = RokuAbortSignal;
  if (!g.AbortController) g.AbortController = RokuAbortController;
  if (!g.TextDecoder) g.TextDecoder = RokuTextDecoder;
}

function installMediaBits() {
  const g = globalThis as Any;
  if (!g.Image) g.Image = RokuImage;
  if (!g.HTMLImageElement) g.HTMLImageElement = RokuImage;
  if (!g.HTMLCanvasElement) g.HTMLCanvasElement = function HTMLCanvasElement() {};
  if (!g.HTMLVideoElement) g.HTMLVideoElement = function HTMLVideoElement() {};
  if (!g.ImageData) g.ImageData = RokuImageData;
  if (!g.createImageBitmap)
    g.createImageBitmap = () => Promise.reject(new Error("createImageBitmap unavailable on Roku"));
  if (!g.URL) g.URL = {};
  if (!g.URL.createObjectURL) g.URL.createObjectURL = () => "";
  if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};
  const nav = g.navigator || (g.navigator = {});
  if (!nav.locks) {
    nav.locks = {
      request(_name: string, work: () => Promise<any>) {
        return Promise.resolve().then(work);
      },
    };
  }
}

installDocumentShape();
installMatchMedia();
installMutationObserver();
installAbortAndText();
installMediaBits();
