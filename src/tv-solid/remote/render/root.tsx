/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { TvView } from "../../runtime";
import { HeroArtwork } from "../CoherentHero";
import { TopNavigation } from "../TopNavigation";
import { SettingsView } from "../SettingsView";
import { AppOverlays, IdleSaver } from "./overlays";
import { BrowseScreen } from "./browse";
import { CalendarView } from "./calendar";
import { DetailView } from "./detail";
import { EntryScreensView } from "./entry";
import { HomeView } from "./home";
import { LiveScreen } from "./live";
import { PlayerChrome } from "./player";
import { ProfilesView } from "./profiles";

/** Everything the screen draws with.
 *
 * This is a projection, not a decision: each field is built by the shell and the
 * scenes in `App.tsx`, and this module only arranges them. Listing every field
 * (rather than indexing a bag) is what makes a forgotten value a compile error
 * instead of an `undefined` at runtime.
 */
export interface AppView {
  screen: any; screenSaver: any; profileEditor: any; overlay: any; zone: any;
  heroPresentation: any; heroLogoBox: any; navs: any; column: any; management: any; api: any;
  fontsReady: any; loading: any; error: any; pairing: any; qr: any; pairingDeadline: any;
  pairingFocused: any; signedIn: any; finishSignIn: any; available: any; canManageProfiles: any;
  calendar: any; calendarDaysList: any; calendarDay: any; calendarEntry: any;
  home: any; hero: any; displayHero: any; row: any; heroAction: any; displayedFeatured: any;
  heroCycle: any; shelfTitleY: any; homeRowFocus: any; isSaved: any; heroSlide: any; palette: any;
  detailForDisplay: any; detailHasEpisodes: any; detailEpisodes: any; seasonIndex: any;
  detailColumn: any; detailActionLabel: any; detailPlayProgress: any;
  key: any; search: any; searchCapabilities: any; searchResults: any; searchError: any;
  library: any; libraryType: any; librarySort: any; libraryFilters: any; catalog: any; page: any;
  gridStart: any; gridCount: any; gridColumns: any; gridOffset: any; searchMediaPending: any;
  searchNeedsRetry: any; searchRowIndex: any; searchMediaFocus: any; searchRowPositions: any;
  searchChannels: any; edgeRequest: any; searchChannelPages: any; searchChannelFocus: any;
  searchChannelsPending: any; searchChannelPaging: any; searchChannelError: any;
  liveSpread: any; liveViewer: any; liveEmptyFocus: any; livePages: any; liveRecovery: any;
  liveFailure: any; channels: any; liveChannelIndex: any; currentProgram: any; groups: any;
  liveGroup: any; programs: any; guideRowStart: any; guideStart: any; guideWindow: any;
  settingsTabs: any; settingsTab: any; settingsItems: any;
  advancing: any; openingSource: any; showControls: any; seeking: any; snapshot: any;
  skipStage: any; activeSegment: any; activeAction: any; playerActions: any; playerTools: any;
  choice: any; timelineFocused: any; seek: any;
  overlayEntered: any; overlayClosing: any; reportOverlaySettled: any;
  sourceLoading: any; pickerCard: any; sources: any; visibleSources: any; sourcePage: any;
  sourceAddonCount: any; sourceMenu: any; sourceMenuOptions: any; sourceMenuChoice: any;
  picker: any; sourceProviderFilter: any; sourceActions: any; sourceActionChoice: any;
  focusedSource: any; sourceFilterFocus: any; sourceFacet: any; sourceSpread: any;
  sourceQualityValue: any; sourceProviderValue: any; failedSources: any;
  trackColumn: any; text: any; keyboard: any; episodeState: any; countdownState: any;
  calibrationValue: any; notice: any; pending: any;
}

