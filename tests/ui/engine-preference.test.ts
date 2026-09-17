import { describe, expect, it } from "vitest";

import { isEngineChoice, readStoredEngine, storeEngine } from "../../src/ui/enginePreference";

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
});
