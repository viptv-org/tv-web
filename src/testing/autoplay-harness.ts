import type { NativeVideoEngine, PlayerSnapshot } from "@viptv/video";

import { isEngineChoice } from "../ui/enginePreference";

/** The desktop shell's command surface, injectable for tests. */
export type HarnessInvoker = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

/**
 * Asks the desktop shell whether VIPTV_TEST_AUTOPLAY started the app. A
 * missing shell or a failed command means the mode is off — the harness
 * never changes behavior for anyone who did not ask for it.
 */
export async function probeAutoplayTestMode(invoker: HarnessInvoker): Promise<boolean> {
  try {
    return await invoker.invoke<boolean>("test_autoplay_enabled");
  } catch {
    return false;
  }
}

/**
 * VIPTV_ENGINE=mpv|gstreamer|auto overrides the persisted engine choice for
 * this launch. Anything the adapter could not request is ignored, so an
 * unknown value falls back to the stored choice.
 */
export async function probeEngineOverride(
  invoker: HarnessInvoker,
): Promise<NativeVideoEngine | undefined> {
  try {
    const value = await invoker.invoke<string | null>("playback_engine_override");
    return isEngineChoice(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** One harness line: engine (with the running backend), state, position and error. */
export function autoplayTestLine(snapshot: PlayerSnapshot): string {
  const diagnostics = snapshot.diagnostics;
  const engine = diagnostics
    ? `${diagnostics.engine}${diagnostics.backend ? ` (${diagnostics.backend})` : ""}`
    : "unknown";
  const position = snapshot.time?.positionSeconds;
  return [
    `engine=${engine}`,
    `state=${snapshot.state}`,
    `position=${typeof position === "number" ? `${position.toFixed(1)}s` : "-"}`,
    `error=${snapshot.error ? `${snapshot.error.code}: ${snapshot.error.message}` : "none"}`,
  ].join(" ");
}

/**
 * Wraps the shell's test_log command with the harness pacing: every state
 * change and error is written immediately, position beats at most once per
 * interval, and repeated identical lines are dropped.
 */
export function createAutoplayTestLogger(
  invoker: HarnessInvoker,
  options: { intervalMs?: number; now?: () => number } = {},
): (snapshot: PlayerSnapshot) => void {
  const intervalMs = options.intervalMs ?? 2000;
  const now = options.now ?? Date.now;
  let lastLine = "";
  let lastLoggedAt = 0;
  let lastState: string | undefined;
  return (snapshot: PlayerSnapshot): void => {
    const line = autoplayTestLine(snapshot);
    const significant = snapshot.state !== lastState || snapshot.error != null;
    if (!significant && (line === lastLine || now() - lastLoggedAt < intervalMs)) return;
    lastState = snapshot.state;
    lastLine = line;
    lastLoggedAt = now();
    void invoker.invoke("test_log", { message: line }).catch(() => undefined);
  };
}
