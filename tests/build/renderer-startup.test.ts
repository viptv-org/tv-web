import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  fallback: vi.fn(),
  create: vi.fn(),
  fonts: vi.fn(),
  shaders: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("@solidtv/solid", () => ({
  createRenderer: mocks.create,
  loadFonts: mocks.fonts,
  registerDefaultShaders: mocks.shaders,
}));
vi.mock("@solidtv/renderer", () => ({ prefetchFont: mocks.prefetch }));
vi.mock("../../src/tv-solid/fonts", () => ({ sdfFonts: [{ fontFamily: "Onest" }] }));
vi.mock("../../src/tv-solid/platform/browser-renderer", () => ({
  prepareBrowserRenderer: mocks.prepare,
  prepareCanvasRenderer: mocks.fallback,
}));
import { startBrowserRenderer } from "../../src/tv-solid/platform/renderer-startup";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function host(mode: "webgl" | "canvas") {
  const state = { lost: false };
  return {
    mode,
    dispose: (renderer: any) => renderer.destroy(),
    canvas: document.createElement("canvas"),
    isContextLost: () => state.lost,
    state,
    ...(mode === "canvas" ? { loadFonts: vi.fn().mockResolvedValue(undefined) } : {}),
  };
}
function setup() {
  const listeners = new Map<string, Set<() => void>>();
  const renderer = {
    destroy: vi.fn(),
    on: vi.fn((name: string, listener: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
    }),
    off: vi.fn((name: string, listener: () => void) => listeners.get(name)?.delete(listener)),
    emit: (name: string) => listeners.get(name)?.forEach((fn) => fn()),
    listenerCount: () => [...listeners.values()].reduce((sum, list) => sum + list.size, 0),
  };
  return { renderer, render: vi.fn(), rootNode: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockReset();
  mocks.prepare.mockReset();
  mocks.fallback.mockReset();
  mocks.fonts.mockReset();
  document.body.innerHTML = '<div id="app"></div>';
});

