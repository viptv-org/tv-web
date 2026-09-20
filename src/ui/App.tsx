import type { TvApi } from "../api";
import type { PlayerPlatform } from "@viptv/video";
import { useTvApp } from "./app/useTvApp";
import { AppShell } from "./app/AppShell";

/**
 * The application entry component. The state machine is assembled by
 * useTvApp (src/ui/app/) stage by stage, and AppShell renders it; every
 * file in the app/ directory stays under 500 lines.
 */
export function App({
  api,
  platform = "html5",
  layout = "tv",
}: {
  api: TvApi;
  platform?: PlayerPlatform;
  layout?: "tv" | "responsive";
}) {
  const app = useTvApp(api, platform, layout);
  return <AppShell app={app} />;
}
