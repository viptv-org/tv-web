import { installDesktopPointerInput } from "../desktopInput";
import { WindowResizeBorders } from "../WindowResizeBorders";
import { ResponsiveSignIn } from "../ResponsiveSignIn";
import { RemoteRoot } from "../remote";
import { DesktopTitlebar } from "../DesktopTitlebar";
import { DesktopRail, PhoneNav, TvRail, isNavDestination, useTvRail, type NavDestination } from "../ShellNav";
import { Settings } from "../Settings";
import { Guide as LiveGuide } from "../Guide";
import { TvPairing } from "../Pairing";
import { ProfilesScreen } from "../Profiles";
import { HomeScreen } from "../../screens/HomeScreen";
import { BrowseScreen } from "../../screens/BrowseScreen";
import { DetailScreen } from "../../screens/DetailScreen";
import { SourcesScreen } from "../../screens/SourcesScreen";
import { PlayerScreen } from "../../screens/PlayerScreen";
import type { AppApi } from "./useTvApp";
import { desktopShellPreview, isDesktopShell } from "./appShared";
import { AppDialogs } from "./AppDialogs";
import { usePhoneLayout } from "../usePhoneLayout";
import { SearchPopunder } from "../SearchPopunder";
import { HomeSkeleton } from "../../screens/HomeSkeleton";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The application render tree: desktop frame, navigation, screens and
 * dialogs, all reading from the assembled app object.
 */
