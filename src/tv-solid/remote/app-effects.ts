import { createEffect, onCleanup, type Accessor } from "solid-js";
import { RemoteError, type RemoteTvApi } from "./api";
import { stremioHome } from "./stremio-home";
import { applyCaptionAppearance } from "./player/caption-appearance";
import type { Card, Home, Preferences } from "./types";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

/** The app's own effects: the ones that belong to the shell, not to a scene.
 *
 * Each is derived behaviour — an incomplete Home that retries itself, progress
 * that refreshes when the freshness clock ticks, captions that follow the
 * decoder, and the one-shot boot. They live here so the shell reads as "wire,
 * boot, render" rather than 140 lines of interleaved side effects.
 */
export function createAppEffects(options: {
  api: RemoteTvApi;
  signal: () => AbortSignal;
  screen: Accessor<string>;
  home: Accessor<Home | undefined>;
  pending: Accessor<boolean>;
  overlay: Accessor<unknown>;
  selected: Accessor<Card | undefined>;
  seasonIndex: Accessor<number>;
  preferences: Accessor<Preferences | undefined>;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  captionOverride: Accessor<{ leaseId: string; appearance: unknown } | undefined>;
  replaceHome: (value: Home | undefined) => void;
  fail: (error: unknown) => void;
  progressFreshness: Accessor<number>;
  progressRefresh: {
    refresh: (key: string, signal: AbortSignal, perView: boolean,
      work: (current: () => boolean) => Promise<boolean>) => void;
  };
  refreshDetail: (signal: AbortSignal, profile: string, commit: () => void, current: () => boolean) => Promise<unknown>;
  player: { leaseId: string | undefined; subtitleAppearance: unknown };
  cardKey: (card: Card) => string;
  start: () => Promise<void>;
  autoStart: boolean;
}) {
  /** An incomplete Home requests the rest of its rows until it is complete. */
  createEffect(() => {
    const value = options.home();
    const active = options.screen() === "home";
    const signal = options.signal();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    if (value && !value.complete && active) {
      const refresh = async () => {
        try {
          const next = await options.api.home(signal);
          if (!cancelled) options.replaceHome(stremioHome(next));
        } catch (error) {
          if (!cancelled && !(error instanceof DOMException)) {
            if (error instanceof RemoteError && error.status === 401) options.fail(error);
            else timer = setTimeout(refresh, 5000);
          }
        }
      };
      timer = setTimeout(refresh, 2000);
    }
    onCleanup(() => {
      cancelled = true;
      clearTimeout(timer);
    });
  });

  /** Progress refreshes when the freshness clock ticks, per view. */
  createEffect(() => {
    options.progressFreshness();
    const view = options.screen();
    const signal = options.signal();
    const profile = options.api.profile;
    if (!profile || options.pending() || options.overlay()) return;
    if (view === "home") {
      options.progressRefresh.refresh("home", signal, false, async current => {
        const value = await options.api.home(signal);
        if (!current() || options.signal() !== signal || options.screen() !== "home") return false;
        options.replaceHome(stremioHome(value));
        return true;
      });
    } else if (view === "detail" && options.selected()) {
      const selected = options.selected()!;
      const key = options.cardKey(selected) + ":" + options.seasonIndex();
      options.progressRefresh.refresh("detail:" + key, signal, true, async current => {
        let committed = false;
        await options.refreshDetail(signal, profile, () => { committed = true; }, current);
        return committed;
      });
    }
  });

  /** Captions follow the decoder's own appearance unless a lease overrode it. */
  createEffect(() => {
    options.snapshot();
    const override = options.captionOverride();
    const appearance = override?.leaseId === options.player.leaseId ? override?.appearance : options.player.subtitleAppearance;
    applyCaptionAppearance(appearance as never, options.preferences()?.preferences as never);
  });

  // Roku's native host mounts the shared root without running the component's
  // onMount in some launch paths, so boot from a one-shot effect.
  let requested = false;
  createEffect(() => {
    if (requested) return;
    requested = true;
    if (options.autoStart) void options.start();
  });
}
