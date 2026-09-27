import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TvApi } from "../../src/api";
import type { PlaybackControllerSnapshot, PlayerSnapshot } from "@viptv/video";
import { createSolidTVPlaybackRuntime } from "../../src/tv-solid/playbackRuntime";

const mock = vi.hoisted(() => ({
  player: { snapshot: { sessionId: 0, state: "idle", kind: null, time: { positionSeconds: 0, durationSeconds: null }, tracks: { audio: [], text: [], selectedAudioId: null, selectedTextId: null }, error: null } as PlayerSnapshot, subscribe: vi.fn(), dispose: vi.fn(async () => {}) },
  controller: { snapshot: { active: null, error: null, state: "idle" } as PlaybackControllerSnapshot, subscribe: vi.fn(), recoverPlayback: vi.fn(), start: vi.fn(), stop: vi.fn(async () => {}) },
  offPlayer: vi.fn(), offController: vi.fn(),
}));
vi.mock("@viptv/video", () => ({
  createPlayer: () => mock.player,
  deliveryCapabilitiesFor: () => async () => ({}),
  PlaybackSessionController: class { constructor() { return mock.controller; } },
}));

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
let playerListener: (snapshot: PlayerSnapshot) => void;
let controllerListener: (state: PlaybackControllerSnapshot) => void;
function emit(error: Error, sessionId = 1) {
  mock.player.snapshot = { ...mock.player.snapshot, sessionId, state: "error", error: { code: "unsupported-format", message: error.message } };
  playerListener(mock.player.snapshot);
}
function fixture() {
  const onSnapshot = vi.fn(), onControllerState = vi.fn(), onTerminalError = vi.fn();
  const runtime = createSolidTVPlaybackRuntime({} as TvApi, "vizio", document.createElement("video"), onSnapshot, { onControllerState, onTerminalError });
  return { runtime, onSnapshot, onControllerState, onTerminalError };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.controller.snapshot = { active: null, error: null, state: "idle" };
  mock.controller.recoverPlayback.mockResolvedValue(false);
  mock.player.subscribe.mockImplementation(listener => { playerListener = listener; return mock.offPlayer; });
  mock.controller.subscribe.mockImplementation(listener => { controllerListener = listener; listener(mock.controller.snapshot); return mock.offController; });
});

describe("SolidTV playback recovery callbacks", () => {
  it("forwards controller ownership changes and unsubscribes both streams on disposal", async () => {
    const { runtime, onControllerState } = fixture();
    expect(onControllerState).toHaveBeenCalledWith(mock.controller.snapshot);
    const state = { active: { session: { id: "recovered-session" } }, state: "playing", error: null } as PlaybackControllerSnapshot;
    controllerListener(state);
    expect(onControllerState).toHaveBeenLastCalledWith(state);
    await runtime.dispose(); await runtime.dispose();
    expect(mock.offPlayer).toHaveBeenCalledOnce(); expect(mock.offController).toHaveBeenCalledOnce();
    expect(mock.player.dispose).toHaveBeenCalledOnce();
  });

  it("does not show a transient decoder error that recovery handles", async () => {
    const recovery = deferred<boolean>(); mock.controller.recoverPlayback.mockReturnValue(recovery.promise);
    const { onSnapshot, onTerminalError } = fixture();
    emit(new Error("Recoverable decode failure"));
    expect(onSnapshot).toHaveBeenCalledOnce(); expect(onTerminalError).not.toHaveBeenCalled();
    recovery.resolve(true); await flush();
    expect(onTerminalError).not.toHaveBeenCalled();
  });

  it("reports an unresolved current error once and ignores an obsolete snapshot", async () => {
    const { onTerminalError } = fixture();
    emit(new Error("Terminal decode failure")); await flush();
    playerListener(mock.player.snapshot); await flush();
    expect(onTerminalError).toHaveBeenCalledTimes(1);
    const pending = deferred<boolean>(); mock.controller.recoverPlayback.mockReturnValue(pending.promise);
    emit(new Error("Old failure"));
    mock.player.snapshot = { ...mock.player.snapshot, sessionId: 2, state: "playing", error: null };
    pending.resolve(false); await flush();
    expect(onTerminalError).toHaveBeenCalledTimes(1);
  });

  it("reports recovery failure even when rollback clears the decoder error", async () => {
    const pending = deferred<boolean>(); mock.controller.recoverPlayback.mockReturnValue(pending.promise);
    const { onTerminalError } = fixture();
    emit(new Error("Decode failure"));
    const failure = new Error("Recovery and rollback failed");
    mock.controller.snapshot = { state: "error", active: null, error: failure };
    mock.player.snapshot = { ...mock.player.snapshot, sessionId: 2, state: "stopped", error: null };
    pending.reject(failure); await flush();
    expect(onTerminalError).toHaveBeenCalledWith(failure, mock.controller.snapshot);
  });

  it("ignores recovery completion after stop and ignores AbortError", async () => {
    const pending = deferred<boolean>(); mock.controller.recoverPlayback.mockReturnValue(pending.promise);
    const { runtime, onTerminalError } = fixture();
    emit(new Error("Decode failure")); await runtime.stop();
    const failure = new Error("Late failure"); mock.controller.snapshot = { ...mock.controller.snapshot, error: failure };
    pending.reject(failure); await flush();
    expect(onTerminalError).not.toHaveBeenCalled();
    mock.controller.recoverPlayback.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    emit(new Error("Cancelled recovery")); await flush();
    expect(onTerminalError).not.toHaveBeenCalled();
  });
});
