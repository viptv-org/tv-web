import { batch, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { RemoteError } from "./api";
import { createPairingFlow } from "./session/pairing";
import { stremioHome } from "./stremio-home";
import type { Bootstrap, Preferences } from "./types";

/** The revision tuple that makes a playback-relevant server change visible. */
export const playbackRevisionKey = (value: Record<string, number | string>) =>
  JSON.stringify([value.configuration, value.addons, value.policy, value.preferences]);
import type { Screen } from "./app-types";

/** One session: who is watching, what the server says about them, and how the app
 * gets back to a usable screen when that answer changes.
 *
 * Every scene exposes `reset()`, and this is the only place that calls them all.
 * A reset that has to remember each scene's internals is how a stale row or a
 * stale picker survives a profile switch.
 */
export function createSessionScene(options: {
  api: RemoteTvApi;
  initialLoading: boolean | undefined;
  screen: Accessor<Screen>;
  setScreen: Setter<Screen>;
  zone: Accessor<string>;
  setZone: Setter<string>;
  setColumn: Setter<number>;
  setRow: Setter<number>;
  loading: Accessor<boolean>;
  setLoading: Setter<boolean>;
  error: Accessor<string>;
  pending: Accessor<boolean>;
  setError: Setter<string>;
  // Scenes that know how to forget themselves.
  picker: { reset: () => void };
  search: { reset: () => void };
  live: { reset: () => void };
  hero: { reset: () => void };
  detail: { reset: () => void };
  calendar: { reset: () => void };
  player: { reset: () => void };
  settings: { reset: () => void };
  paging: { reset: () => void };
  overlays: { retireAnimations: () => void; hide: () => void };
  cancelHold: () => void;
  abortScope: () => void;
  newScope: () => AbortSignal;
  // App-owned state the session writes.
  clearFocus: () => void;
  setCaptionOverride: (value: unknown) => void;
  setPlaybackError: (value: unknown) => void;
  setPage: (value: unknown) => void;
  setFilters: (value: unknown) => void;
  setCatalog: (value: unknown) => void;
  setControls: (value: unknown) => void;
  setSelected: (value: unknown) => void;
  setActiveAction: (value: unknown) => void;
  setActiveChannel: (value: unknown) => void;
  setActiveSource: (value: unknown) => void;
  setManagement: (value: Bootstrap["profile_management"] | undefined) => void;
  setNavigation: (value: Bootstrap["navigation"]) => void;
  setPreferences: (value: Preferences | undefined) => void;
  setHome: (value: Bootstrap["home"] | undefined) => void;
  setLibrary: (value: unknown) => void;
  setSaved: (value: unknown) => void;
  setAccountEmail: (value: unknown) => void;
  setHeroAction: (value: unknown) => void;
  setPlaybackRevision: (value: unknown) => void;
  setSignedIn: Setter<Bootstrap | undefined>;
  signedIn: Accessor<Bootstrap | undefined>;
  setCanManageAccount: (value: unknown) => void;
  setPairing: (value: unknown) => void;
  setPairingDeadline: (value: unknown) => void;
  setPairingFocused: (value: unknown) => void;
  qr: (value: unknown) => void;
  revisions: { adopt: (value: Record<string, number | string>) => void };
  scheduleRevisions: () => void;
  fail: (error: unknown) => void;
  retry: (work: () => void) => void;
}) {
  let authorityKnown = false;
  let startupFlight: Promise<void> | undefined;

  /** A new scope for this screen: every request that outlived it is retired. */
  function resetScope(): AbortSignal {
    options.player.reset();
    options.setSignedIn(undefined);
    options.setCanManageAccount(undefined);
    options.overlays.retireAnimations();
    options.abortScope();
    options.search.reset();
    options.settings.reset();
    options.paging.reset();
    const signal = options.newScope();
    options.picker.reset();
    options.setLoading(false);
    options.setError("");
    options.overlays.hide();
    options.cancelHold();
    return signal;
  }

  /** A new profile: every scene forgets itself in one pass. */
  function clearProfileView(): void {
    options.clearFocus();
    batch(() => {
      options.setCaptionOverride(undefined);
      options.setPlaybackError("");
      options.setPage({ cards: [], complete: true });
      options.search.reset();
      options.setFilters({});
      options.setCatalog(undefined);
      options.setControls(undefined);
      options.picker.reset();
      options.setActiveAction(undefined);
      options.setActiveChannel(undefined);
      options.setActiveSource(undefined);
      options.setSelected(undefined);
      options.detail.reset();
      options.hero.reset();
      options.calendar.reset();
      options.live.reset();
      options.setManagement(undefined);
      options.setNavigation(undefined);
      options.setAccountEmail("");
      options.setPreferences(undefined);
      options.setLibrary(undefined);
      options.setHome(undefined);
      options.settings.reset();
      options.setHeroAction(0);
      options.setSaved(new Map());
    });
  }

  function applyBootstrap(value: Bootstrap): void {
    clearProfileView();
    batch(() => {
      options.setManagement(value.profile_management);
      options.setNavigation(value.navigation);
      options.setAccountEmail(value.identity.account?.username ?? value.identity.account?.name ?? "");
      options.setPreferences(value.preferences ?? undefined);
      options.setHome(stremioHome(value.home ?? undefined));
      options.setSaved(new Map());
      options.revisions.adopt(value.revisions ?? {});
      options.setPlaybackRevision(playbackRevisionKey(value.revisions ?? {}));
      options.setLoading(false);
      options.setScreen(options.api.profile ? "home" : "profiles");
      options.setZone(options.api.profile ? "hero" : "profiles");
      options.setColumn(0);
      options.setRow(0);
    });
    options.scheduleRevisions();
  }

  function start(): Promise<void> {
    if (startupFlight) return startupFlight;
    authorityKnown = false;
    const restore = async () => {
      if (options.initialLoading !== false) options.setLoading(true);
      options.setError("");
      try {
        if (await options.api.restore())
          applyBootstrap(await options.api.bootstrap(options.newScope() as never));
        else options.setLoading(false);
        authorityKnown = true;
      } catch (e) {
        if (e instanceof RemoteError && e.status === 401) authorityKnown = true;
        options.fail(e);
      }
    };
    startupFlight = restore().finally(() => { startupFlight = undefined; });
    return startupFlight;
  }

  const pairingFlow = createPairingFlow({
    api: options.api,
    retry: () => { options.retry(() => void beginPairing()); },
    fail: options.fail,
    begin: () => {
      if (options.screen() !== "pairing") options.setPairingFocused(false);
      const signal = resetScope();
      options.setScreen("pairing");
      options.setPairing(undefined);
      options.qr("");
      options.setLoading(true);
      return signal;
    },
    issued: options.setPairing,
    deadline: options.setPairingDeadline,
    qr: options.qr,
    ready: () => { options.setLoading(false); },
    complete: (authenticated: Bootstrap) => {
      batch(() => {
        options.setSignedIn(authenticated);
        options.setPairing(undefined);
        options.qr("");
        options.setScreen("signed-in");
        options.setZone("confirmation");
        options.setColumn(0);
        options.setRow(0);
      });
    },
  });

  async function beginPairing(): Promise<void> {
    if (!authorityKnown || (options.screen() === "welcome" && options.error())) {
      await start();
      return;
    }
    if (options.loading() || options.pending() || !["welcome", "pairing"].includes(options.screen())) return;
    await pairingFlow();
  }

  function finishSignIn(): void {
    const authenticated = options.signedIn();
    if (!authenticated || options.screen() !== "signed-in") return;
    options.setSignedIn(undefined);
    applyBootstrap(authenticated);
  }

  return {
    start, beginPairing, finishSignIn, resetScope, clearProfileView, applyBootstrap,
    authorityKnown: () => authorityKnown,
  };
}

export type SessionScene = ReturnType<typeof createSessionScene>;
