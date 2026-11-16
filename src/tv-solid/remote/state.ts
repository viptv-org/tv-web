import { createSignal, type Accessor, type Setter } from "solid-js";
import type { Bootstrap, Card, Catalog, Controls, Pairing, Page, Source, TitleAction } from "./types";
import type { Screen } from "./app-types";
import type { CountdownState } from "./autoplay-countdown";
import type { EpisodePreparationState } from "./episode-preparation";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

type CaptionOverride = {
  leaseId: string;
  appearance: { font_scale: number; text_color: string; background_color: string };
};

/** The state the shell owns.
 *
 * These are the values that belong to "the app", not to a page: what is focused
 * (screen, zone, column, row, choice), whether the page is loading, what the
 * player is doing, and what has been sent to it. Every scene reads them through
 * accessors and writes through the setters, so no scene keeps a second copy.
 *
 * Anything that *can* live with a scene does — see hero-scene, live-scene,
 * player-scene and the rest. What is left here is the residue that several
 * scenes genuinely share.
 */
export function createTvState(options: { initialLoading?: boolean }) {
  // Session and page status.
  const [loading, setLoading] = createSignal(options.initialLoading ?? true);
  const [error, setError] = createSignal("");
  const [playbackError, setPlaybackError] = createSignal("");
  const [pending, setPending] = createSignal(false);

  // Focus. `choice` is the selected control inside a row, the overlay or the
  // player's toolbar; the rest is the position in the page.
  const [screen, setScreen] = createSignal<Screen>("welcome");
  const [zone, setZone] = createSignal("nav");
  const [column, setColumn] = createSignal(1);
  const [row, setRow] = createSignal(0);
  const [heroAction, setHeroAction] = createSignal(0);
  const [choice, setChoice] = createSignal(0);

  // The list a catalog-shaped screen is showing, and the controls around it.
  const [page, setPage] = createSignal<Page>({ cards: [], complete: true });
  const [controls, setControls] = createSignal<Controls>();
  const [catalog, setCatalog] = createSignal<Catalog>();
  const [filters, setFilters] = createSignal<Record<string, string[]>>({});
  const [selected, setSelected] = createSignal<Card>();

  // Entry: pairing and the signed-in confirmation.
  const [pairing, setPairing] = createSignal<Pairing>();
  const [pairingDeadline, setPairingDeadline] = createSignal(0);
  const [pairingFocused, setPairingFocused] = createSignal(false);
  const [signedIn, setSignedIn] = createSignal<Bootstrap>();
  const [qr, setQr] = createSignal("");
  const [accountEmail, setAccountEmail] = createSignal("");
  const [canManageAccount, setCanManageAccount] = createSignal<boolean>();

  // The player session: what is being watched and what the engine reports.
  const [snapshot, setSnapshot] = createSignal<PlayerSnapshot>();
  const [showControls, setShowControls] = createSignal(true);
  const [pauseRequested, setPauseRequested] = createSignal(false);
  const [seek, setSeek] = createSignal<number>();
  const [seeking, setSeeking] = createSignal(false);
  const [timelineFocused, setTimelineFocused] = createSignal(true);
  const [trackColumn, setTrackColumn] = createSignal(0);
  const [activeAction, setActiveAction] = createSignal<TitleAction>();
  const [activeChannel, setActiveChannel] = createSignal<string>();
  const [activeSource, setActiveSource] = createSignal<Source>();
  // The source the picker handed to playback. It stays set for exactly as long
  // as the player is preparing it, which is what the contract's
  // `Opening stream…` state reports.
  const [openingSource, setOpeningSource] = createSignal<Source>();
  const [captionOverride, setCaptionOverride] = createSignal<CaptionOverride>();
  const [saved, setSaved] = createSignal<Map<string, boolean>>(new Map());

  // What will play next, and the countdown that decides whether it does.
  const [episodeState, setEpisodeState] = createSignal<EpisodePreparationState>({ status: "idle", preparing: false });
  const [countdownState, setCountdownState] = createSignal<CountdownState>({ running: false, remaining: null, progress: 0 });
  const [advancing, setAdvancing] = createSignal(false);

  // Revisions that invalidate prepared work.
  const [playbackRevision, setPlaybackRevision] = createSignal("");
  const [deviceRevision, setDeviceRevision] = createSignal(0);
  const [sourceMemoryPending, setSourceMemoryPending] = createSignal(0);

  // Screen furniture.
  const [notice, setNotice] = createSignal("");
  const [calibrationValue, setCalibrationValue] = createSignal(0);

  return {
    loading, setLoading, error, setError, playbackError, setPlaybackError, pending, setPending,
    screen, setScreen, zone, setZone, column, setColumn, row, setRow, heroAction, setHeroAction, choice, setChoice,
    page, setPage, controls, setControls, catalog, setCatalog, filters, setFilters, selected, setSelected,
    pairing, setPairing, pairingDeadline, setPairingDeadline, pairingFocused, setPairingFocused,
    signedIn, setSignedIn, qr, setQr, accountEmail, setAccountEmail, canManageAccount, setCanManageAccount,
    snapshot, setSnapshot, showControls, setShowControls, pauseRequested, setPauseRequested,
    seek, setSeek, seeking, setSeeking, timelineFocused, setTimelineFocused, trackColumn, setTrackColumn,
    activeAction, setActiveAction, activeChannel, setActiveChannel, activeSource, setActiveSource,
    openingSource, setOpeningSource, captionOverride, setCaptionOverride, saved, setSaved,
    episodeState, setEpisodeState, countdownState, setCountdownState, advancing, setAdvancing,
    playbackRevision, setPlaybackRevision, deviceRevision, setDeviceRevision,
    sourceMemoryPending, setSourceMemoryPending, notice, setNotice, calibrationValue, setCalibrationValue,
  };
}

export type TvState = ReturnType<typeof createTvState>;
export type { Accessor, Setter };
