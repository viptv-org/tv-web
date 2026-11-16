import { createSignal } from "solid-js";
import { RemoteError, type RemoteTvApi } from "./api";
import { DevicePlayback, deviceProfileKey } from "./device-playback";
import { createRevisionPoller } from "./session/revisions";
import { createProgressFreshness } from "./progress-freshness";
import { playbackRevisionKey } from "./session-scene";
import type { TvState } from "./state";

/** The shell's ports: one scope, one retry, one failure path.
 *
 * Everything asynchronous in the app goes through these four functions, which is
 * why they are one object. A request carries the scope's signal; a failure either
 * retires the session (401) or lands on the page's card; a retry is whatever the
 * last request would do again; and `run` is the same failure path for work that
 * toggles a pending state instead of a page load.
 */
export function createShell(options: {
  api: RemoteTvApi;
  tv: TvState;
  /** Lazy handles, because the things a failure retires are created later. */
  start: () => Promise<void>;
  resetScope: () => AbortSignal;
  clearProfileView: () => void;
  retry: (work: () => void) => void;
  applyRevision: (fresh: never, signal: AbortSignal, profile: string, commit: () => void) => Promise<void>;
  sessionReset: () => AbortSignal;
  sessionAdopt: (value: never) => void;
  stopPlayer: () => Promise<void>;
  adoptPreferences: (value: unknown) => void;
  overlay: () => unknown;
  overlayClosing: () => boolean;
}) {
  let scope = new AbortController();
  let alive = true;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const call = <T,>(path: string, method = "GET", body?: unknown, signal: AbortSignal = scope.signal) =>
    options.api.call<T>(path, method, body, signal);

  const notify = (message: string) => {
    options.tv.setNotice(message);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => options.tv.setNotice(""), 3500);
  };

  const fail = (e: unknown) => {
    if (!alive || (e instanceof DOMException && e.name === "AbortError")) return;
    if (e instanceof RemoteError && e.status === 401) {
      revisions.stop();
      options.api.retireProfile();
      options.resetScope();
      void options.stopPlayer().catch(() => {});
      options.clearProfileView();
      options.tv.setScreen("welcome");
      options.retry(() => void options.start());
    }
    options.tv.setError(e instanceof Error ? e.message : "Couldn’t load. Try again.");
    if (options.tv.screen() === "player" && !["playing", "paused"].includes(options.tv.snapshot()?.state ?? ""))
      options.tv.setPlaybackError(options.tv.error());
    options.tv.setLoading(false);
  };

  const run = async (work: () => Promise<void>) => {
    if (options.tv.pending() || options.overlayClosing()) return;
    options.tv.setPending(true);
    options.tv.setError("");
    options.retry(() => void run(work));
    try {
      await work();
    } catch (e) {
      fail(e);
    } finally {
      if (alive) options.tv.setPending(false);
    }
  };

  async function checkPlaybackRevision() {
    const value = await call<Record<string, number | string>>(options.api.scoped("/revisions"));
    if (playbackRevisionKey(value) === options.tv.playbackRevision()) return;
    const fresh = await options.api.preferences(scope.signal);
    options.adoptPreferences(fresh);
    options.tv.setPlaybackRevision(playbackRevisionKey(value));
  }

  const devicePlayback = new DevicePlayback(undefined, () => options.tv.setDeviceRevision(v => v + 1));
  const deviceScope = () => deviceProfileKey(options.api.origin, options.api.profile);

  const [progressFreshness, setProgressFreshness] = createSignal(0);
  const progressRefresh = createProgressFreshness({
    owner: () => JSON.stringify([options.api.origin, options.api.profile, options.api.scopeEpoch]),
    alive: () => alive,
    changed: () => setProgressFreshness(value => value + 1),
    failure: error => { if (error instanceof RemoteError && [401, 403].includes(error.status)) fail(error); },
  });

  const revisions = createRevisionPoller({
    ready: () => !!options.api.profile && document.visibilityState === "visible" &&
      !(options.tv.screen() !== "player" && options.overlay()) && !options.tv.pending(),
    playing: () => options.tv.screen() === "player",
    blocked: () => !!options.overlay() || options.tv.pending(),
    alive: () => alive,
    profile: () => options.api.profile,
    signal: () => scope.signal,
    read: (signal: AbortSignal) => call<Record<string, number | string>>(options.api.scoped("/revisions"), "GET", undefined, signal),
    bootstrap: (signal: AbortSignal) => options.api.bootstrap(signal),
    playback: checkPlaybackRevision,
    reset: () => options.sessionReset(),
    adoptBootstrap: (value: unknown) => options.sessionAdopt(value as never),
    apply: (fresh: unknown, signal: AbortSignal, profile: string, commit: () => void) => options.applyRevision(fresh as never, signal, profile, commit),
    fail: (error: unknown) => fail(error),
  });

  function abort() { scope.abort(); }
  /** A new scope for this screen: every request that outlived it is retired. */
  function restart(): AbortSignal {
    scope = new AbortController();
    return scope.signal;
  }
  function dispose() { alive = false; clearTimeout(noticeTimer); }

  return {
    signal: () => scope.signal, controller: () => scope, abort, restart, call, notify, fail, run, checkPlaybackRevision,
    devicePlayback, deviceScope, progressRefresh, progressFreshness, revisions,
    scheduleRevisions: revisions.schedule, dispose,
  };
}

export type Shell = ReturnType<typeof createShell>;
