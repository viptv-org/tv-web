import { describe, expect, it } from "vitest";

import {
  isEngineChoice,
  offeredEngines,
  probeNativeEngines,
  readStoredEngine,
  reconcileStoredEngine,
  storeEngine,
} from "../../src/ui/enginePreference";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
}

describe("engine preference", () => {
  it("accepts only real engine choices", () => {
    expect(isEngineChoice("auto")).toBe(true);
    expect(isEngineChoice("mpv")).toBe(true);
    expect(isEngineChoice("gstreamer")).toBe(true);
    expect(isEngineChoice("vlc")).toBe(false);
    expect(isEngineChoice(1)).toBe(false);
    expect(isEngineChoice(undefined)).toBe(false);
  });

  it("reads the persisted choice and falls back to auto", () => {
    expect(readStoredEngine(memoryStorage({ "viptv:playback:engine": "mpv" }))).toBe("mpv");
    expect(readStoredEngine(memoryStorage({ "viptv:playback:engine": "vlc" }))).toBe("auto");
    expect(readStoredEngine(memoryStorage())).toBe("auto");
  });

  it("persists a choice and survives storage failures", () => {
    const storage = memoryStorage();
    storeEngine("gstreamer", storage);
    expect(readStoredEngine(storage)).toBe("gstreamer");

    const locked = {
      getItem: () => { throw new Error("storage is locked"); },
      setItem: () => { throw new Error("storage is locked"); },
    } as unknown as Storage;
    expect(readStoredEngine(locked)).toBe("auto");
    expect(() => storeEngine("mpv", locked)).not.toThrow();
  });

  it("offers Auto plus only the engines the plugin reports", async () => {
    const invoker = (answer: unknown) => ({ invoke: async <T,>() => answer as T });
    const gstreamerOnly = await probeNativeEngines(invoker({ protocolVersion: 1, engines: ["gstreamer"] }));
    expect(offeredEngines(gstreamerOnly)).toEqual(["auto", "gstreamer"]);
    expect(offeredEngines(await probeNativeEngines(invoker({ protocolVersion: 1, engines: ["gstreamer", "mpv"] }))))
      .toEqual(["auto", "mpv", "gstreamer"]);
    // A mismatched protocol, an unlisted engine set or a failed command leaves Auto alone.
    expect(offeredEngines(await probeNativeEngines(invoker({ protocolVersion: 2, engines: ["mpv"] })))).toEqual(["auto"]);
    expect(offeredEngines(await probeNativeEngines(invoker({ protocolVersion: 1 })))).toEqual(["auto"]);
    expect(offeredEngines(await probeNativeEngines({ invoke: async () => { throw new Error("no plugin"); } }))).toEqual(["auto"]);
  });

  it("asks the plugin's diagnostics command", async () => {
    const commands: string[] = [];
    await probeNativeEngines({ invoke: async <T,>(command: string) => { commands.push(command); return { protocolVersion: 1, engines: [] } as T; } });
    expect(commands).toEqual(["plugin:video|native_diagnostics"]);
  });

  it("migrates a stored engine this build lacks to Auto", () => {
    const storage = memoryStorage({ "viptv:playback:engine": "mpv" });
    expect(reconcileStoredEngine(["auto", "gstreamer"], storage)).toBe("auto");
    expect(storage.getItem("viptv:playback:engine")).toBe("auto");

    const supported = memoryStorage({ "viptv:playback:engine": "gstreamer" });
    expect(reconcileStoredEngine(["auto", "gstreamer"], supported)).toBe("gstreamer");
    expect(supported.getItem("viptv:playback:engine")).toBe("gstreamer");
  });
});
