import type { TvApi } from "../../api";
import type { PlayerPlatform } from "@viptv/video";
import { useAppCore } from "./useAppCore";
import { useDialogs } from "./useDialogs";
import { useAuth } from "./useAuth";
import { usePlaybackEngine } from "./usePlaybackEngine";
import { usePlaybackSession } from "./usePlaybackSession";
import { useCatalog } from "./useCatalog";
import { useNavigation } from "./useNavigation";
import { usePlaybackControls } from "./usePlaybackControls";
import { useHero } from "./useHero";

/**
 * The application API, assembled stage by stage. Each type is the state and
 * functions available to the stage that receives it; the ladder keeps the
 * type graph acyclic (no stage's return type feeds back into its own
 * parameter type).
 */
export type CoreApi = ReturnType<typeof useAppCore>;
export type DialogsApi = CoreApi & ReturnType<typeof useDialogs>;
export type AuthApi = DialogsApi & ReturnType<typeof useAuth>;
export type PlaybackEngineApi = AuthApi & ReturnType<typeof usePlaybackEngine>;
export type PlaybackSessionApi = PlaybackEngineApi & ReturnType<typeof usePlaybackSession>;
export type CatalogApi = PlaybackSessionApi & ReturnType<typeof useCatalog>;
export type NavigationApi = CatalogApi & ReturnType<typeof useNavigation>;
export type PlaybackControlsApi = NavigationApi & ReturnType<typeof usePlaybackControls>;
export type AppApi = PlaybackControlsApi & ReturnType<typeof useHero>;

export function useTvApp(api: TvApi, platform: PlayerPlatform, layout: "tv" | "responsive") {
  const app = { ...useAppCore(api, platform, layout) } as unknown as AppApi;
  Object.assign(app, useDialogs(app));
  Object.assign(app, useAuth(app));
  Object.assign(app, usePlaybackEngine(app));
  Object.assign(app, usePlaybackSession(app));
  Object.assign(app, useCatalog(app));
  Object.assign(app, useNavigation(app));
  Object.assign(app, usePlaybackControls(app));
  Object.assign(app, useHero(app));
  return app;
}