describe("renderer startup ownership", () => {
  test("healthy WebGL mounts once, claims prefetched fonts and removes startup listeners", async () => {
    const gl = host("webgl"),
      active = setup(),
      mount = vi.fn();
    mocks.prepare.mockResolvedValue(gl);
    mocks.create.mockImplementation(({ canvas }) => {
      document.querySelector("#app")!.append(canvas);
      return active;
    });
    mocks.fonts.mockResolvedValue(undefined);
    await startBrowserRenderer({ settings: {}, target: "app", ready: Promise.resolve(7), mount });
    expect(mount).toHaveBeenCalledOnce();
    expect(mount.mock.calls[0][1]).toBe(7);
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.prefetch.mock.invocationCallOrder[0],
    );
    expect(mocks.prefetch.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fonts.mock.invocationCallOrder[0],
    );
    expect(active.renderer.listenerCount()).toBe(0);
    expect(active.renderer.destroy).not.toHaveBeenCalled();
    gl.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(mocks.fallback).not.toHaveBeenCalled();
  });

  test.each(["canvas event", "renderer event"])(
    "context loss during unresolved fonts recovers through %s",
    async (event) => {
      const gl = host("webgl"),
        canvas = host("canvas"),
        old = setup(),
        replacement = setup(),
        fonts = deferred<void>(),
        mount = vi.fn();
      mocks.prepare.mockResolvedValue(gl);
      mocks.fallback.mockResolvedValue(canvas);
      mocks.fonts.mockReturnValue(fonts.promise);
      mocks.create.mockImplementation(({ canvas: element }) => {
        document.querySelector("#app")!.append(element);
        return element === gl.canvas ? old : replacement;
      });
      const starting = startBrowserRenderer({
        settings: {},
        target: "app",
        ready: Promise.resolve("ready"),
        mount,
      });
      await flush();
      if (event === "canvas event") gl.canvas.dispatchEvent(new Event("webglcontextlost"));
      else old.renderer.emit("contextLost");
      await starting;
      expect(old.renderer.destroy).toHaveBeenCalledTimes(1);
      expect(old.renderer.listenerCount()).toBe(0);
      expect(document.querySelectorAll("canvas")).toHaveLength(1);
      expect(canvas.canvas.isConnected).toBe(true);
      expect(gl.canvas.isConnected).toBe(false);
      expect(mount).toHaveBeenCalledTimes(1);
      expect(mount.mock.calls[0][0].renderer).toBe(replacement.renderer);
      if (event === "canvas event") fonts.reject(Error("late old-font failure"));
      else fonts.resolve();
      await flush();
      expect(mount).toHaveBeenCalledTimes(1);
      expect(replacement.renderer.destroy).not.toHaveBeenCalled();
    },
  );

  test("GPU disposal errors during context loss cannot strand the fresh Canvas fallback", async () => {
    const gl = host("webgl"),
      canvas = host("canvas"),
      old = setup(),
      replacement = setup(),
      fonts = deferred<void>(),
      mount = vi.fn();
    old.renderer.destroy.mockImplementation(() => {
      throw Error("Lost GPU context");
    });
    mocks.prepare.mockResolvedValue(gl);
    mocks.fallback.mockResolvedValue(canvas);
    mocks.fonts.mockReturnValue(fonts.promise);
    mocks.create.mockImplementation(({ canvas: element }) => {
      document.querySelector("#app")!.append(element);
      return element === gl.canvas ? old : replacement;
    });
    const starting = startBrowserRenderer({
      settings: {},
      target: "app",
      ready: Promise.resolve(),
      mount,
    });
    await flush();
    gl.canvas.dispatchEvent(new Event("webglcontextlost"));
    await starting;
    expect(old.renderer.listenerCount()).toBe(0);
    expect(gl.canvas.isConnected).toBe(false);
    expect(mount).toHaveBeenCalledOnce();
  });

  test("a context already lost before construction uses a fresh canvas", async () => {
    const gl = host("webgl"),
      canvas = host("canvas"),
      replacement = setup(),
      mount = vi.fn();
    gl.state.lost = true;
    mocks.prepare.mockResolvedValue(gl);
    mocks.fallback.mockResolvedValue(canvas);
    mocks.create.mockReturnValue(replacement);
    await startBrowserRenderer({ settings: {}, target: "app", ready: Promise.resolve(), mount });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].canvas).toBe(canvas.canvas);
    expect(mocks.fonts).not.toHaveBeenCalled();
    expect(mount.mock.calls[0][0].host.mode).toBe("canvas");
  });

  test("synchronous loss while constructing WebGL does not queue font attachment to the fallback", async () => {
    const gl = host("webgl"),
      canvas = host("canvas"),
      mount = vi.fn();
    mocks.prepare.mockResolvedValue(gl);
    mocks.fallback.mockResolvedValue(canvas);
    mocks.create.mockImplementation(({ canvas: element }) => {
      if (element === gl.canvas) {
        gl.state.lost = true;
        throw Error("GL construction failed");
      }
      return setup();
    });
    await startBrowserRenderer({ settings: {}, target: "app", ready: Promise.resolve(), mount });
    expect(mount).toHaveBeenCalledOnce();
    expect(mocks.fonts).not.toHaveBeenCalled();
  });

  test("loss after fonts resolve but before app prerequisites settle retires the old renderer", async () => {
    const gl = host("webgl"),
      canvas = host("canvas"),
      old = setup(),
      replacement = setup(),
      prerequisites = deferred<number>(),
      mount = vi.fn();
    mocks.prepare.mockResolvedValue(gl);
    mocks.fallback.mockResolvedValue(canvas);
    mocks.fonts.mockResolvedValue(undefined);
    mocks.create.mockReturnValueOnce(old).mockReturnValueOnce(replacement);
    const starting = startBrowserRenderer({
      settings: {},
      target: "app",
      ready: prerequisites.promise,
      mount,
    });
    await flush();
    gl.canvas.dispatchEvent(new Event("webglcontextlost"));
    await flush();
    prerequisites.resolve(3);
    await starting;
    expect(old.renderer.destroy).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledOnce();
    expect(mount.mock.calls[0][0].renderer).toBe(replacement.renderer);
  });

  test("font failures stay failures and clean up instead of selecting another graphics backend", async () => {
    const gl = host("webgl"),
      active = setup();
    mocks.prepare.mockResolvedValue(gl);
    mocks.create.mockReturnValue(active);
    mocks.fonts.mockRejectedValue(Error("Font unavailable"));
    await expect(
      startBrowserRenderer({
        settings: {},
        target: "app",
        ready: Promise.resolve(),
        mount: vi.fn(),
      }),
    ).rejects.toThrow("Font unavailable");
    expect(active.renderer.destroy).toHaveBeenCalledOnce();
    expect(active.renderer.listenerCount()).toBe(0);
    expect(mocks.fallback).not.toHaveBeenCalled();
  });

  test("a failed Canvas fallback releases it and propagates the error without another retry", async () => {
    const gl = host("webgl"),
      canvas = host("canvas"),
      replacement = setup();
    gl.state.lost = true;
    canvas.loadFonts!.mockRejectedValue(Error("Canvas fonts unavailable"));
    mocks.prepare.mockResolvedValue(gl);
    mocks.fallback.mockResolvedValue(canvas);
    mocks.create.mockReturnValue(replacement);
    await expect(
      startBrowserRenderer({
        settings: {},
        target: "app",
        ready: Promise.resolve(),
        mount: vi.fn(),
      }),
    ).rejects.toThrow("Canvas fonts unavailable");
    expect(replacement.renderer.destroy).toHaveBeenCalledOnce();
    expect(mocks.fallback).toHaveBeenCalledOnce();
  });
});