export function AppShell({ app }: { app: AppApi }) {
  const { activeTrackPopup, bootingHome, requestHomeRows, detailOrigin, api, audioTrackList, authorize, back, browser, busy, canvas, cards, casting, catalog, catalogError, catalogs, catalogValues, chooseProfile, closeCast, commitSeek, seekBy, compactHome, detail, discoverSources, editingProfile, editProfile, engineChoice, engineChoices, entry, episodes, fail, favorites, firstHomeCatalog, fullscreenControl, go, heroDetails, heroItem, heroPresentation, heroRotation, highlighted, homeRows, isMaximized, items, lastControlActivity, layout, libraryQueue, loadCatalog, manage, managing, mediaKey, mediaKeyUp, modal, navigate, nextEpisode, nextSkip, oled, openCast, openingSource, overlay, pair, pairExpired, pairing, platform, play, player, playerInfoOpen, playerNotice, playerRoot, prefs, preparing, playbackStage, profile, profilePage, profiles, qr, query, queue, readBufferedRanges, recentLive, responsive, screen, searchKey, searchPartial, searchRows, season, seek, selected, selectedPresentation, selectEngine, previewSources, sourcePreview, stack, setActiveTrackPopup, setCompactHome, setControlActivity, setEditingProfile, setEntry, setLibraryQueue, setManaging, setModal, setOverlay, setPlayerInfoOpen, setPrefs, setProfile, setProfilePage, setProfiles, setQuery, setScreen, setSeason, setSeek, setSettingsSubpage, setSourceProvider, setSourceQuality, settingsSubpage, shelfCards, snapshot, sourceFocusPending, sourceProvider, sourceProducers, sourceQuality, sources, stop, subtitleOffOption, surfaceClick, textTrackList, toggle, toggleLiveMute, toggleOled, togglePlayback, trackChoices, video } = app;

  useEffect(() => isDesktopShell ? installDesktopPointerInput() : undefined, []);
  const [pictureMode, setPictureMode] = useState<"fit" | "fill">("fit");
  const lastPointerPosition = useRef<{ x: number; y: number; id: number; type: string }>();
  useEffect(() => { lastPointerPosition.current = undefined; }, [screen]);
  const presentedItem = useRef("");
  const selectedKey = selected ? `${selected.type}\0${selected.id}\0${selected.season ?? ""}\0${selected.episode ?? ""}` : "";
  useLayoutEffect(() => {
    if (screen === "player") {
      if (presentedItem.current && presentedItem.current !== selectedKey) setPictureMode("fit");
      if (selectedKey) presentedItem.current = selectedKey;
    } else if (screen !== "sources") {
      presentedItem.current = "";
      setPictureMode("fit");
    }
  }, [screen, selectedKey]);
  useEffect(() => {
    if (!responsive || screen !== "player") return;
    let cancelled = false;
    void player.current?.setPictureMode?.(pictureMode).catch((error: unknown) => {
      if (!cancelled) fail(error);
    });
    return () => { cancelled = true; };
  }, [responsive, screen, pictureMode, snapshot?.sessionId, engineChoice]);

  const activeProfile = profiles.find((p) => p.id === profile);
  const phone = usePhoneLayout(responsive);
  // Title family: under the Sources overlay the title page it was opened from stays
  // mounted (the previous title when it came from one, else the sourced item).
  const sourcesFrom = screen === "sources" ? stack.current[stack.current.length - 1] : undefined;
  const fromTitle = sourcesFrom?.screen === "detail" && sourcesFrom.selected ? sourcesFrom.selected : undefined;
  const titleItem = fromTitle ?? selected;
  const titleEpisodes = screen === "sources" && !fromTitle ? [] : episodes;
  // While the session restores and Home first loads, the responsive shell
  // shows a skeleton of Home in place of the startup cover and screens.
  const booting = responsive && (bootingHome || screen === "startup");
  const emptyHomePending = responsive && screen === "Home" && app.homeCatalogPending && !heroItem && !queue.length && !favorites.length;
  // ---- Shell: app chrome (rails, phone nav, title bar) -------------------
  // Screens that show the navigation chrome (TV rail, desktop / web rail).
  const chromeScreen = !["startup", "pairing", "profiles", "player"].includes(screen);
  const showDesktopRail = responsive && !phone && (booting || chromeScreen);
  // The desktop app searches from the title bar, so its rail has no Search.
  const inRail = (destination: NavDestination) => !(isDesktopShell && destination === "Search");
  // The rail item drawn as current: the screen's destination, or on a title /
  // sources page (and the desktop Search page) the section it was opened from.
  const section = useRef<NavDestination>("Home");
  if (isNavDestination(screen) && inRail(screen)) section.current = screen;
  const currentNav: NavDestination = isNavDestination(screen) && (phone || inRail(screen)) ? screen : section.current;
  const tvRail = useTvRail(!responsive && chromeScreen, screen);
  const openProfiles = () => setScreen("profiles");
  const openHeaderSettings = () => { void navigate("Settings"); };
  return (
    <RemoteRoot
      inputMode={isDesktopShell ? "desktop" : layout}
      onToggleFullscreen={() => {
        if (activeTrackPopup) {
          setActiveTrackPopup(null);
          return;
        }
        if (playerInfoOpen) {
          setPlayerInfoOpen(false);
          return;
        }
        if (casting) {
          closeCast();
          return;
        }
        if (editingProfile) {
          setEditingProfile(undefined);
          return;
        }
        if (entry) {
          setEntry(undefined);
          return;
        }
        if (modal) {
          setModal(undefined);
          return;
        }
        // Escape toggles fullscreen only inside the player; on every other
        // screen it follows the browser Back contract the e2e suite pins.
        if (screen === "player") {
          void fullscreenControl.toggle();
          return;
        }
        back();
      }}
      onBack={() => tvRail.exit() || (casting ? closeCast() : screen === "player" && fullscreenControl.fullscreen && !modal && !entry && !editingProfile ? void fullscreenControl.exit() : back())}
      onMediaKey={mediaKey}
      onMediaKeyUp={mediaKeyUp}
      onNavigate={() => {
        setOverlay(true);
        sourceFocusPending.current = false;
      }}
    >
      <div className={`desktop-app-frame ${isDesktopShell ? "desktop-shell" : "browser-shell"} ${showDesktopRail ? "has-desktop-rail" : ""} ${isMaximized ? "is-maximized" : ""} ${fullscreenControl.fullscreen ? "is-fullscreen" : ""}`}>
        {responsive && isDesktopShell && (
          <WindowResizeBorders disabled={fullscreenControl.fullscreen || isMaximized} />
        )}
        {responsive && isDesktopShell && !fullscreenControl.fullscreen && (
          <DesktopTitlebar
            variant={["pairing", "profiles"].includes(screen) ? "pairing" : "app"}
            onTogglePlayerFullscreen={screen === "player" ? () => void fullscreenControl.toggle() : undefined}
            canGoForward={browser.current?.canGoForward() ?? false}
            onNavigateForward={() => void browser.current?.forward()}
            canGoBack={
              screen !== "startup" &&
              screen !== "pairing" &&
              screen !== "profiles" &&
              (screen !== "Home" || (browser.current?.canGoBack() ?? false))
            }
            onNavigateBack={back}
            center={
              profile && !["startup", "pairing", "profiles"].includes(screen) ? (
                <SearchPopunder
                  api={api}
                  catalogs={catalogs}
                  profile={profile}
                  onOpen={(item) => void detail(item)}
                  onSubmit={(value) => {
                    setQuery(value);
                    void navigate("Search");
                  }}
                />
              ) : undefined
            }
          />
        )}
        {showDesktopRail && (
          <DesktopRail
            current={booting ? "Home" : currentNav}
            onNavigate={(destination) => void navigate(destination)}
            withSearch={!isDesktopShell}
            casting={casting}
            onCast={openCast}
            profile={booting ? undefined : activeProfile}
            onProfiles={openHeaderSettings}
            skeleton={booting}
          />
        )}
        <div
          ref={playerRoot}
          onClick={(event) => {
            // Native playback hides the HTML video anchor. Bare picture taps
            // therefore land on its containing screen instead of the video.
            if (event.target === event.currentTarget) surfaceClick();
          }}
          onDoubleClick={(event) => {
            if (responsive && screen === "player" && event.target === event.currentTarget)
              void fullscreenControl.toggle();
          }}
          onPointerMove={(event) => {
            if (!responsive || screen !== "player") return;
            const previous = lastPointerPosition.current;
            const position = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType };
            lastPointerPosition.current = position;
            if (previous && previous.x === position.x && previous.y === position.y && previous.id === position.id && previous.type === position.type) return;
            if (Date.now() - lastControlActivity.current > 1000) {
              lastControlActivity.current = Date.now();
              setOverlay(true);
              setControlActivity(value => value + 1);
            }
          }}
          onPointerDownCapture={(event) => { if (responsive && screen === "player" && (event.target as HTMLElement).closest("button, input")) { setOverlay(true); setControlActivity(value => value + 1); } }}
          className={`tv-screen ${responsive ? "responsive-app" : "tv-layout"} ${isMaximized ? "is-maximized" : ""} ${fullscreenControl.fullscreen ? "is-fullscreen" : ""} screen-${screen.replace(/ /g, "-").toLowerCase()} ${screen === "player" ? "playing" : ""}`}
          data-picture-mode={responsive ? pictureMode : undefined}
        >
        <video
          ref={video}
          className="video"
          playsInline
          onClick={surfaceClick}
          onDoubleClick={responsive && screen === "player" ? () => void fullscreenControl.toggle() : undefined}
        />
        <canvas ref={canvas} className="video player-canvas" style={{ display: "none" }} onClick={surfaceClick} />
        {(booting || emptyHomePending) && <HomeSkeleton phone={phone} />}
        {responsive && phone && (booting || (isNavDestination(screen) && screen !== "Settings")) && (
          <PhoneNav current={booting ? "Home" : currentNav} onNavigate={(destination) => void navigate(destination)} skeleton={booting} />
        )}
        {/* ---- Account: sign-in / pairing and Who's watching (account family) ---- */}
        {booting || screen === "startup" ? null : screen === "pairing" ? (
          responsive
            ? <ResponsiveSignIn api={api} pair={pair} qr={qr} expired={pairExpired} onRetry={() => void pairing()} />
            : <TvPairing pair={pair} qr={qr} expired={pairExpired} onRetry={() => void pairing()} />
        ) : screen === "profiles" ? (
          <ProfilesScreen
            profiles={profiles}
            managing={managing}
            onManage={() => setManaging(!managing)}
            page={profilePage}
            onPage={setProfilePage}
            onChoose={(id) => void chooseProfile(id)}
            onEdit={editProfile}
            tv={!responsive}
          />
        ) : (
          <>
            {!responsive && chromeScreen && (
              <TvRail
                current={currentNav}
                profile={activeProfile}
                onNavigate={(destination) => void navigate(destination)}
                onProfiles={openProfiles}
                onExit={tvRail.exit}
              />
            )}
            {screen === "Home" && !emptyHomePending && (
              <HomeScreen
                responsive={responsive}
                compactHome={compactHome}
                setCompactHome={setCompactHome}
                heroPresentation={heroPresentation}
                heroItem={heroItem}
                heroDetails={heroDetails}
                heroRotation={heroRotation}
                highlighted={highlighted}
                queue={queue}
                recentLive={recentLive}
                items={items}
                homeRows={homeRows}
                onRowsNeeded={requestHomeRows}
                favorites={favorites}
                firstHomeCatalog={firstHomeCatalog}
                navigate={navigate}
                openLibrary={(queueSegment) => { setLibraryQueue(queueSegment); void navigate("My List"); }}
                profile={activeProfile}
                onProfiles={responsive ? openHeaderSettings : openProfiles}
                discoverSources={discoverSources}
                detail={detail}
                manage={manage}
                toggle={toggle}
                shelfCards={shelfCards}
              />
            )}
            {["Discover", "My List", "Search"].includes(screen) && (
              <BrowseScreen
                screen={screen}
                responsive={responsive}
                phone={phone}
                query={query}
                setQuery={setQuery}
                searchKey={searchKey}
                items={items}
                searchRows={searchRows}
                navigate={navigate}
                catalogs={catalogs}
                catalog={catalog}
                catalogError={catalogError}
                busy={busy}
                catalogValues={catalogValues}
                loadCatalog={loadCatalog}
                setModal={setModal}
                setEntry={setEntry}
                libraryQueue={libraryQueue}
                setLibraryQueue={setLibraryQueue}
                queue={queue}
                nextSkip={nextSkip}
                searchPartial={searchPartial}
                cards={cards}
                profile={activeProfile}
                onProfiles={openHeaderSettings}
              />
            )}
            {/* Title family: the title page; under the Sources overlay the page it was opened from stays mounted. */}
            {(screen === "detail" || screen === "sources") && titleItem && (
              <DetailScreen
                responsive={responsive}
                phone={phone}
                api={api}
                selected={titleItem}
                presentation={titleItem === selected ? selectedPresentation : undefined}
                episodes={titleEpisodes}
                season={season}
                setSeason={setSeason}
                favorites={favorites}
                play={play}
                discoverSources={discoverSources}
                manage={manage}
                toggle={toggle}
                setModal={setModal}
                catalogs={catalogs}
                origin={detailOrigin}
                onGenre={(target) => void navigate("Discover", target.catalog, target.values)}
                onBack={back}
                sourcePreview={sourcePreview}
                previewSources={previewSources}
                backdrop={screen === "sources"}
              />
            )}
            {screen === "sources" && (
              <SourcesScreen
                responsive={responsive}
                phone={phone}
                selected={selected}
                sources={sources}
                producers={sourceProducers}
                desktop={isDesktopShell}
                sourceQuality={sourceQuality}
                sourceProvider={sourceProvider}
                providerPickerOpen={modal?.title === "Source provider"}
                setSourceQuality={setSourceQuality}
                setSourceProvider={setSourceProvider}
                busy={busy}
                preparing={preparing}
                playbackStage={playbackStage}
                openingSource={openingSource}
                play={play}
                setModal={setModal}
                onClose={back}
              />
            )}
            {screen === "Live TV" && (
              <LiveGuide
                key={profile}
                responsive={responsive}
                phone={phone}
                api={api}
                onPlay={(item) => void play(item)}
                onError={fail}
                onMenu={(item, details) => manage(item, details)}
              />
            )}
            {screen === "Settings" && (
              <Settings
                api={api}
                serverOrigin={api.serverOrigin}
                profile={profile}
                prefs={prefs}
                appearance={responsive ? { oled, toggle: toggleOled } : undefined}
                // The engine is a native (Tauri) setting; the dev-only desktop-shell preview shows it too.
                playbackEngine={platform === "tauri" || (responsive && desktopShellPreview) ? { choice: engineChoice, choices: engineChoices, select: selectEngine } : undefined}
                onPrefs={setPrefs}
                onProfiles={() => {
                  setManaging(false);
                  go("profiles");
                }}
                onManageProfiles={() => {
                  setManaging(true);
                  go("profiles");
                }}
                onError={fail}
                // Settings asks "Sign out of this device?" first; this is the confirmed action.
                onSignOut={() =>
                  void authorize(
                    "Enter parent PIN to sign out",
                    (signal) => api.signOut({ signal }),
                    () => {
                      setProfile("");
                      setProfiles([]);
                      setScreen("pairing");
                      void pairing();
                    },
                  )
                }
                subpage={settingsSubpage}
                onSubpageChange={setSettingsSubpage}
                onBack={back}
                list={responsive}
                onWatchOnTv={responsive ? openCast : undefined}
                profiles={profiles}
                onChooseProfile={(id) => void chooseProfile(id)}
              />
            )}
            {/* Player family: the controls follow `overlay`; buffering, notices and Up Next show without them. */}
            {screen === "player" && (
              <PlayerScreen
                desktop={isDesktopShell}
                responsive={responsive}
                overlay={overlay}
                dialogOpen={!!modal}
                selected={selected}
                busy={busy}
                snapshot={snapshot}
                playerNotice={playerNotice}
                seek={seek}
                setSeek={setSeek}
                setOverlay={setOverlay}
                commitSeek={commitSeek}
                seekBy={seekBy}
                togglePlayback={togglePlayback}
                toggleLiveMute={toggleLiveMute}
                fullscreenControl={fullscreenControl}
                pictureMode={pictureMode}
                setPictureMode={setPictureMode}
                player={player}
                fail={fail}
                nextEpisode={nextEpisode}
                stop={stop}
                trackChoices={trackChoices}
                activeTrackPopup={activeTrackPopup}
                setActiveTrackPopup={setActiveTrackPopup}
                playerInfoOpen={playerInfoOpen}
                setPlayerInfoOpen={setPlayerInfoOpen}
                audioTrackList={audioTrackList}
                textTrackList={textTrackList}
                subtitleOffOption={subtitleOffOption}
                playerInfoRows={app.playerInfoRows}
                seekPending={app.seekPending}
                upNext={app.upNext}
                playUpNext={app.playUpNext}
                cancelUpNext={app.cancelUpNext}
                readBufferedRanges={readBufferedRanges}
                lastControlActivity={lastControlActivity}
                setControlActivity={setControlActivity}
              />
            )}
          </>
        )}
      <AppDialogs app={app} />
      </div>
      </div>
    </RemoteRoot>
  );
}