export function RootScreen(props: { view: AppView }) {
  const {
    screen, screenSaver, profileEditor, overlay, zone, heroPresentation, heroLogoBox, navs, column,
    management, api, fontsReady, loading, error, pairing, qr, pairingDeadline, pairingFocused,
    signedIn, finishSignIn, available, canManageProfiles, calendar, calendarDaysList, calendarDay,
    calendarEntry, home, hero, displayHero, row, heroAction, displayedFeatured, heroCycle,
    shelfTitleY, homeRowFocus, isSaved, heroSlide, palette, detailForDisplay, detailHasEpisodes,
    detailEpisodes, seasonIndex, detailColumn, detailActionLabel, detailPlayProgress, key, search,
    searchCapabilities, searchResults, searchError, library, libraryType, librarySort, libraryFilters,
    catalog, page, gridStart, gridCount, gridColumns, gridOffset, searchMediaPending, searchNeedsRetry,
    searchRowIndex, searchMediaFocus, searchRowPositions, searchChannels, edgeRequest,
    searchChannelPages, searchChannelFocus, searchChannelsPending, searchChannelPaging,
    searchChannelError, liveSpread, liveViewer, liveEmptyFocus, livePages, liveRecovery, liveFailure,
    channels, liveChannelIndex, currentProgram, groups, liveGroup, programs, guideRowStart, guideStart,
    guideWindow, settingsTabs, settingsTab, settingsItems, advancing, openingSource, showControls,
    seeking, snapshot, skipStage, activeSegment, activeAction, playerActions, playerTools, choice,
    timelineFocused, seek, overlayEntered, overlayClosing, reportOverlaySettled, sourceLoading,
    pickerCard, sources, visibleSources, sourcePage, sourceAddonCount, sourceMenu, sourceMenuOptions,
    sourceMenuChoice, picker, sourceProviderFilter, sourceActions, sourceActionChoice, focusedSource,
    sourceFilterFocus, sourceFacet, sourceSpread, sourceQualityValue, sourceProviderValue, failedSources,
    trackColumn, text, keyboard, episodeState, countdownState, calibrationValue, notice, pending,
  } = props.view;
  return (
    <>
      <TvView
        w={1920}
        h={1080}
        color={["player", "home", "detail"].includes(screen()) ? "rgba(0,0,0,0)" : palette.bg}
      >
        <TvView w={1920} h={1080} show={!screenSaver()}>
          <TvView w={1920} h={1080} show={!profileEditor() && overlay()?.kind !== "text"}>
            {/* The player is a native SceneGraph Video plane under the app's
                native text/visual layers. Hide the page behind it so stale
                artwork cannot cover the video. */}
            <TvView w={1920} h={1080} show={screen() !== "player" && !screenSaver()}>
              <HeroArtwork presentation={heroPresentation}
                logoBox={heroLogoBox()}
                dim={screen() === "detail" && ["episodes", "seasons", "recommendations"].includes(zone())
                  ? typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined" ? .35 : .5 : 0} />
              <Show when={!["welcome", "pairing", "signed-in", "profiles", "player", "settings"].includes(screen()) &&
                screen() !== "detail"}>
                <TopNavigation items={navs()} screen={screen()} selected={zone() === "nav" ? column() : undefined}
                  profile={management()?.profiles.find((profile: any) => profile.id === api.profile)} fontReady={fontsReady()} />
              </Show>
              <EntryScreensView screen={screen()} entry={{ loading: loading(), focused: !loading() && !error() }}
                pairing={pairing()} pairingQr={qr()} pairingDeadline={pairingDeadline()}
                pairingFocused={pairingFocused() && !loading() && !error()}
                signedIn={signedIn()} onSignedIn={finishSignIn} />
              <ProfilesView screen={screen()} profiles={{ profiles: management()?.profiles ?? [],
                create: available(management()?.capabilities.create), manage: canManageProfiles(),
                index: column(), zone: zone(), loading: loading() }} />
              <CalendarView screen={screen()} board={{ entries: calendar()?.entries ?? [], days: calendarDaysList(),
                day: calendarDay(), active: calendarEntry(), dayFocused: zone() === "calendar-days",
                listFocused: zone() === "calendar-list", watchFocused: zone() === "calendar-watch",
                loading: loading(), error: error() }} />
              <HomeView screen={screen()} content={{ home: home(), hasHero: !!hero(),
                presentation: { card: displayHero, mode: heroPresentation.mode },
                focus: { zone, row, column, action: heroAction },
                billboard: { slide: () => Math.max(0, displayedFeatured()), started: heroCycle.started,
                  active: () => heroCycle.active() && heroCycle.animated() },
                shelfTop: shelfTitleY(), columnForRow: (shelf: any) => homeRowFocus.resolve(shelf), isSaved }} />
              <DetailView screen={screen()} content={{ detail: detailForDisplay(),
                hasEpisodes: detailHasEpisodes(), episodes: detailEpisodes(), zone: zone(), column: column(),
                heroAction: heroAction(), seasonIndex: seasonIndex(), episodeColumn: detailColumn("episodes"),
                recommendationColumn: detailColumn("recommendations"), actionLabel: detailActionLabel(),
                progress: detailPlayProgress(),
                saved: !!detailForDisplay() && isSaved(detailForDisplay()!.item) }} />
              <BrowseScreen screen={screen()} zone={zone} column={column} key={key} search={search}
                searchCapabilities={searchCapabilities()} searchResults={searchResults()} searchError={searchError}
                library={library()} libraryType={libraryType()} librarySort={librarySort()} libraryFilters={libraryFilters()}
                catalog={catalog()} page={page()} loading={loading}
                grid={{ start: gridStart, count: gridCount, columns: gridColumns, offset: gridOffset }}
                gridFocus={{ active: () => zone() === "content", index: column }}
                gridSearch={{ channels: () => searchCapabilities().channels, pending: searchMediaPending, retry: searchNeedsRetry, query: search }}
                searchRowIndex={searchRowIndex()} searchMediaFocus={searchMediaFocus} searchMediaPending={searchMediaPending}
                searchNeedsRetry={searchNeedsRetry}
                searchRemembered={(id: string) => searchRowPositions.resolve(searchResults().rows.find((shelf: any) => shelf.id === id))}
                searchChannels={searchChannels()} hasPreviousChannelPage={!!edgeRequest(searchChannelPages(), "previous")}
                searchChannelFocus={searchChannelFocus}
                searchChannelsPending={searchChannelsPending()} searchChannelPaging={searchChannelPaging()}
                searchChannelError={searchChannelError()} />
              <Show when={screen() === "live"}>
                <LiveScreen spread={liveSpread()} viewer={liveViewer()} emptyFocus={liveEmptyFocus()}
                  pages={livePages()} recovery={liveRecovery()} failure={liveFailure()}
                  channels={channels()} channelIndex={liveChannelIndex()} program={currentProgram()}
                  groups={groups()} group={liveGroup()} zone={zone()} column={column} programs={programs()}
                  guideRowStart={guideRowStart()} guideStart={guideStart()} guideNow={guideWindow().now} />
              </Show>
              <Show when={screen() === "settings"}>
                <SettingsView tabs={settingsTabs} tab={settingsTab()} items={settingsItems()}
                  zone={zone()} column={column()} loading={loading()} />
              </Show>
            </TvView>
            <PlayerChrome screen={screen()} overlay={!!overlay()} advancing={advancing()}
              openingSource={!!openingSource()} showControls={showControls()} loading={loading()}
              seeking={seeking()} buffering={snapshot()?.state === "buffering"} skipStage={skipStage()}
              segment={activeSegment()} snapshot={snapshot} action={activeAction()} canSeek={() => playerActions().seek}
              tools={playerTools} choice={choice} timelineFocused={timelineFocused} preview={seek} />
          </TvView>
          <AppOverlays screen={screen()} openingSource={!!openingSource()} overlay={overlay()}
            entered={overlayEntered()} closing={overlayClosing()} settled={reportOverlaySettled}
            sourceLoading={sourceLoading()} pickerCard={pickerCard()} sources={sources()} visibleSources={visibleSources()}
            sourcePage={sourcePage()} sourceAddonCount={sourceAddonCount()} sourceMenu={sourceMenu()}
            sourceMenuOptions={sourceMenuOptions()} sourceMenuChoice={sourceMenuChoice()} sourceHeight={picker.height()}
            sourceProviderFilter={sourceProviderFilter()} sourceActions={sourceActions()} sourceActionChoice={sourceActionChoice()}
            focusedSource={focusedSource()} sourceFilterFocus={sourceFilterFocus()} sourceFacet={sourceFacet()}
            sourceFailure={picker.failure()} sourceSpread={sourceSpread()} sourceQualityValue={sourceQualityValue()}
            sourceProviderValue={sourceProviderValue()} failedSources={failedSources()} choice={choice()}
            profileEditor={profileEditor()} management={management()} trackColumn={trackColumn()} text={text()}
            keyboard={keyboard} activeAction={activeAction()} episode={episodeState().item} countdown={countdownState()}
            calibration={calibrationValue()} error={error()} notice={notice()} pending={pending()}
            paletteBg={palette.bg} />
        </TvView>
        <IdleSaver active={screenSaver()} featured={home()?.featured} slide={heroSlide()} />
      </TvView>
    </>
  );
}
