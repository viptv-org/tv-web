import type { NativeVideoEngine } from "@viptv/video";

const STORAGE_KEY = "viptv:playback:engine";
const ENGINE_CHOICES: readonly NativeVideoEngine[] = ["auto", "mpv", "gstreamer"];

export { ENGINE_CHOICES };

export function isEngineChoice(value: unknown): value is NativeVideoEngine {
  return typeof value === "string" && (ENGINE_CHOICES as readonly string[]).includes(value);
}

export function readStoredEngine(
  storage: Storage | undefined = globalThis.localStorage,
): NativeVideoEngine {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return isEngineChoice(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function storeEngine(
  engine: NativeVideoEngine,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, engine);
  } catch { /* Playback remains usable without storage. */ }
}
