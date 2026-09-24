import { WindowResizeBorders } from "../WindowResizeBorders";
import { ResponsiveSignIn } from "../ResponsiveSignIn";
import { RemoteRoot, TvButton } from "../remote";
import { DesktopTitlebar, RemoteControlIcon } from "../DesktopTitlebar";
import { RokuText } from "../RokuText";
import { Settings } from "../Settings";
import { Guide as LiveGuide } from "../Guide";
import { ReadyImage } from "../RokuArtwork";
import { ProfileEditor, avatarUrl } from "../ProfileEditor";
import { HomeScreen } from "../../screens/HomeScreen";
import { BrowseScreen } from "../../screens/BrowseScreen";
import { DetailScreen } from "../../screens/DetailScreen";
import { SourcesScreen } from "../../screens/SourcesScreen";
import { PlayerScreen } from "../../screens/PlayerScreen";
import type { Screen } from "../screens";
import type { AppApi } from "./useTvApp";
import { isDesktopShell } from "./appShared";
import { AppDialogs } from "./AppDialogs";
import { enterLocalMode, localModeAvailable } from "../../local";
import { usePhoneLayout } from "../usePhoneLayout";
import { SearchPopunder } from "../SearchPopunder";
import { HomeSkeleton } from "../../screens/HomeSkeleton";
import { Bookmark, Compass, House, Search, Settings as SettingsIcon, Tv, type LucideIcon } from "lucide-react";
import "../tv.css";
import "../responsive.css";

/** Responsive navigation glyphs; the TV keeps its Roku PNG icon set. */
const responsiveNavIcons: Partial<Record<Screen, LucideIcon>> = {
  Home: House,
  Discover: Compass,
  "Live TV": Tv,
  "My List": Bookmark,
  Search,
  Settings: SettingsIcon,
};

/**
 * The application render tree: desktop frame, navigation, screens and
 * dialogs, all reading from the assembled app object.
 */
