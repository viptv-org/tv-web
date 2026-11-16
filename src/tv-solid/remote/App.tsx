/** @jsxImportSource @solidtv/solid */
import { createMemo } from "solid-js";
import { reloadImages } from "./image-source";
import { clearLogoCache, palette } from "./visuals";

import {
  edgeRequest,
} from "./channelWindow";
import { defineScreen } from "../runtime";
import {
  RemoteTvApi,
} from "./api";
import {
  screenSaverMinutes
} from "./display";
import { createIdleScreenSaver } from "./idle-screen-saver";
import { createTextKeyboard } from "./text-keyboard";
import { createRootInput } from "./input-scene";
import { RootScreen, appView } from "./render/root";
import { createTvState } from "./state";
import { createAppEffects } from "./app-effects";
import { createRevisionApply } from "./revision-apply";
import { createAppModel } from "./app/model";
import { createAppScenes } from "./app/scenes";
import { exitTizen } from "../platform/tizen-host";
import { channelKey } from "./channelWindow";
import { createOverlayController } from "./overlay-controller";
import { createScreenLayer } from "./app/layer";
import {
  cardKey,
  type Bootstrap,
  type LivePage,
} from "./types";

const available = (value?: { availability: string }) =>
  value?.availability === "Available";

export function createRemoteTvApp(
  api: RemoteTvApi,
  platform: string,
  options: { autoStart?: boolean; initialLoading?: boolean } = {},
) {
  return () => {
    const tv = createTvState({ initialLoading: options.initialLoading });
    const {
      setError, playbackError, pending,
      screen, zone, setZone, column, setColumn, row, setRow, choice, setChoice,
      selected, snapshot, captionOverride,
    } = tv;
    const model = createAppModel();
    const {
      home, setManagement, setNavigation, preferences, navs, navIndex,
    } = model;
    const { text, setText, key, setKey, upper: keyboardUpper, setUpper: setKeyboardUpper,
      symbols: keyboardSymbols, setSymbols: setKeyboardSymbols, characters: keyboardCharacters } = createTextKeyboard();
    const overlays = createOverlayController({
      focus: {screen, capture: () => ({zone: zone(), column: column(), row: row(), choice: choice()}), selection: choice,
        select: index => { setChoice(index); }, restore: focus => { setZone(focus.zone); setColumn(focus.column); setRow(focus.row); setChoice(focus.choice); }},
      text: {clear: () => { setText(""); }, begin: initial => { setKeyboardUpper(false); setKeyboardSymbols(false); setText(initial); setKey(0); }},
      errors: {clear: () => { setError(""); }, restore: () => { setError(screen() === "player" ? playbackError() : ""); }},
    });
    const {current: overlay, entered: overlayEntered, closing: overlayClosing, reportSettled: reportOverlaySettled} = overlays;
    function reloadIdleImages() {
      clearLogoCache();
      reloadImages();
    }
    const { active: screenSaver, dismiss: dismissIdleSaver } = createIdleScreenSaver({
      minutes: screenSaverMinutes, playing: () => screen() === "player", onWake: reloadIdleImages,
    });
    function handleIdleInput() {
      interruptHero();
      return dismissIdleSaver();
    }
    // Created near the end of the closure, where the things a revision
    // re-requests all exist; the shell only holds a reference to it.
    let revisionApply: ReturnType<typeof createRevisionApply> | undefined;
    const applyRevision = (fresh: Bootstrap, signal: AbortSignal, profile: string, commit: () => void) =>
      revisionApply!.applyRevision(fresh, signal, profile, commit);
    // The input layer owns the hold; the scenes only need to cancel it.
    let cancelHold: () => void = () => {};
    const scenes = createAppScenes({
      api, platform, initialLoading: options.initialLoading, tv, model, overlays, screenSaver,
      cancelHold: () => cancelHold(), play: (source, direct, manual) => layer.playSource(source, direct, manual),
      applyRevision: (fresh, signal, profile, commit) => applyRevision(fresh as never, signal, profile, commit),
      settingsTabIndex: label => layer.settingsTabIndex(label),
      loadSettings: (tab, signal) => layer.loadSettings(tab, signal),
      hideControls: () => layer.hideControls(), playIntent: (...args) => layer.playIntent(...args),
      resetSettings: () => layer.settings.reset(), prompt: (...args) => layer.edit(...args),
      more: () => more(), adoptChannelWindow: (pages, searching) => adoptChannelWindow(pages, searching),
      cancelPlay: () => layer.cancelPlay(), exitApp: () => exitTizen(),
    });
    const {
      applyBootstrap, browseQuery, channels, countdown, catalogPager, detailPager, interruptHero, invalidateHistory,
      liveScene, moreChannels, picker, player, refreshDetail, replaceHome, resetScope,
      restartHeroCycling, restartPaging, revealEndedControls, scopeSignal, search, searchScene, seasonIndex,
      shell, start, searchFocus, setPage, setPreferences, setSaved,
      replacePage, loadLibrary,
    } = scenes;
    const searchMediaFocus = searchFocus.media.get;
    const searchChannelFocus = searchFocus.channel.get;

    function adoptChannelWindow(pages: LivePage[], searching = false) {
      const values = pages.flatMap((page) => page.channels);
      if (searching) {
        searchScene.setChannelPages(pages);
        searchScene.setChannels(values);
        return;
      }
      liveScene.setPages(pages);
      // Channels accumulate across the traversed range so the global focus
      // index stays stable as the bounded render window slides underneath. A
      // reset clears them; a reload adopts revised server data for ids already
      // present and appends genuinely new channels.
      liveScene.setChannels((current) => {
        if (!pages.length) return [];
        const byId = new Map(values.map((channel) => [channelKey(channel), channel]));
        const seen = new Set(current.map(channelKey));
        const merged = current.map((channel) => byId.get(channelKey(channel)) ?? channel);
        const fresh = values.filter((channel) => !seen.has(channelKey(channel)));
        return [...merged, ...fresh];
      });
      setPage({
        cards: channels().map((channel) => channel.card),
        complete: pages.at(-1)?.complete ?? true,
      });
    }
    async function more() {
      if (
        screen() === "live" ||
        (screen() === "search" && zone() === "search-channels")
      ) {
        await moreChannels("next");
        return;
      }
      if (screen() === "detail") { await detailPager(); return; }
      await catalogPager();
    }

    const profileEditor = createMemo(() => {
      const value = overlay();
      return value &&
        (value.kind === "choices" || value.kind === "confirm") &&
        value.profile
        ? value
        : undefined;
    });
    const layer = createScreenLayer({
      api, platform, tv, model, scenes, overlays, screenSaver, handleIdleInput: () => handleIdleInput(),
      reloadIdleImages: () => reloadIdleImages(), applyRevision: applyRevision as never, more: () => more(),
      keyboardText: {
        text, setText, key, setKey, keyboardUpper, setKeyboardUpper,
        keyboardSymbols, setKeyboardSymbols, keyboardCharacters,
      },
    });
    const {
      back, fail, heldSelect, keyboard, loadSettings, menu, move, playerNavigation, settingsItems,
      settingsTab, settingsTabs, updateSearch,
    } = layer;
    cancelHold = () => heldSelect.cancel();

    createAppEffects({
      api, signal: () => scopeSignal(), screen, home, pending, overlay: () => overlay(), selected, seasonIndex,
      preferences, snapshot, captionOverride, replaceHome: value => replaceHome(value), fail: error => fail(error),
      progressFreshness: shell.progressFreshness, progressRefresh: shell.progressRefresh, refreshDetail, player, cardKey,
      start: () => start(), autoStart: options.autoStart !== false,
    });
    revisionApply = createRevisionApply({
      api, screen, zone, column, setColumn, navs, navIndex, setNavigation, selected, search, updateSearch,
      resetScope: () => resetScope(), applyBootstrap: value => applyBootstrap(value),
      restartPaging: () => restartPaging(), invalidateHistory, setManagement,
      setPreferences: value => setPreferences(value ?? undefined),
      setSaved: value => setSaved(value), replaceHome: value => replaceHome(value ?? undefined),
      replacePage: value => replacePage(value), browseQuery: () => browseQuery(),
      loadLibrary: (cursor, signal) => loadLibrary(cursor, signal),
      loadSettings: (tab, signal) => loadSettings(tab, signal), settingsTab,
      refreshDetail: (signal, profile, cb) => refreshDetail(signal, profile, cb, () => true),
      refreshLive: (signal, cb) => liveScene.refresh(signal, cb),
      fail: error => fail(error),
    });
    const Root = defineScreen({
      input: createRootInput({
        countdown, handleIdleInput: () => handleIdleInput(), move: (dx, dy) => move(dx, dy),
        back: () => back(), menu: () => menu(), fail: error => fail(error),
        revealEndedControls: () => revealEndedControls(), restartHeroCycling: () => restartHeroCycling(),
        playerNavigation: { cancel: () => playerNavigation.cancel() }, overlay: () => overlay(),
        manualSourceSelection: () => picker.manual.set(true), press: () => heldSelect.press(),
      }),
      render: () => <RootScreen view={appView({
        tv, model, scenes,
        extras: {
          searchMediaFocus, searchChannelFocus, screenSaver, profileEditor, overlay, api, available, palette,
          key, edgeRequest, settingsTabs, settingsTab, settingsItems, overlayEntered, overlayClosing,
          reportOverlaySettled, text, keyboard,
        },
      })} />,
    });
    return <Root />;
  };
}
