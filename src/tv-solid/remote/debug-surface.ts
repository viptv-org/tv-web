import type { Accessor } from "solid-js";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

/** Everything a browser session can read without looking at the canvas.
 *
 * The TV screens draw their state; a test cannot query a canvas. This surface
 * publishes exactly the facts the specs assert on — screen, focus, overlay,
 * player, picker, live — so a session can be checked in the same terms the
 * contract uses. It writes and decides nothing.
 */
export function publishTestSurface(view: Accessor<{
  screen: string;
  zone: string;
  column: number;
  row: number;
  heroAction: number;
  choice: number;
  navs: readonly { id: string }[];
  overlayKind: string | undefined;
  sources: number;
  sourceProviders: string;
  playerState: string;
  playbackError: string;
  showControls: boolean;
  heroStarted: number | undefined;
  seeking: boolean;
  snapshot: PlayerSnapshot | undefined;
  timelineFocused: boolean;
  playerTools: string;
  sourcePhase: string;
  sourcePreparing: boolean;
  busy: boolean;
  sourceIdentity: string;
  episode: number | undefined;
  nextStatus: string;
  nextPrepared: boolean;
  countdownRemaining: number | null | undefined;
  sourceMenu: string | undefined;
  sourceFilterFocus: boolean;
  sourceFacet: number;
  sourceMenuChoice: number;
  sourceFilter: string | undefined;
  sourceFailure: string;
  librarySort: string;
  calendarEntries: number;
  sourceStatus: string;
  ready: boolean;
  channelId: string;
  searchRow: string;
  searchRows: number;
  saver: boolean;
  liveSpread: string;
}>): void {
  const root = document.documentElement;
  const value = view();
  root.dataset.tvScreen = value.screen;
  root.dataset.tvNavigation = value.navs.map(item => item.id).join(",");
  root.dataset.tvOverlay = value.overlayKind ?? "";
  root.dataset.tvSources = String(value.sources);
  root.dataset.tvSourceProviders = value.sourceProviders;
  root.dataset.tvSourceChoice = String(value.choice);
  root.dataset.tvPlayerState = value.playerState;
  root.dataset.tvPlaybackError = value.playbackError;
  root.dataset.tvPlayerControls = String(value.showControls);
  root.dataset.tvHeroCycle = value.heroStarted === undefined ? "" : String(value.heroStarted);
  root.dataset.tvPlayerSeeking = String(value.seeking);
  const time = value.snapshot?.time;
  root.dataset.tvPlayerPosition = String(time?.positionSeconds ?? "");
  root.dataset.tvPlayerDuration = String(time?.durationSeconds ?? "");
  const diagnostics = value.snapshot?.diagnostics;
  root.dataset.tvPlayerVideoFrames = String(diagnostics?.videoFrames ?? "");
  root.dataset.tvPlayerDecodedFrames = String(diagnostics?.decodedFrames ?? "");
  root.dataset.tvPlayerPresentedFrames = String(diagnostics?.presentedFrames ?? "");
  root.dataset.tvPlayerPresentedPosition = String(diagnostics?.presentedPositionSeconds ?? "");
  root.dataset.tvPlayerVideoProgress = diagnostics?.videoFrameProgress ?? "";
  root.dataset.tvPlayerTimelineFocus = String(value.timelineFocused);
  // The row's order, so a session can reach a control by name instead of by
  // counting presses.
  root.dataset.tvPlayerTools = value.playerTools;
  root.dataset.tvSourcePhase = value.sourcePhase;
  root.dataset.tvSourcePreparing = String(value.sourcePreparing);
  root.dataset.tvPlayerBusy = String(value.busy);
  root.dataset.tvSourceIdentity = value.sourceIdentity;
  root.dataset.tvPlayerEpisode = String(value.episode ?? "");
  root.dataset.tvNextStatus = value.nextStatus;
  root.dataset.tvNextPrepared = String(value.nextPrepared);
  root.dataset.tvAutoplayCountdown = String(value.countdownRemaining ?? "");
  root.dataset.tvSourceMenu = value.sourceMenu ?? "";
  root.dataset.tvSourceFilterFocus = String(value.sourceFilterFocus);
  root.dataset.tvSourceFacet = String(value.sourceFacet);
  root.dataset.tvSourceMenuChoice = String(value.sourceMenuChoice);
  root.dataset.tvSourceFilter = value.sourceFilter ?? "";
  root.dataset.tvSourceFailure = value.sourceFailure;
  root.dataset.tvLibrarySort = value.librarySort;
  root.dataset.tvCalendarEntries = String(value.calendarEntries);
  // The picker's own state, so a session can be checked without reading the
  // canvas: the status line and the empty state are drawn, not queried.
  root.dataset.tvSourceStatus = value.sourceStatus;
  root.dataset.tvReady = String(value.ready);
  root.dataset.tvChannelId = value.channelId;
  root.dataset.tvSearchRow = value.searchRow;
  root.dataset.tvSearchRows = String(value.searchRows);
  root.dataset.tvFocus = value.zone === "confirmation"
    ? `confirmation:${value.row}:${value.column}`
    : `${value.zone}:${value.column}:${value.row}:${value.heroAction}:${value.choice}`;
  root.dataset.tvSaver = String(value.saver);
  // The Live page's own state: the empty, loading and failed forms are not all
  // visible as copy on screen.
  root.dataset.tvLiveSpread = value.liveSpread;
  if (value.screen !== "player") document.getElementById("video-layer")!.style.display = "none";
}
