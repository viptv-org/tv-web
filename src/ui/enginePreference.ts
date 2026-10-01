import { TAURI_VIDEO_PROTOCOL_VERSION, type NativeVideoDiagnostics, type NativeVideoEngine } from "@viptv/video";

const STORAGE_KEY = "viptv:playback:engine";
const ENGINE_CHOICES: readonly NativeVideoEngine[] = ["auto", "mpv", "gstreamer"];
/** The plugin's diagnostics command: hosts offer only the engines it reports. */
const NATIVE_DIAGNOSTICS = "plugin:video|native_diagnostics";

export { ENGINE_CHOICES };

/** The native plugin's command surface, injectable for tests. */
export type EngineProbeInvoker = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

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

/**
 * The engines compiled into this desktop build, as the plugin's
 * `native_diagnostics` reports them. A missing plugin, a protocol mismatch or
 * a build that does not list its engines yields no explicit engines, so only
 * Auto is offered: an explicit engine the build lacks fails every open.
 */
export async function probeNativeEngines(invoker: EngineProbeInvoker): Promise<readonly string[]> {
  try {
    const diagnostics = await invoker.invoke<NativeVideoDiagnostics>(NATIVE_DIAGNOSTICS);
    if (diagnostics?.protocolVersion !== TAURI_VIDEO_PROTOCOL_VERSION) return [];
    return Array.isArray(diagnostics.engines) ? diagnostics.engines.filter((engine) => typeof engine === "string") : [];
  } catch {
    return [];
  }
}

/** Auto is always offered; an explicit engine only when the build reports it. */
export function offeredEngines(reported: readonly string[]): readonly NativeVideoEngine[] {
  return ENGINE_CHOICES.filter((engine) => engine === "auto" || reported.includes(engine));
}

/**
 * Migrates a persisted engine this build cannot run back to Auto, so a choice
 * made on another build (mpv on a GStreamer-only build) cannot fail every
 * open with `engine-unavailable`. Returns the effective stored choice.
 */
export function reconcileStoredEngine(
  offered: readonly NativeVideoEngine[],
  storage: Storage | undefined = globalThis.localStorage,
): NativeVideoEngine {
  const stored = readStoredEngine(storage);
  if (offered.includes(stored)) return stored;
  storeEngine("auto", storage);
  return "auto";
}