export function AppShell({ app }: { app: AppApi }) {
  const { active, activeTrackPopup, bootingHome, requestHomeRows, detailOrigin, api, audioTrackList, authorize, back, browser, busy, canvas, cards, casting, catalog, catalogError, catalogs, catalogValues, chooseProfile, closeCast, commitSeek, compactHome, detail, discoverSources, editingProfile, editProfile, engineChoice, entry, episodes, fail, favorites, firstHomeCatalog, fullscreenControl, go, heroItem, heroPresentation, highlighted, homeRows, isMaximized, items, lastControlActivity, layout, libraryQueue, loadCatalog, manage, managing, mediaKey, mediaKeyUp, modal, navigate, nextEpisode, nextSkip, oled, openCast, openingSource, overlay, pair, pairing, platform, play, player, playerInfoLines, playerInfoOpen, playerNotice, playerRoot, prefs, preparing, profile, profilePage, profiles, qr, query, queue, readBufferedRanges, recentLive, responsive, screen, searchKey, searchPartial, searchRows, season, seek, selected, selectedPresentation, selectEngine, setActiveTrackPopup, setCompactHome, setControlActivity, setEditingProfile, setEntry, setLibraryQueue, setManaging, setModal, setOverlay, setPlayerInfoOpen, setPrefs, setProfile, setProfilePage, setProfiles, setQuery, setScreen, setSeason, setSeek, setSettingsSubpage, setSourceProvider, setSourceQuality, settingsSubpage, shelfCards, snapshot, sourceFocusPending, sourceProvider, sourceQuality, sources, stop, subtitleOffOption, surfaceClick, textTrackList, toggle, toggleLiveMute, toggleOled, togglePlayback, trackChoices, video } = app;

  const activeProfile = profiles.find((p) => p.id === profile);
  const phone = usePhoneLayout(responsive);
  // While the session restores and Home first loads, the responsive shell
  // shows a skeleton of Home in place of the startup cover and screens.
  const booting = responsive && (bootingHome || screen === "startup");
  // Local addon mode is offered only in local-capable builds (LM-001); the
  // backend-hosted bundle renders no entry point.
  const localEntry = localModeAvailable ? () => {
    enterLocalMode();
    location.reload();
  } : undefined;
  const navItems: Screen[] = [
    ...(responsive ? [] : (["profiles"] as Screen[])),
    "Home",
    "Discover",
    "Live TV",
    "My List",
    "Search",
    "Settings",
  ];
  const brand = (<div
          className={`brand ${["profiles", "pairing"].includes(screen) ? "gateway-brand" : ""}`}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
            alt="viptv"
          />
        </div>);
  const navigation = (<nav aria-label="Main navigation">
                {navItems.map((n, i) => {
                  const Icon = responsive ? responsiveNavIcons[n] : undefined;
                  return (
                  <TvButton
                    id={`nav-${n}`}
                    aria-label={n === "profiles" ? "Profile" : n}
                    key={n}
                    className={`${n === screen ? "active" : ""} nav-${n.replace(/ /g, "-").toLowerCase()}`}
                    aria-current={n === screen ? "page" : undefined}
                    onActivate={() =>
                      n === "profiles"
                        ? setScreen("profiles")
                        : void navigate(n)
                    }
                  >
                    {!responsive && i === 0 && (
                      <span className="nav-initials">
                        {activeProfile?.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    {Icon ? (
                      <Icon className="nav-icon" size={24} strokeWidth={n === screen ? 2.25 : 1.75} aria-hidden="true" />
                    ) : (
                    <ReadyImage
                      className={`nav-icon ${!responsive && i === 0 ? "nav-avatar" : ""}`}
                      src={
                        !responsive && i === 0 && activeProfile
                          ? avatarUrl(activeProfile)
                          : `${import.meta.env.BASE_URL}assets/${[
                              ...(!responsive ? ["avatar-catalog/critters-1.png"] : []),
                              "ui-nav-home.png",
                              "ui-nav-discover.png",
                              "ui-nav-tv.png",
                              "ui-nav-list.png",
                              "ui-nav-search.png",
                              "ui-nav-settings.png",
                            ][i]}`
                      }
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                    )}
                    {!responsive && <em>{n === "profiles" ? "Profile" : n}</em>}
                  </TvButton>
                  );
                })}
              </nav>);


  return (
    <RemoteRoot
      inputMode={layout}
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
      onBack={() => casting ? closeCast() : screen === "player" && fullscreenControl.fullscreen && !modal && !entry && !editingProfile ? void fullscreenControl.exit() : back()}
      onMediaKey={mediaKey}
      onMediaKeyUp={mediaKeyUp}
      onNavigate={() => {
        setOverlay(true);
        sourceFocusPending.current = false;
      }}
    >
      <div className={`desktop-app-frame ${isDesktopShell ? "desktop-shell" : "browser-shell"} ${isMaximized ? "is-maximized" : ""} ${fullscreenControl.fullscreen ? "is-fullscreen" : ""}`}>
        {responsive && isDesktopShell && (
          <WindowResizeBorders disabled={fullscreenControl.fullscreen || isMaximized} />
        )}
        {responsive && isDesktopShell && !fullscreenControl.fullscreen && (
          <DesktopTitlebar
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
        <div
          ref={playerRoot}
          onPointerMove={() => { if (responsive && screen === "player" && Date.now() - lastControlActivity.current > 1000) { lastControlActivity.current = Date.now(); setOverlay(true); setControlActivity(value => value + 1); } }}
          onPointerDownCapture={(event) => { if (responsive && screen === "player" && (event.target as HTMLElement).closest("button, input")) { setOverlay(true); setControlActivity(value => value + 1); } }}
          className={`tv-screen ${responsive ? "responsive-app" : "tv-layout"} ${isMaximized ? "is-maximized" : ""} ${fullscreenControl.fullscreen ? "is-fullscreen" : ""} screen-${screen.replace(/ /g, "-").toLowerCase()} ${screen === "player" ? "playing" : ""}`}
        >
        <video
          ref={video}
          className="video"
          playsInline
          onClick={surfaceClick}
          onDoubleClick={responsive && screen === "player" ? () => void fullscreenControl.toggle() : undefined}
        />
        {responsive && screen === "player" && (busy || snapshot?.state === "buffering") && (
          <div className="player-buffering" role="status" aria-label="Loading video" />
        )}
        <canvas ref={canvas} className="video player-canvas" style={{ display: "none" }} onClick={surfaceClick} />
        {booting && <HomeSkeleton phone={phone} />}
        {responsive && !booting && !["startup", "pairing", "player", "profiles"].includes(screen) && (
          <aside className="desktop-sidebar" aria-label="Sidebar navigation">
            <div className="sidebar-centered-group">
              {navigation}
              {/* Phones have no header bar: Watch on TV lives in Settings. */}
              {!phone && <TvButton
                id="responsive-cast"
                aria-label="Watch on TV"
                className="sidebar-cast"
                onActivate={openCast}
              >
                <RemoteControlIcon />
              </TvButton>}
            </div>
            {/* The active profile anchors the bottom of the sidebar in the
                browser and Tauri layouts alike. */}
            {!phone && activeProfile && (
              <TvButton
                id="responsive-profile"
                className="sidebar-profile"
                aria-label={`Switch profile (${activeProfile.name})`}
                title={activeProfile.name}
                onActivate={() => setScreen("profiles")}
              >
                <span className="sidebar-profile-initials" aria-hidden="true">
                  {activeProfile.name.slice(0, 2).toUpperCase()}
                </span>
                <ReadyImage className="nav-avatar" src={avatarUrl(activeProfile)} alt="" />
              </TvButton>
            )}
          </aside>
        )}
        {!responsive && brand}

        {booting || screen === "startup" ? null : screen === "pairing" ? (
          responsive ? <ResponsiveSignIn api={api} pair={pair} qr={qr} onRetry={() => void pairing()} onUseWithoutAccount={localEntry} /> : <section className="pairing">
            <h1>Sign in to VIPTV</h1>
            <p>Visit this address, then enter the code shown below.</p>
            <h2>{pair?.verificationUri ?? "Connecting…"}</h2>
            <div className="pair-code">{pair?.userCode ?? "••••••"}</div>
            {qr && <img className="qr" src={qr} alt="Scan to link your TV" />}
            <TvButton id="retry" onActivate={() => void pairing()}>
              Try again
            </TvButton>
            {localEntry && <TvButton id="local-mode" onActivate={localEntry}>
              Use without an account
            </TvButton>}
          </section>
        ) : screen === "profiles" ? (
          <section className="profiles">
            <h1>{managing ? "Manage profiles" : "Who's watching?"}</h1>
            <div className="profile-row">
              {profiles
                .slice(profilePage * 5, profilePage * 5 + 5)
                .map((p, i) => (
                  <TvButton
                    id={`profile-${i}`}
                    key={p.id}
                    onActivate={() =>
                      managing ? editProfile(p) : void chooseProfile(p.id)
                    }
                    onHold={() => editProfile(p)}
                  >
                    <span className="profile-initials">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                    <ReadyImage src={avatarUrl(p)} alt="" />
                    <strong>
                      <RokuText>{p.name}</RokuText>
                    </strong>
                  </TvButton>
                ))}
            </div>
            <div className="profile-actions">
              <TvButton
                id="add-profile"
                disabled={profiles.length >= 12}
                onActivate={() => editProfile()}
              >
                Add profile
              </TvButton>
              <TvButton
                id="manage-profiles"
                onActivate={() => setManaging(!managing)}
              >
                {managing ? "Done" : "Manage profiles"}
              </TvButton>
            </div>
            {profiles.length > 5 && (
              <div className="profile-pager">
                <TvButton
                  id="profiles-previous"
                  disabled={profilePage === 0}
                  onActivate={() => setProfilePage((p) => p - 1)}
                >
                  Previous
                </TvButton>
                <span>
                  {profilePage + 1} / {Math.ceil(profiles.length / 5)}
                </span>
                <TvButton
                  id="profiles-next"
                  disabled={(profilePage + 1) * 5 >= profiles.length}
                  onActivate={() => setProfilePage((p) => p + 1)}
                >
                  Next
                </TvButton>
              </div>
            )}
          </section>
        ) : (
          <>
            {!responsive && !["detail", "sources", "player"].includes(screen) && navigation}
            {screen === "Home" && (
              <HomeScreen
                responsive={responsive}
                compactHome={compactHome}
                setCompactHome={setCompactHome}
                heroPresentation={heroPresentation}
                heroItem={heroItem}
                highlighted={highlighted}
                queue={queue}
                recentLive={recentLive}
                items={items}
                homeRows={homeRows}
                onRowsNeeded={requestHomeRows}
                favorites={favorites}
                firstHomeCatalog={firstHomeCatalog}
                navigate={navigate}
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
              />
            )}
            {screen === "detail" && selected && (
              <DetailScreen
                responsive={responsive}
                selected={selected}
                presentation={selectedPresentation}
                episodes={episodes}
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
              />
            )}
            {screen === "sources" && (
              <SourcesScreen
                selected={selected}
                sources={sources}
                sourceQuality={sourceQuality}
                sourceProvider={sourceProvider}
                setSourceQuality={setSourceQuality}
                setSourceProvider={setSourceProvider}
                busy={busy}
                preparing={preparing}
                openingSource={openingSource}
                play={play}
                setModal={setModal}
              />
            )}
            {screen === "Live TV" && (
              <LiveGuide
                responsive={responsive}
                phone={phone}
                api={api}
                onPlay={(item) => void play(item)}
                onError={fail}
                onDetails={(item, program) =>
                  setModal({
                    title: program
                      ? `${program.title} · ${program.description ?? ""}`
                      : "No guide information. You can still watch this channel.",
                    choices: [
                      {
                        label: "Watch channel now",
                        action: () => {
                          setModal(undefined);
                          void play(item);
                        },
                      },
                      { label: "Close", action: () => setModal(undefined) },
                    ],
                  })
                }
              />
            )}
            {screen === "Settings" && (
              <Settings
                api={api}
                serverOrigin={api.serverOrigin}
                profile={profile}
                prefs={prefs}
                appearance={responsive ? { oled, toggle: toggleOled } : undefined}

                playbackEngine={platform === "tauri" ? { choice: engineChoice, select: selectEngine } : undefined}
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
                onModal={(title, choices) =>
                  setModal(choices.length ? { title, choices } : undefined)
                }
                onSignOut={() =>
                  setModal({
                    title: responsive ? "Sign out of this device?" : "Sign out of this TV?",
                    choices: [
                      {
                        label: "Sign out",
                        action: () => {
                          setModal(undefined);
                          void authorize(
                            "Enter parent PIN to sign out",
                            (signal) => api.signOut({ signal }),
                            () => {
                              setProfile("");
                              setProfiles([]);
                              setScreen("pairing");
                              void pairing();
                            },
                          );
                        },
                      },
                      { label: "Cancel", action: () => setModal(undefined) },
                    ],
                  })
                }
                subpage={settingsSubpage}
                onSubpageChange={setSettingsSubpage}
                onBack={back}
                list={responsive}
                onWatchOnTv={phone ? openCast : undefined}
              />
            )}
            {screen === "player" && overlay && (
              <PlayerScreen
                responsive={responsive}
                selected={selected}
                busy={busy}
                snapshot={snapshot}
                playerNotice={playerNotice}
                seek={seek}
                setSeek={setSeek}
                setOverlay={setOverlay}
                commitSeek={commitSeek}
                togglePlayback={togglePlayback}
                toggleLiveMute={toggleLiveMute}
                fullscreenControl={fullscreenControl}
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
                playerInfoLines={playerInfoLines}
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
