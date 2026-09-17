import { describe, expect, it } from "vitest";

import type { PlayerSnapshot } from "@viptv/video";

import {
  autoplayTestLine,
  createAutoplayTestLogger,
  probeAutoplayTestMode,
  probeEngineOverride,
  type HarnessInvoker,
} from "../../src/testing/autoplay-harness";

/** A shell whose every command resolves to one fixed value. */
function shell(value: unknown): HarnessInvoker {
  return {
    async invoke<T>(): Promise<T> {
      return value as T;
    },
  };
}

/** A shell whose every command fails, like a webview without the commands. */
const brokenShell: HarnessInvoker = {
  async invoke<T>(): Promise<T> {
    throw new Error("no shell");
  },
};

function snapshot(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    sessionId: 1,
    state: "playing",
    kind: "vod",
    time: { positionSeconds: 12.34, durationSeconds: 600, bufferedEndSeconds: 30 },
    tracks: { audio: [], text: [], selectedAudioId: null, selectedTextId: null },
    error: null,
    diagnostics: { engine: "tauri-native", transport: "file", networkTransport: "direct", backend: "mpv" },
    ...overrides,
  };
}

describe("autoplay harness", () => {
  it("probes the shell for the test mode and treats failures as off", async () => {
    await expect(probeAutoplayTestMode(shell(true))).resolves.toBe(true);
    await expect(probeAutoplayTestMode(shell(false))).resolves.toBe(false);
    await expect(probeAutoplayTestMode(brokenShell)).resolves.toBe(false);
  });

  it("probes the engine override and keeps invalid values out", async () => {
    await expect(probeEngineOverride(shell("mpv"))).resolves.toBe("mpv");
    await expect(probeEngineOverride(shell(null))).resolves.toBeUndefined();
    await expect(probeEngineOverride(shell("vlc"))).resolves.toBeUndefined();
    await expect(probeEngineOverride(brokenShell)).resolves.toBeUndefined();
  });

  it("writes one line with engine, state, position and error", () => {
    expect(autoplayTestLine(snapshot()))
      .toBe("engine=tauri-native (mpv) state=playing position=12.3s error=none");
    expect(autoplayTestLine(snapshot({
      diagnostics: undefined,
      error: { code: "engine-unavailable", message: "GStreamer is unavailable" },
    }))).toBe(
      "engine=unknown state=playing position=12.3s error=engine-unavailable: GStreamer is unavailable",
    );
  });

  it("logs state changes immediately, position beats on the interval, and drops repeats", () => {
    const messages: string[] = [];
    const invoker: HarnessInvoker = {
      async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        messages.push(`${command}: ${String(args?.message ?? "")}`);
        return null as T;
      },
    };
    let clock = 0;
    const log = createAutoplayTestLogger(invoker, { intervalMs: 2000, now: () => clock });
    const at = (positionSeconds: number) =>
      snapshot({ state: "playing", time: { positionSeconds, durationSeconds: 600, bufferedEndSeconds: 30 } });

    log(snapshot({ state: "opening" }));
    expect(messages).toHaveLength(1);

    log(at(12.34));
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain("state=playing");

    // Same state and position: the identical line is dropped outright.
    log(at(12.34));
    expect(messages).toHaveLength(2);

    // A moving position before the interval passes is a dropped beat.
    log(at(13.0));
    expect(messages).toHaveLength(2);

    // Once the interval has passed the beat is written.
    clock = 2100;
    log(at(14.5));
    expect(messages).toHaveLength(3);

    // Errors print immediately, whatever the interval says.
    log(snapshot({ state: "error", error: { code: "unsupported-format", message: "no decoder" } }));
    expect(messages).toHaveLength(4);
    expect(messages[3]).toContain("error=unsupported-format");
  });
});
