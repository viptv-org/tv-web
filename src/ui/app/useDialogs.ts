import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  TvApi,
  TvApiError,
  type MediaItem,
  type MediaPresentation,
  type MediaSource,
  type DevicePairing,
  type TvProfile,
  type Catalog,
  type PlaybackSession,
  type PlaybackPreferences,
  type PlaybackCapabilities,
} from "../../api";
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  isTauriRuntime,
  resolveTauriVideoInvoker,
  type NativeVideoEngine,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "@viptv/video";
import { exactResumeSource, resolveNext } from "../continuation";
import {
  connectionSummary,
  describeApiError,
  nextConnectionFailure,
  type ConnectionIssue,
  type ErrorDetail,
} from "../errors";
import { focusElement } from "../remote";
import { enrichDetail, mergeEpisodeProgress, initialEpisode } from "../detailProgress";
import { readStoredEngine, storeEngine } from "../enginePreference";
import { createAutoplayTestLogger, probeAutoplayTestMode, probeEngineOverride } from "../../testing/autoplay-harness";
import { catalogFilters, catalogDefaults } from "../catalogFilters";
import { BrowserNavigation, readBrowserRoute, safeRestoredRoute, type BrowserRoute, type SettingsSubpage } from "../browserNavigation";
import { seekPinReleased, type BufferedRange } from "../SeekBar";
import type { Screen } from "../screens";
import { normalizeCore } from "../../core";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { AppApi, CoreApi, DialogsApi, AuthApi, PlaybackEngineApi, PlaybackSessionApi, CatalogApi, NavigationApi } from "./useTvApp";

export function useDialogs(app: CoreApi) {
  const { api, entry, error, errorFocus, modal, modalFocus, screen, session, setBootingHome, setEntryState, setError, setStartupAttempt, setToast } = app;

  useLayoutEffect(() => {
    if (modal) {
      if (!modalFocus.current)
        modalFocus.current =
          (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
      // Focus the dialog's own primary action: the current value for filters,
      // the body for detail panels, the first choice otherwise. Keyboard focus
      // never stays behind the scrim on open.
      const preferred = modal.focus
        ? modal.choices.findIndex((choice) => choice.label === modal.focus)
        : -1;
      focusElement(
        modal.body
          ? "source-detail-body"
          : preferred >= 0
            ? `modal-${preferred}`
            : "modal-0",
      );
    } else if (modalFocus.current) {
      const id = modalFocus.current;
      modalFocus.current = "";
      // Restore the invoker directly so keyboard focus lands back on the
      // control that opened the dialog instead of the document body.
      document
        .querySelector<HTMLElement>(`[data-focus-id="${id}"]`)
        ?.focus({ preventScroll: true });
    }
  }, [modal]);
  const entryFocus = useRef("");
  const parentScope = useRef<ReturnType<TvApi["createScope"]>>();
  const setEntry = (value: typeof entry) => {
    if (!value) {
      parentScope.current?.abort();
      parentScope.current = undefined;
    }
    if (value && !entry)
      entryFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
    setEntryState(value);
  };
  useEffect(() => {
    if (!entry && entryFocus.current) {
      const id = entryFocus.current;
      entryFocus.current = "";
      const timer = setTimeout(() => focusElement(id), 30);
      return () => clearTimeout(timer);
    }
  }, [entry]);
  useEffect(() => {
    if (error) {
      errorFocus.current =
        (document.activeElement as HTMLElement)?.dataset.focusId ?? "";
      setTimeout(() => focusElement("dismiss-error"), 30);
      if (screen !== "startup") {
        const timer = setTimeout(() => {
          setError("");
        }, 4000);
        return () => clearTimeout(timer);
      }
    } else if (errorFocus.current) {
      focusElement(errorFocus.current);
      errorFocus.current = "";
    }
  }, [error, screen]);
  const notify = (message: string) => setToast(message);
  // One coalesced connectivity surface: the first network failure opens it,
  // later failures update it, and a successful probe clears it again.
  const [connection, setConnection] = useState<ConnectionIssue>();
  // A session-machine failure while the backend was unreachable: retry the
  // session automatically once the probe reports recovery.
  const pendingSessionRetry = useRef(false);
  const connected = connection !== undefined;
  useEffect(() => {
    if (!connected || !api) return;
    let cancelled = false;
    let probing = false;
    const probe = () => {
      if (probing || cancelled) return;
      probing = true;
      void api
        .probeBackend()
        .then((reachable) => {
          probing = false;
          if (!cancelled && reachable) {
            setConnection(undefined);
            if (pendingSessionRetry.current) {
              pendingSessionRetry.current = false;
              setStartupAttempt((attempt) => attempt + 1);
            }
          }
        })
        .catch(() => {
          probing = false;
        });
    };
    probe();
    const timer = setInterval(probe, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connected, api]);
  const fail = (e: unknown) => {
    setBootingHome(false);
    if (e instanceof DOMException && e.name === "AbortError") return;
    const detail = describeApiError(e);
    if (detail.kind === "network" || detail.kind === "server") {
      setConnection((previous) => nextConnectionFailure(previous, Date.now()));
      return;
    }
    setError(detail.message);
  };

  return { setEntry, notify, fail, connection, setConnection, pendingSessionRetry, parentScope, entryFocus };
}
