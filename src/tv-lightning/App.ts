import Blits from "@lightningjs/blits";
import QRCode from "qrcode";
import type { TvApi, DevicePairing, TvProfile, MediaItem, MediaSource, Catalog, Guide, LiveCategory, JsonObject, PlaybackPreferences } from "../api";
import packageInfo from "../../package.json";
import { tokens } from "../theme/viptv-tokens.generated";
import { ProfileTile, ManageProfilesButton, addProfileTile, emptyProfileTile, profileTileData } from "./ProfileTile";
import { emptyHome, enrichHomeHero, loadHomeView, queueHomeCards, type HomeView } from "./homeModel";
import { railIcon } from "./railIcons";
import { RailItem } from "./RailFocus";
import { DiscoverFilterOption } from "./DiscoverFocus";
import { DiscoverScreen } from "./DiscoverScreen";
import { LibraryScreen } from "./LibraryScreen";
import { libraryCard } from "./libraryModel";
import { TitleMenuScreen } from "./TitleMenuScreen";
import { emptyTitleMenuChoice, titleMenuChoice, titleMenuChoices, type TitleMenuChoiceView } from "./titleMenuModel";
import { SearchScreen } from "./SearchScreen";
import { projectSearch, searchKeys, type SearchCardView, type SearchHeadingView, type SearchRow } from "./searchModel";
import { LiveScreen } from "./LiveScreen";
import { LiveSearchScreen } from "./LiveSearchScreen";
import { liveSearchKeys } from "./liveSearchModel";
import { LiveDetailsScreen } from "./LiveDetailsScreen";
import { SettingsScreen, type SettingsScreenView, type SettingsPanelView } from "./SettingsScreen";
import type { SettingsDialogView } from "./SettingsDialogScreen";
import { defaultSettingsPreferences, emptySettingsChoice, emptySettingsProfile, emptySettingsRow, settingsChoices, settingsProfiles, settingsRows, type SettingsChoiceView, type SettingsPage, type SettingsRowView } from "./settingsModel";
import { emptyLiveHero, liveFilters, projectLiveGuide, type LiveChannelView, type LiveFilterView, type LiveHeroView, type LiveProgramView } from "./liveModel";
import { DAY_SECONDS, HOUR_SECONDS, PAGE_SIZE, WINDOW_SECONDS, guideZone, halfHour, timeRange } from "../ui/guide-core";
import { cardPresentation } from "../core/presentations";
import {
  catalogDefaults, catalogFilters, catalogForGroup, catalogsForGroup, discoverCard,
  discoverChips, discoverTypeGroup, emptyDiscoverCard, emptyDiscoverChip,
  initialCatalog, requestForCatalog, sameCatalog, type DiscoverCardView, type DiscoverChipView,
} from "./discoverModel";
import { HomeAction, HomeCard } from "./HomeFocus";
import { emptyHomeCard } from "./homeModel";
import { emptyDetail, emptyDetailEpisode, loadDetailView, type DetailView } from "./detailModel";
import { TitleAction, EpisodeTile } from "./TitleFocus";
import { emptySources, emptySourceRow, projectSources, type SourcesView } from "./sourceModel";
import { SourceChip, SourceProvider, SourceRow, ProviderOption, SourceDetailsClose, emptySourceChip, emptyProviderChoice } from "./SourceFocus";
import { noteDiscoverFilter, noteDiscoverWindow, noteFocus, noteLibraryState, noteLiveState, notePlayerState, noteSearchState, noteSourceFilter, noteSourceIntent, noteSourceWindow, noteTitleMenu, noteTrackPanel, noteTrackSelection } from "./focusDebug";
import type { LightningPlaybackRuntime } from "./playbackRuntime";
import { PlayerControl, PlayerTimeline, PlayerTrackOption } from "./PlayerFocus";
import type { PlayerSnapshot } from "@viptv/video";
import { emptyTrackChoice, trackChoicesFor, type TrackChoiceView } from "./trackModel";
import { exactResumeSource } from "../ui/continuation";

type TvPlatform = "tizen" | "vizio" | "webos";
const px = (name: keyof typeof tokens) => Number.parseFloat(String(tokens[name]));
// Lightning's web-font texture is wider than the DOM glyph run at the same
// nominal size. This measured renderer adjustment keeps the code inside the
// current TV card while the full pixel-parity pass remains open.
const pairCodeSize = Number.parseFloat(tokens["type.tv.pair-code"].fontSize) * (80 / 88);

function gatewayGlow(height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  // CSS reference: radial-gradient(closest-side, wash, transparent) on the
  // gateway pseudo-element (800 high pairing, 700 high profiles).
  context.translate(700, height / 2);
  context.scale(700, height / 2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, tokens["color.fill.wash"]);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  return canvas.toDataURL("image/png");
}

function homeScrim() {
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d")!;
  // The React TV Home masks the sharp art in from the left and fades it
  // beneath the shelf. This texture is rendered by Lightning over that art.
  const ground = tokens["color.bg"];
  const transparentGround = `rgba(${Number.parseInt(ground.slice(1, 3), 16)},${Number.parseInt(ground.slice(3, 5), 16)},${Number.parseInt(ground.slice(5, 7), 16)},0)`;
  const left = context.createLinearGradient(1120, 0, 1500, 0);
  left.addColorStop(0, ground);
  left.addColorStop(1, transparentGround);
  context.fillStyle = left;
  context.fillRect(1120, 0, 380, 720);
  const bottom = context.createLinearGradient(0, 550, 0, 950);
  bottom.addColorStop(0, transparentGround);
  bottom.addColorStop(1, ground);
  context.fillStyle = bottom;
  context.fillRect(0, 550, 1920, 530);
  return canvas.toDataURL("image/png");
}

function menuGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 520;
  canvas.height = 1;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 520, 0);
  gradient.addColorStop(0, tokens["color.bg"]);
  gradient.addColorStop(0.62, tokens["color.bg"]);
  gradient.addColorStop(1, "rgba(11,11,12,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 520, 1);
  return canvas.toDataURL("image/png");
}

const searchMeasure = document.createElement("canvas").getContext("2d")!;
function searchCaretPosition(query: string) {
  searchMeasure.font = "600 34px Onest600";
  return Math.min(718, 218 + Math.ceil(searchMeasure.measureText(query).width) + 4);
}

const playerClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Native 1920×1080 positions from the pinned TvPairing reference. */
const pairingFrame = {
  brandX: px("layout.tv.safe-x"),
  brandY: px("layout.tv.safe-y"),
  bodyX: px("layout.tv.safe-x") * 2,
  bodyY: 250,
  qrX: 1368,
  qrY: 270,
  qrSize: 360,
  codeY: 470,
  actionY: 641,
} as const;

/**
 * Staged Lightning renderer for the first TV sign-in slice. The existing TV
 * launcher remains on React until every screen and interaction is qualified.
 * The API and Rust session driver are shared; only rendering/input differ.
 */
export function createLightningTvApp(api: TvApi, platform: TvPlatform) {
  let pairingGeneration = 0;
  let pairingTimer: ReturnType<typeof setTimeout> | undefined;
  let pairingScope: ReturnType<TvApi["createScope"]> | undefined;
  let homeGeneration = 0;
  let homeScope: ReturnType<TvApi["createScope"]> | undefined;
  let detailGeneration = 0;
  let detailScope: ReturnType<TvApi["createScope"]> | undefined;
  let discoverGeneration = 0;
  let discoverScope: ReturnType<TvApi["createScope"]> | undefined;
  let discoverRequestedPage = "";
  let libraryGeneration = 0;
  let libraryScope: ReturnType<TvApi["createScope"]> | undefined;
  let libraryRequestedPage = "";
  let searchGeneration = 0;
  let searchScope: ReturnType<TvApi["createScope"]> | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let liveGeneration = 0;
  let liveScope: ReturnType<TvApi["createScope"]> | undefined;
  let liveClockTimer: ReturnType<typeof setInterval> | undefined;
  let liveCanonicalChannels: MediaItem[] = [];
  let liveCanonicalRows: LiveChannelView[] = [];
  let liveCanonicalPrograms: LiveProgramView[] = [];
  let liveCanonicalFilters: LiveFilterView[] = [];
  let liveFocusGeneration = 0;
  let liveSearchCanonicalQuery = "";
  let liveSearchPhysicalListener: ((event: KeyboardEvent) => void) | null = null;
  let settingsCanonicalRows: SettingsRowView[] = [];
  let settingsCanonicalChoices: SettingsChoiceView[] = [];
  let settingsGeneration = 0;
  let settingsScope: ReturnType<TvApi["createScope"]> | undefined;
  let sourceGeneration = 0;
  let sourceScope: ReturnType<TvApi["createScope"]> | undefined;
  let sourceTimer: ReturnType<typeof setTimeout> | undefined;
  let playback: LightningPlaybackRuntime | undefined;
  let playbackGeneration = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let chromeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeSession: (() => void) | undefined;
  return Blits.Application({
    components: { ProfileTile, ManageProfilesButton, HomeAction, HomeCard, RailItem, DiscoverScreen, LibraryScreen, SearchScreen, LiveScreen, LiveSearchScreen, LiveDetailsScreen, SettingsScreen, TitleMenuScreen, DiscoverFilterOption, TitleAction, EpisodeTile, SourceChip, SourceProvider, SourceRow, ProviderOption, SourceDetailsClose, PlayerControl, PlayerTimeline, PlayerTrackOption },
    template: `
      <Element w="1920" h="1080" :color="$phase === 'player' || $phase === 'playerTracks' || $phase === 'preparing' ? 'rgba(0,0,0,0)' : $background">
        <Element x="260" y="86" w="1400" h="800" src="$pairingGlow" :show="$phase === 'pairing' || $phase === 'expired' || $phase === 'error'" />
        <Element x="260" y="82" w="1400" h="700" src="$profilesGlow" :show="$phase === 'profiles'" />
        <Element :show="$phase === 'pairing' || $phase === 'expired' || $phase === 'error'">
          <Element x="$brandX" y="$brandY" w="52" h="52" rounded="12" color="$accent" />
          <Text x="107" y="59" :content="$markLabel" font="Bricolage800" size="36" color="$onAccent" />
          <Text x="166" y="56" :content="$brandLabel" font="Bricolage800" size="40" color="$primary" />
          <Text x="$bodyX" y="$bodyY" :content="$titleLabel" font="Bricolage700" size="56" color="$primary" />
          <Text x="$bodyX" y="342" :content="$introLabel" font="Onest" size="26" color="$body" />
          <Text x="$bodyX" y="402" :content="$address" font="Onest600" size="32" color="$primary" />
          <Element x="$bodyX" y="$codeY" w="636" h="124" rounded="24" color="$field" />
          <Text x="226" y="487" :content="$code" font="Bricolage800" size="$codeSize" letterspacing="$codeLetterSpacing" :color="$phase === 'expired' ? $tertiary : $primary" />
          <Element x="226" y="537" w="560" h="2" :show="$phase === 'expired'" color="$tertiary" />
          <Text x="$bodyX" y="658" :show="$phase === 'expired'" :content="$expiredLabel" font="Onest" size="26" color="$primary" />
          <Text x="$bodyX" y="658" :show="$phase === 'error'" :content="$error" font="Onest" size="26" color="$primary" maxwidth="900" />
          <Element x="182" :y="$phase === 'expired' || $phase === 'error' ? $actionY + 110 : $actionY" w="248" h="84" rounded="42" color="$white" />
          <Element x="186" :y="$phase === 'expired' || $phase === 'error' ? 755 : 645" w="240" h="76" rounded="38" color="$primary" />
          <Text x="224" :y="$phase === 'expired' || $phase === 'error' ? 770 : 660" :content="$retryIcon" font="Onest" size="28" color="$onLight" />
          <Text x="263" :y="$phase === 'expired' || $phase === 'error' ? 771 : 661" :content="$retryLabel" font="Onest700" size="26" color="$onLight" />
          <Element x="$qrX" y="$qrY" w="$qrSize" h="$qrSize" rounded="28" :color="$qr ? $white : $field" :alpha="$phase === 'expired' ? 0.18 : 1" />
          <Element x="1392" y="294" w="312" h="312" :show="$qr !== ''" :src="$qr" :alpha="$phase === 'expired' ? 0.18 : 1" />
          <Element x="1557" y="995" w="45" h="31" rounded="8" color="$keyBorder" />
          <Element x="1559" y="997" w="41" h="27" rounded="6" color="$background" />
          <Text x="1568" y="1000" :content="$okLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1616" y="999" :content="$selectLabel" font="Onest" size="20" color="$body" />
          <Element x="1709" y="995" w="52" h="31" rounded="8" color="$keyBorder" />
          <Element x="1711" y="997" w="48" h="27" rounded="6" color="$background" />
          <Text x="1718" y="1000" :content="$moveIcon" font="Onest" size="16" color="$primary" />
          <Text x="1770" y="999" :content="$moveLabel" font="Onest" size="20" color="$body" />
        </Element>
        <Text x="96" y="54" :show="$phase === 'starting'" :content="$startingLabel" font="Onest" size="28" color="$primary" />
        <Element :show="$phase === 'profiles'">
          <Text x="96" y="56" :content="$profilesWordmark" font="Bricolage800" size="40" color="$primary" />
          <Text x="0" y="230" maxwidth="1920" align="center" :content="$profilesLabel" font="Bricolage700" size="64" color="$primary" />
          <ProfileTile ref="profile0" position="0" :tile="$profileSlots[0]" :x="$profileStartX" :managing="$managing" />
          <ProfileTile ref="profile1" position="1" :tile="$profileSlots[1]" :x="$profileStartX + 284" :managing="$managing" />
          <ProfileTile ref="profile2" position="2" :tile="$profileSlots[2]" :x="$profileStartX + 568" :managing="$managing" />
          <ProfileTile ref="profile3" position="3" :tile="$profileSlots[3]" :x="$profileStartX + 852" :managing="$managing" />
          <ProfileTile ref="profile4" position="4" :tile="$profileSlots[4]" :x="$profileStartX + 1136" :managing="$managing" />
          <ProfileTile ref="profile5" position="5" :tile="$profileSlots[5]" :x="$profileStartX + 1420" :managing="$managing" />
          <ManageProfilesButton ref="manageProfiles" :managing="$managing" />
          <Text x="600" y="852" maxwidth="720" align="center" :content="$profileError" font="Onest" size="22" color="$danger" />
          <Element x="1557" y="995" w="45" h="31" rounded="8" color="$keyBorder" />
          <Element x="1559" y="997" w="41" h="27" rounded="6" color="$background" />
          <Text x="1568" y="1000" :content="$okLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1616" y="999" :content="$selectLabel" font="Onest" size="20" color="$body" />
          <Element x="1709" y="995" w="52" h="31" rounded="8" color="$keyBorder" />
          <Element x="1711" y="997" w="48" h="27" rounded="6" color="$background" />
          <Text x="1718" y="1000" :content="$moveIcon" font="Onest" size="16" color="$primary" />
          <Text x="1770" y="999" :content="$moveLabel" font="Onest" size="20" color="$body" />
        </Element>
        <Element :show="$phase === 'home' || ($sourceReturnOrigin === 'home' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))">
          <Element x="1120" y="0" w="800" h="720" :src="$home.heroImage" :show="$home.heroImage !== ''" />
          <Element w="1920" h="1080" src="$homeScrim" />
          <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
          <Element x="50" y="60" w="44" h="44" rounded="22" :src="$homeProfileAvatar" :show="$homeProfileAvatar !== ''" />
          <Element x="60" y="202" w="24" h="24" :src="$railSearch" />
          <Element x="40" y="262" w="64" h="64" rounded="32" color="$surface" />
          <Element x="60" y="282" w="24" h="24" :src="$railHome" />
          <Element x="60" y="360" w="24" h="24" :src="$railDiscover" />
          <Element x="60" y="440" w="24" h="24" :src="$railLive" />
          <Element x="60" y="516" w="24" h="24" :src="$railList" />
          <Element x="60" y="978" w="24" h="24" :src="$railSettings" />
          <Text x="192" y="150" :content="$home.eyebrow" font="Onest700" size="20" color="$secondary" />
          <Element x="192" y="196" w="410" h="118" fit="contain" :src="$home.titleLogo" :show="$home.titleLogo !== ''" />
          <Text x="192" y="196" maxwidth="760" :content="$home.title" font="Bricolage700" size="56" color="$primary" :show="$home.titleLogo === ''" />
          <Text x="192" y="340" :content="$home.episodeLabel" font="Onest600" size="24" color="$primary" />
          <Element x="431" y="349" w="180" h="6" color="$secondary" :show="$home.progress > 0" />
          <Element x="431" y="349" :w="Math.max(0, Math.min(180, $home.progress * 180))" h="6" color="$accent" :show="$home.progress > 0" />
          <Text x="630" y="339" :content="$home.progressText" font="Onest" size="24" color="$secondary" />
          <Text x="192" y="390" :content="$home.meta" font="Onest" size="22" color="$secondary" />
          <Text x="192" y="448" maxwidth="760" maxlines="2" :content="$home.synopsis" font="Onest" size="26" color="$body" />
          <HomeAction ref="heroAction0" position="0" action="play" :label="$home.playLabel" icon="▶" x="182" y="544" buttonWidth="228" buttonHeight="84" round="false" holdable="true" />
          <HomeAction ref="heroAction1" position="1" action="details" label="Details" icon="" x="420" y="550" buttonWidth="156" buttonHeight="72" round="false" holdable="false" />
          <HomeAction ref="heroAction2" position="2" action="save" :label="$homeAddLabel" :icon="$homeAddLabel" x="594" y="550" buttonWidth="72" buttonHeight="72" round="true" holdable="false" />
          <Text x="192" y="700" :content="$homeShelfLabel" font="Bricolage700" size="32" color="$primary" />
          <HomeCard ref="homeCard0" position="0" :card="$homeCards[0]" x="192" y="757" />
          <HomeCard ref="homeCard1" position="1" :card="$homeCards[1]" x="548" y="757" />
          <HomeCard ref="homeCard2" position="2" :card="$homeCards[2]" x="904" y="757" />
          <HomeCard ref="homeCard3" position="3" :card="$homeCards[3]" x="1260" y="757" />
          <HomeCard ref="homeCard4" position="4" :card="$homeCards[4]" x="1616" y="757" />
          <HomeCard ref="homeCard5" position="5" :card="$homeCards[5]" x="1972" y="757" />
          <Text x="700" y="110" maxwidth="520" align="center" :content="$homeNotice" font="Onest" size="22" color="$primary" />
          <Element x="1508" y="54" w="310" h="48" rounded="24" color="$noticeGlass" />
          <Element x="1530" y="62" w="45" h="31" rounded="8" color="$keyBorder" />
          <Element x="1532" y="64" w="41" h="27" rounded="6" color="$background" />
          <Text x="1541" y="67" :content="$okLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1586" y="66" :content="$selectLabel" font="Onest" size="20" color="$body" />
          <Element x="1680" y="62" w="40" h="31" rounded="8" color="$keyBorder" />
          <Element x="1682" y="64" w="36" h="27" rounded="6" color="$background" />
          <Text x="1693" y="65" :content="$optionsIcon" font="Onest" size="19" color="$primary" />
          <Text x="1730" y="66" :content="$optionsLabel" font="Onest" size="20" color="$body" />
        </Element>
        <DiscoverScreen ref="discoverScreen" :show="$phase === 'discover' || ($sourceReturnOrigin === 'discover' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))" :homeProfileAvatar="$homeProfileAvatar" :railSearch="$railSearch" :railHome="$railHome" :railDiscoverSelected="$railDiscoverSelected" :railLive="$railLive" :railList="$railList" :railSettings="$railSettings" :surface="$surface" :discoverHeading="$discoverHeading" :discoverChips="$discoverChips" :discoverCards="$discoverCards" :discoverWindowStart="$discoverWindowStart" :discoverError="$discoverError" :discoverOkLabel="$discoverOkLabel" :discoverSelectLabel="$discoverSelectLabel" :discoverOptionsIcon="$discoverOptionsIcon" :discoverOptionsLabel="$discoverOptionsLabel" :background="$background" :primary="$primary" :body="$body" :keyBorder="$keyBorder" />
        <LibraryScreen ref="libraryScreen" :show="$phase === 'library' || ($sourceReturnOrigin === 'library' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))" :homeProfileAvatar="$homeProfileAvatar" :railSearch="$railSearch" :railHomeUnselected="$railHomeUnselected" :railDiscover="$railDiscover" :railLive="$railLive" :railListSelected="$railListSelected" :railSettings="$railSettings" :surface="$surface" :libraryHeading="$libraryHeading" :libraryMode="$libraryMode" :libraryCards="$libraryCards" :libraryWindowStart="$libraryWindowStart" :libraryError="$libraryError" :libraryOkLabel="$libraryOkLabel" :librarySelectLabel="$librarySelectLabel" :libraryOptionsIcon="$libraryOptionsIcon" :libraryOptionsLabel="$libraryOptionsLabel" :background="$background" :primary="$primary" :body="$body" :keyBorder="$keyBorder" />
        <SearchScreen ref="searchScreen" :show="$phase === 'search' || ($sourceReturnOrigin === 'search' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))"
          :homeProfileAvatar="$homeProfileAvatar" :railSearchSelected="$railSearchSelected" :railHomeUnselected="$railHomeUnselected" :railDiscover="$railDiscover" :railLive="$railLive" :railList="$railList" :railSettings="$railSettings"
          :surface="$surface" :background="$background" :primary="$primary" :body="$body" :keyBorder="$keyBorder" :heading="$searchHeading" :query="$searchQuery" :placeholder="$searchPlaceholder" :caretX="$searchCaretX"
          :keys="$searchKeys" :headings="$searchHeadings" :cards="$searchCards" :status="$searchStatus" :okLabel="$searchOkLabel" :typeLabel="$searchTypeLabel" :jumpIcon="$searchJumpIcon" :jumpLabel="$searchJumpLabel" :backLabel="$searchBackLabel" :deleteLabel="$searchDeleteLabel" />
        <LiveScreen ref="liveScreen" :show="($phase === 'live' && $liveSearchOpen === false) || ($sourceReturnOrigin === 'live' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))"
          :chrome="$liveChrome" :hero="$liveHero" :filters="$liveFilters" :channels="$liveRows" :programs="$livePrograms" :timeline="$liveTimeline"
          :nowX="$liveNowX" :nowLabel="$liveNowLabel" :status="$liveStatus" />
        <LiveSearchScreen ref="liveSearchScreen" :show="$liveSearchOpen" :view="$liveSearchView" />
        <SettingsScreen ref="settingsScreen" :show="$phase === 'settings'" :view="$settingsView" :panel="$settingsPanel" :dialogOpen="$settingsDialogOpen" :dialog="$settingsDialogView" />
        <Element :show="$phase === 'detail' || ($sourceReturnOrigin === 'detail' && ($phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'))">
          <Element x="1120" y="0" w="800" h="720" :src="$detail.heroImage" :show="$detail.heroImage !== ''" alpha="0.75" />
          <Element w="1920" h="1080" src="$homeScrim" />
          <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
          <Element x="50" y="60" w="44" h="44" rounded="22" :src="$homeProfileAvatar" :show="$homeProfileAvatar !== ''" />
          <Element x="60" y="202" w="24" h="24" :src="$railCurrent === 'search' ? $railSearchSelected : $railSearch" />
          <Element x="40" :y="$railCurrent === 'search' ? 184 : $railCurrent === 'discover' ? 340 : $railCurrent === 'live' ? 418 : $railCurrent === 'library' ? 496 : 262" w="64" h="64" rounded="32" color="$surface" />
          <Element x="60" y="282" w="24" h="24" :src="$railCurrent === 'home' ? $railHome : $railHomeUnselected" />
          <Element x="60" y="360" w="24" h="24" :src="$railCurrent === 'discover' ? $railDiscoverSelected : $railDiscover" />
          <Element x="60" y="440" w="24" h="24" :src="$railCurrent === 'live' ? $railLiveSelected : $railLive" />
          <Element x="60" y="516" w="24" h="24" :src="$railCurrent === 'library' ? $railListSelected : $railList" />
          <Element x="60" y="978" w="24" h="24" :src="$railSettings" />
          <Element x="192" y="96" w="310" h="90" fit="contain" :src="$detail.titleLogo" :show="$detail.titleLogo !== ''" />
          <Text x="192" y="96" maxwidth="850" :content="$detail.title" font="Bricolage700" size="56" color="$primary" :show="$detail.titleLogo === ''" />
          <Text x="192" y="211" maxwidth="1300" maxlines="1" :content="$detail.facts" font="Onest" size="22" color="$secondary" />
          <Text x="192" y="268" maxwidth="780" maxlines="2" :content="$detail.synopsis" font="Onest" size="26" color="$body" />
          <TitleAction ref="titleAction0" position="0" action="play" :label="$detail.playLabel" icon="▶" buttonWidth="298" holdable="true" x="182" y="365" />
          <TitleAction ref="titleAction1" position="1" action="source" :label="$detail.sourceLabel" icon="" buttonWidth="292" holdable="false" x="488" y="369" />
          <TitleAction ref="titleAction2" position="2" action="save" label="My List" :icon="$detailSaveIcon" buttonWidth="200" holdable="false" x="800" y="369" />
          <TitleAction ref="titleAction3" position="3" action="info" label="More info" icon="ⓘ" buttonWidth="230" holdable="false" x="1020" y="369" />
          <Element x="192" y="604" w="160" h="52" rounded="26" color="$surface" :show="$detail.episodeCount > 0" />
          <Text x="226" y="616" :content="$detailSeasonLabel" font="Onest700" size="22" color="$primary" :show="$detail.episodeCount > 0" />
          <Text x="374" y="616" :content="$detailCountLabel" font="Onest" size="22" color="$tertiary" :show="$detail.episodeCount > 0" />
          <EpisodeTile ref="titleEpisode0" position="0" :episode="$detailEpisodes[0]" x="192" y="682" />
          <EpisodeTile ref="titleEpisode1" position="1" :episode="$detailEpisodes[1]" x="588" y="682" />
          <EpisodeTile ref="titleEpisode2" position="2" :episode="$detailEpisodes[2]" x="984" y="682" />
          <EpisodeTile ref="titleEpisode3" position="3" :episode="$detailEpisodes[3]" x="1380" y="682" />
          <EpisodeTile ref="titleEpisode4" position="4" :episode="$detailEpisodes[4]" x="1776" y="682" />
          <Text x="700" y="54" maxwidth="600" align="center" :content="$detailNotice" font="Onest" size="22" color="$primary" />
        </Element>
        <Element :show="$phase === 'sources' || $phase === 'sourceDetails'">
          <Element w="1920" h="1080" color="$sourceScrim" />
          <Element x="1100" y="0" w="820" h="1080" color="$sourcePanelGround" />
          <Text x="1164" y="64" :content="$sourcePanelTitle" font="Bricolage700" size="44" color="$primary" />
          <Text x="1164" y="132" maxwidth="660" maxlines="1" :content="$source.status" font="Onest" size="22" color="$secondary" />
          <SourceChip ref="sourceChip0" position="0" :chip="$sourceChips[0]" chipWidth="104" x="1164" y="188" />
          <SourceChip ref="sourceChip1" position="1" :chip="$sourceChips[1]" chipWidth="80" x="1280" y="188" />
          <SourceChip ref="sourceChip2" position="2" :chip="$sourceChips[2]" chipWidth="145" x="1372" y="188" />
          <SourceChip ref="sourceChip3" position="3" :chip="$sourceChips[3]" chipWidth="125" x="1529" y="188" />
          <SourceChip ref="sourceChip4" position="4" :chip="$sourceChips[4]" chipWidth="95" x="1666" y="188" />
          <SourceProvider ref="sourceProvider" :label="$sourceProviderLabel" x="1164" y="255" />
          <SourceRow ref="sourceRow0" position="0" :row="$sourceRows[0]" x="1164" y="326" />
          <SourceRow ref="sourceRow1" position="1" :row="$sourceRows[1]" x="1164" y="444" />
          <SourceRow ref="sourceRow2" position="2" :row="$sourceRows[2]" x="1164" y="562" />
          <SourceRow ref="sourceRow3" position="3" :row="$sourceRows[3]" x="1164" y="680" />
          <SourceRow ref="sourceRow4" position="4" :row="$sourceRows[4]" x="1164" y="798" />
          <SourceRow ref="sourceRow5" position="5" :row="$sourceRows[5]" x="1164" y="916" />
          <Text x="1164" y="1034" maxwidth="640" :content="$sourceNotice" font="Onest" size="20" color="$secondary" />
          <Element x="1392" y="993" w="45" h="33" rounded="8" color="$keyBorder" />
          <Element x="1394" y="995" w="41" h="29" rounded="6" color="$sourcePanelGround" />
          <Text x="1403" y="999" :content="$sourceOkLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1448" y="998" :content="$sourcePlayLabel" font="Onest" size="20" color="$secondary" />
          <Element x="1526" y="993" w="60" h="33" rounded="8" color="$keyBorder" />
          <Element x="1528" y="995" w="56" h="29" rounded="6" color="$sourcePanelGround" />
          <Text x="1534" y="999" :content="$sourceArrowLabel" font="Onest" size="16" color="$primary" />
          <Text x="1592" y="998" :content="$sourceQualityLabel" font="Onest" size="20" color="$secondary" />
          <Element x="1693" y="993" w="66" h="33" rounded="8" color="$keyBorder" />
          <Element x="1695" y="995" w="62" h="29" rounded="6" color="$sourcePanelGround" />
          <Text x="1702" y="999" :content="$sourceBackLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1768" y="998" :content="$sourceCloseLabel" font="Onest" size="20" color="$secondary" />
        </Element>
        <Element :show="$phase === 'provider'">
          <Element w="1920" h="1080" color="$sourceScrim" />
          <Element x="1100" y="0" w="820" h="1080" color="$sourcePanelGround" />
          <Text x="1164" y="64" :content="$providerPanelTitle" font="Bricolage700" size="44" color="$primary" />
          <ProviderOption ref="providerOption0" position="0" :choice="$providerChoices[0]" x="1164" y="126" />
          <ProviderOption ref="providerOption1" position="1" :choice="$providerChoices[1]" x="1164" y="220" />
          <ProviderOption ref="providerOption2" position="2" :choice="$providerChoices[2]" x="1164" y="314" />
          <ProviderOption ref="providerOption3" position="3" :choice="$providerChoices[3]" x="1164" y="408" />
          <ProviderOption ref="providerOption4" position="4" :choice="$providerChoices[4]" x="1164" y="502" />
          <ProviderOption ref="providerOption5" position="5" :choice="$providerChoices[5]" x="1164" y="596" />
        </Element>
        <Element :show="$phase === 'sourceDetails'">
          <Element w="1920" h="1080" color="$sourceDetailsScrim" />
          <Text x="192" y="95" :content="$sourceDetailsHeading" font="Bricolage700" size="56" color="$primary" />
          <Element x="192" y="173" w="1536" h="759" rounded="24" color="$sourcePanelGround" />
          <Text x="226" y="210" maxwidth="1440" maxheight="690" lineheight="65" :content="$sourceDetailsBody" font="Onest" size="28" color="$body" />
          <Element x="1704" y="204" w="6" h="222" rounded="3" color="$scrollbar" />
          <SourceDetailsClose ref="sourceDetailsClose" x="185" y="949" />
        </Element>
        <Element :show="$phase === 'preparing'">
          <Element x="682" y="430" w="556" h="220" rounded="28" color="$sourcePanelGround" />
          <Text x="746" y="516" :content="$preparingText" font="Onest700" size="32" color="$primary" />
        </Element>
        <Element :show="($phase === 'player' || $phase === 'playerTracks') && $playerOverlay">
          <Text x="96" y="76" :content="$playerTitle" font="Onest700" size="24" color="$primary" />
          <Text x="1680" y="76" maxwidth="144" align="right" :content="$playerStatus" font="Onest700" size="20" color="$primary" />
          <Text x="96" :y="$playerSeekPreview !== null ? 560 : 610" :content="$nowPlayingLabel" font="Onest700" size="20" color="$secondary" />
          <Text x="96" :y="$playerSeekPreview !== null ? 597 : 647" :content="$playerEpisodeLine" font="Onest600" size="26" color="$primary" />
          <Text x="96" :y="$playerSeekPreview !== null ? 640 : 690" maxwidth="1300" maxlines="1" :content="$playerTitle" font="Bricolage700" size="56" color="$primary" />
          <PlayerTimeline ref="playerTimeline" :progress="$playerProgress" :seeking="$playerSeekPreview !== null" :previewText="$playerSeekLabel" x="96" y="780" />
          <Text x="96" y="826" :content="$playerPositionText" font="Onest700" size="22" color="$primary" />
          <Text x="1640" y="826" maxwidth="184" align="right" :content="$playerDurationText" font="Onest" size="22" color="$secondary" />
          <PlayerControl ref="playerControl0" position="0" action="back10" icon="≪" diameter="72" x="96" y="878" />
          <PlayerControl ref="playerControl1" position="1" action="toggle" :icon="$playerToggleIcon" diameter="84" x="181" y="872" />
          <PlayerControl ref="playerControl2" position="2" action="forward30" icon="≫" diameter="72" x="276" y="878" />
          <PlayerControl ref="playerControl3" position="3" action="next" icon="▶|" diameter="72" x="366" y="878" />
          <PlayerControl ref="playerControl4" position="4" action="audio" icon="≋" diameter="72" x="1572" y="878" />
          <PlayerControl ref="playerControl5" position="5" action="subtitles" icon="▤" diameter="72" x="1662" y="878" />
          <PlayerControl ref="playerControl6" position="6" action="exit" icon="↪" diameter="72" x="1752" y="878" />
          <Text x="1390" y="1000" :content="$playerLegend" font="Onest" size="20" color="$secondary" />
        </Element>
        <Text x="700" y="190" maxwidth="520" align="center" :content="$playerNotice" font="Onest" size="24" color="$primary" :show="$phase === 'player' || $phase === 'playerTracks'" />
        <Element :show="$phase === 'playerTracks'">
          <Element w="1920" h="1080" color="$sourceScrim" />
          <Element x="1100" y="0" w="820" h="1080" color="$sourcePanelGround" />
          <Text x="1164" y="64" :content="$trackPanelTitle" font="Bricolage700" size="44" color="$primary" />
          <PlayerTrackOption ref="playerTrack0" position="0" :choice="$trackSlots[0]" x="1164" y="126" />
          <PlayerTrackOption ref="playerTrack1" position="1" :choice="$trackSlots[1]" x="1164" y="220" />
          <PlayerTrackOption ref="playerTrack2" position="2" :choice="$trackSlots[2]" x="1164" y="314" />
          <PlayerTrackOption ref="playerTrack3" position="3" :choice="$trackSlots[3]" x="1164" y="408" />
          <PlayerTrackOption ref="playerTrack4" position="4" :choice="$trackSlots[4]" x="1164" y="502" />
          <PlayerTrackOption ref="playerTrack5" position="5" :choice="$trackSlots[5]" x="1164" y="596" />
          <PlayerTrackOption ref="playerTrack6" position="6" :choice="$trackSlots[6]" x="1164" y="690" />
          <PlayerTrackOption ref="playerTrack7" position="7" :choice="$trackSlots[7]" x="1164" y="784" />
          <Text x="1164" y="902" maxwidth="660" :content="$trackNotice" font="Onest" size="22" color="$secondary" />
          <Text x="1382" y="998" :content="$trackLegend" font="Onest" size="20" color="$secondary" />
        </Element>
        <Element zIndex="10" :show="$discoverFilterOpen">
          <Element w="1920" h="1080" color="$sourceScrim" />
          <Element x="1100" y="0" w="820" h="1080" color="$sourcePanelGround" />
          <Text x="1164" y="64" :content="$discoverFilterTitle" font="Bricolage700" size="44" color="$primary" />
          <DiscoverFilterOption ref="discoverOption0" position="0" :label="$discoverOptionLabels[0]" :selected="$discoverOptionLabels[0] === $discoverFilterValue" :visible="$discoverOptionLabels[0] !== ''" x="1158" y="130" />
          <DiscoverFilterOption ref="discoverOption1" position="1" :label="$discoverOptionLabels[1]" :selected="$discoverOptionLabels[1] === $discoverFilterValue" :visible="$discoverOptionLabels[1] !== ''" x="1158" y="224" />
          <DiscoverFilterOption ref="discoverOption2" position="2" :label="$discoverOptionLabels[2]" :selected="$discoverOptionLabels[2] === $discoverFilterValue" :visible="$discoverOptionLabels[2] !== ''" x="1158" y="318" />
          <DiscoverFilterOption ref="discoverOption3" position="3" :label="$discoverOptionLabels[3]" :selected="$discoverOptionLabels[3] === $discoverFilterValue" :visible="$discoverOptionLabels[3] !== ''" x="1158" y="412" />
          <DiscoverFilterOption ref="discoverOption4" position="4" :label="$discoverOptionLabels[4]" :selected="$discoverOptionLabels[4] === $discoverFilterValue" :visible="$discoverOptionLabels[4] !== ''" x="1158" y="506" />
          <DiscoverFilterOption ref="discoverOption5" position="5" :label="$discoverOptionLabels[5]" :selected="$discoverOptionLabels[5] === $discoverFilterValue" :visible="$discoverOptionLabels[5] !== ''" x="1158" y="600" />
          <DiscoverFilterOption ref="discoverOption6" position="6" :label="$discoverOptionLabels[6]" :selected="$discoverOptionLabels[6] === $discoverFilterValue" :visible="$discoverOptionLabels[6] !== ''" x="1158" y="694" />
          <DiscoverFilterOption ref="discoverOption7" position="7" :label="$discoverOptionLabels[7]" :selected="$discoverOptionLabels[7] === $discoverFilterValue" :visible="$discoverOptionLabels[7] !== ''" x="1158" y="788" />
          <Element x="1100" y="976" w="820" h="104" color="$sourcePanelGround" />
          <Element x="1530" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
          <Element x="1532" y="996" w="41" h="27" rounded="6" color="$sourcePanelGround" />
          <Text x="1538" y="1000" :content="$discoverFilterOkLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1588" y="999" :content="$discoverFilterSelectLabel" font="Onest" size="20" color="$body" />
          <Element x="1682" y="994" w="66" h="31" rounded="8" color="$keyBorder" />
          <Element x="1684" y="996" w="62" h="27" rounded="6" color="$sourcePanelGround" />
          <Text x="1693" y="1000" :content="$discoverBackLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1760" y="999" :content="$discoverCancelLabel" font="Onest" size="20" color="$body" />
        </Element>
        <LiveDetailsScreen ref="liveDetailsScreen" :show="$liveDetailsOpen" :title="$liveDetailsTitle" :channel="$liveDetailsChannel" :range="$liveDetailsRange" :description="$liveDetailsDescription" :watchLabel="$liveDetailsWatchLabel" :closeLabel="$liveDetailsCloseLabel" :okLabel="$liveDetailsOkLabel" :selectLabel="$liveDetailsSelectLabel" :backLabel="$liveDetailsBackLabel" />
        <TitleMenuScreen ref="titleMenuScreen" :show="$titleMenuOpen" :heading="$titleMenuHeading" :choices="$titleMenuSlots" :notice="$titleMenuNotice" :okLabel="$titleMenuOkLabel" :selectLabel="$titleMenuSelectLabel" :backLabel="$titleMenuBackLabel" :cancelLabel="$titleMenuCancelLabel" />
        <Element zIndex="20" :show="$railExpanded && ($phase === 'home' || $phase === 'detail' || $phase === 'discover' || $phase === 'library' || $phase === 'search' || $phase === 'live')">
          <Element w="1920" h="1080" color="$menuScrim" />
          <Element w="520" h="1080" src="$menuGradient" />
          <RailItem ref="rail0" position="0" label="Profile" icon="" focusedIcon="" :avatar="$homeProfileAvatar" :profileName="$railProfileName" :current="false" x="48" y="48" />
          <RailItem ref="rail1" position="1" label="Search" :icon="$railSearch" :focusedIcon="$railSearchFocus" avatar="" profileName="" :current="$railCurrent === 'search'" x="48" y="174" />
          <RailItem ref="rail2" position="2" label="Home" :icon="$railHome" :focusedIcon="$railHomeFocus" avatar="" profileName="" :current="$railCurrent === 'home'" x="48" y="252" />
          <RailItem ref="rail3" position="3" label="Discover" :icon="$railDiscover" :focusedIcon="$railDiscoverFocus" avatar="" profileName="" :current="$railCurrent === 'discover'" x="48" y="330" />
          <RailItem ref="rail4" position="4" label="Live TV" :icon="$railLive" :focusedIcon="$railLiveFocus" avatar="" profileName="" :current="$railCurrent === 'live'" x="48" y="408" />
          <RailItem ref="rail5" position="5" label="My List" :icon="$railList" :focusedIcon="$railListFocus" avatar="" profileName="" :current="$railCurrent === 'library'" x="48" y="486" />
          <RailItem ref="rail6" position="6" label="Settings" :icon="$railSettings" :focusedIcon="$railSettingsFocus" avatar="" profileName="" :current="false" x="48" y="958" />
          <Text x="48" y="864" maxwidth="400" :content="$railNotice" font="Onest" size="20" color="$secondary" />
        </Element>
        <Text x="96" y="54" :show="$phase === 'ready'" :content="$startingLabel" font="Onest" size="28" color="$primary" />
      </Element>
    `,
    state() {
      return {
        ...pairingFrame,
        background: tokens["color.bg"],
        accent: tokens["color.accent.default"],
        primary: tokens["color.text.primary"],
        body: tokens["color.text.body"],
        tertiary: tokens["color.text.tertiary"],
        onLight: tokens["color.on.light"],
        onAccent: tokens["color.on.accent"],
        field: tokens["color.fill.tv-field"],
        white: tokens["color.fill.white"],
        keyBorder: tokens["color.line.keycap-tv"],
        pairingGlow: gatewayGlow(800),
        profilesGlow: gatewayGlow(700),
        homeScrim: homeScrim(),
        home: emptyHome as HomeView,
        detail: emptyDetail as DetailView,
        source: emptySources as SourcesView,
        sourceChips: Array.from({ length: 5 }, () => ({ ...emptySourceChip })),
        sourceRows: Array.from({ length: 6 }, () => ({ ...emptySourceRow })),
        sourcePanelTitle: "",
        sourceOkLabel: "",
        sourcePlayLabel: "",
        sourceArrowLabel: "",
        sourceQualityLabel: "",
        sourceBackLabel: "",
        sourceCloseLabel: "",
        providerPanelTitle: "",
        providerChoices: Array.from({ length: 6 }, () => ({ ...emptyProviderChoice })),
        providerChoiceIndex: 0,
        sourceProviderLabel: "",
        sourceNotice: "",
        sourceSelectedId: "",
        sourceFocusZone: "chip" as "chip" | "provider" | "row",
        sourceChipIndex: 0,
        sourceRowIndex: 0,
        sourceWindowStart: 0,
        sourceReturnZone: "action" as "action" | "episode" | "channel" | "program",
        sourceReturnIndex: 0,
        sourceReturnOrigin: "detail" as "detail" | "library" | "home" | "discover" | "search" | "live",
        sourceResume: false,
        sourceScrim: tokens["color.scrim.tv-panel"],
        sourcePanelGround: tokens["color.surface.1"],
        sourceDetailsScrim: tokens["color.scrim.tv-fullscreen"],
        sourceDetailsHeading: "",
        sourceDetailsBody: "",
        sourceDetailsReturnIndex: 0,
        scrollbar: tokens["color.fill.scrollbar"],
        preparingText: "",
        playerSnapshot: null as PlayerSnapshot | null,
        playerOverlay: true,
        playerTitle: "",
        playerEpisodeLine: "",
        nowPlayingLabel: "",
        playerStatus: "",
        playerPositionText: "",
        playerDurationText: "",
        playerProgress: 0,
        playerToggleIcon: "Ⅱ",
        playerLegend: "",
        playerNotice: "",
        playerFocusIndex: 1,
        playerSeekPreview: null as number | null,
        playerSeekLabel: "",
        playerItem: null as MediaItem | null,
        playerSessionId: "",
        playerSessionDuration: 0,
        trackPanelOpen: false,
        trackPanelKind: "text" as "audio" | "text",
        trackPanelTitle: "",
        trackChoices: [] as TrackChoiceView[],
        trackSlots: Array.from({ length: 8 }, () => ({ ...emptyTrackChoice })),
        trackFocusIndex: 0,
        trackReturnControlIndex: 5,
        trackLegend: "",
        trackNotice: "",
        detailEpisodes: Array.from({ length: 5 }, () => ({ ...emptyDetailEpisode })),
        detailSaveIcon: "",
        detailSeasonLabel: "",
        detailCountLabel: "",
        detailNotice: "",
        detailFocusZone: "action" as "action" | "episode",
        detailActionIndex: 0,
        detailEpisodeIndex: 0,
        detailReturnZone: "action" as "action" | "card",
        detailReturnIndex: 0,
        homeCards: Array.from({ length: 6 }, () => ({ ...emptyHomeCard })),
        homeFocusZone: "action" as "action" | "card",
        homeActionIndex: 0,
        homeCardIndex: 0,
        railExpanded: false,
        railFocusIndex: 2,
        railReturnZone: "action" as "action" | "card" | "chip" | "segment" | "result" | "key" | "channel" | "program" | "filter" | "episode" | "row" | "profile",
        railReturnIndex: 0,
        railProfileName: "",
        railNotice: "",
        railCurrent: "home" as "home" | "discover" | "library" | "search" | "live" | "settings",
        menuScrim: tokens["color.scrim.tv-menu"],
        menuGradient: menuGradient(),
        discoverHeading: "",
        discoverOkLabel: "",
        discoverSelectLabel: "",
        discoverOptionsIcon: "",
        discoverOptionsLabel: "",
        discoverBackLabel: "",
        discoverCancelLabel: "",
        discoverFilterOkLabel: "",
        discoverFilterSelectLabel: "",
        discoverCatalogs: [] as Catalog[],
        discoverCatalog: null as Catalog | null,
        discoverValues: {} as Record<string, string>,
        discoverItems: [] as MediaItem[],
        discoverNextSkip: null as number | null,
        discoverBusy: false,
        discoverError: "",
        discoverChips: Array.from({ length: 12 }, () => ({ ...emptyDiscoverChip })) as DiscoverChipView[],
        discoverCards: Array.from({ length: 12 }, () => ({ ...emptyDiscoverCard })) as DiscoverCardView[],
        discoverFocusZone: "card" as "card" | "chip",
        discoverChipIndex: 0,
        discoverCardIndex: 0,
        discoverWindowStart: 0,
        discoverFilterOpen: false,
        discoverFilterName: "",
        discoverFilterTitle: "",
        discoverFilterValue: "",
        discoverOptionLabels: Array.from({ length: 8 }, () => ""),
        discoverOptionIndex: 0,
        discoverFilterReturnChip: 0,
        discoverReturnPhase: "home" as "home" | "library" | "search",
        discoverReturnZone: "action" as "action" | "card" | "segment" | "result" | "key",
        discoverReturnIndex: 0,
        detailReturnPhase: "home" as "home" | "discover" | "library" | "search",
        libraryHeading: "",
        libraryMode: "favorites" as "favorites" | "queue",
        libraryFavorites: [] as MediaItem[],
        libraryQueueItems: [] as MediaItem[],
        libraryItems: [] as MediaItem[],
        libraryNextOffset: null as number | null,
        libraryCards: Array.from({ length: 12 }, () => ({ ...emptyDiscoverCard })) as DiscoverCardView[],
        libraryWindowStart: 0,
        libraryCardIndex: 0,
        librarySegmentIndex: 0,
        libraryFocusZone: "segment" as "segment" | "card",
        libraryReturnPhase: "home" as "home" | "discover" | "search",
        libraryReturnZone: "action" as "action" | "card" | "chip" | "result" | "key",
        libraryReturnIndex: 0,
        libraryBusy: false,
        libraryError: "",
        libraryOkLabel: "",
        librarySelectLabel: "",
        libraryOptionsIcon: "",
        libraryOptionsLabel: "",
        searchHeading: "",
        searchPlaceholder: "",
        searchQuery: "",
        searchCaretX: 218,
        searchKeys,
        searchCatalogs: [] as Catalog[],
        searchRows: [] as SearchRow[],
        searchHeadings: [] as SearchHeadingView[],
        searchCards: [] as SearchCardView[],
        searchStatus: "",
        searchBusy: false,
        searchPartial: false,
        searchKeyIndex: 0,
        searchLastKeyIndex: 0,
        searchResultIndex: 0,
        searchFocusZone: "key" as "key" | "result",
        searchSectionOffsets: {} as Record<string, number>,
        searchVerticalOffset: 0,
        searchReturnPhase: "home" as "home" | "discover" | "library",
        searchReturnZone: "action" as "action" | "card" | "chip" | "segment",
        searchReturnIndex: 0,
        searchOkLabel: "",
        searchTypeLabel: "",
        searchJumpIcon: "",
        searchJumpLabel: "",
        searchBackLabel: "",
        searchDeleteLabel: "",
        liveNow: Date.now() / 1000,
        liveWindowStart: halfHour(),
        liveFollowing: true,
        liveTotal: 0,
        liveOffset: 0,
        liveCategories: [] as LiveCategory[],
        liveFilterId: "all",
        liveFilters: liveFilters([], "all") as LiveFilterView[],
        liveGuides: {} as Record<string, Guide>,
        liveSelectedRow: 0,
        liveSelectedCellIndex: null as number | null,
        liveFocusZone: "channel" as "channel" | "program" | "filter",
        liveFilterIndex: 1,
        liveProgramPosition: 0,
        liveRows: [] as LiveChannelView[],
        livePrograms: [] as LiveProgramView[],
        liveTimeline: [] as { x: number; label: string }[],
        liveHero: emptyLiveHero as LiveHeroView,
        liveNowX: -1,
        liveNowLabel: "",
        liveStatus: "",
        liveChrome: {
          homeProfileAvatar: "", railSearch: railIcon("search"), railHomeUnselected: railIcon("home"),
          railDiscover: railIcon("discover"), railLiveSelected: railIcon("live", true),
          railList: railIcon("list"), railSettings: railIcon("settings"),
          surface: tokens["color.surface.2"], background: tokens["color.bg"],
          primary: tokens["color.text.primary"], body: tokens["color.text.body"],
          keyBorder: tokens["color.line.outline"], liveLabel: "LIVE", previewLabel: "Live preview",
          okLabel: "OK", watchLabel: "Watch", optionsIcon: "≡", detailsLabel: "Details",
          channelIcon: "▲ ▼", channelsLabel: "Channels", timeIcon: "◀ ▶", timeLabel: "Time",
        },
        liveSearchOpen: false,
        liveSearchUppercase: false,
        liveSearchKeyIndex: 0,
        liveSearchView: { keys: liveSearchKeys.map(key => ({ ...key })) },
        liveLabel: "",
        livePreviewLabel: "",
        liveOkLabel: "",
        liveWatchLabel: "",
        liveOptionsIcon: "",
        liveDetailsLabel: "",
        liveChannelIcon: "",
        liveChannelsLabel: "",
        liveTimeIcon: "",
        liveTimeLabel: "",
        liveReturnPhase: "home" as "home" | "discover" | "library" | "search",
        liveReturnZone: "action" as "action" | "card" | "chip" | "segment" | "key" | "result",
        liveReturnIndex: 0,
        liveDetailsOpen: false,
        settingsPage: "Settings" as SettingsPage,
        settingsSelectedIndex: 0,
        settingsFocusZone: "row" as "row" | "profile",
        settingsProfileIndex: 0,
        settingsRowsCount: 6,
        settingsPrefs: defaultSettingsPreferences as PlaybackPreferences,
        settingsAddons: [] as JsonObject[],
        settingsView: {
          page: "", rows: Array.from({ length: 6 }, () => ({ ...emptySettingsRow })),
          profiles: Array.from({ length: 4 }, () => ({ ...emptySettingsProfile })),
          showProfiles: false, avatar: "", railSearch: "", railHome: "", railDiscover: "",
          railLive: "", railList: "", railSettings: "", version: "",
        } as SettingsScreenView,
        settingsPanel: { title: "", description: "", caption: "" } as SettingsPanelView,
        settingsDialogOpen: false,
        settingsDialogKind: "choice" as "choice" | "signout" | "addonManage" | "addonRemove",
        settingsDialogKey: "quality" as keyof PlaybackPreferences,
        settingsDialogAddon: null as JsonObject | null,
        settingsChoiceIndex: 0,
        settingsDialogView: { title: "", choices: Array.from({ length: 8 }, () => ({ ...emptySettingsChoice })), start: 0, signout: false } as SettingsDialogView,
        settingsReturnPhase: "home" as "home" | "discover" | "library" | "search" | "live",
        settingsReturnZone: "action" as "action" | "card" | "chip" | "segment" | "key" | "result" | "filter" | "channel" | "program",
        settingsReturnIndex: 0,
        liveDetailsTitle: "",
        liveDetailsChannel: "",
        liveDetailsRange: "",
        liveDetailsDescription: "",
        liveDetailsWatchLabel: "",
        liveDetailsCloseLabel: "",
        liveDetailsOkLabel: "",
        liveDetailsSelectLabel: "",
        liveDetailsBackLabel: "",
        liveDetailsOptionIndex: 0,
        liveDetailsReturnZone: "program" as "program" | "channel",
        liveDetailsReturnIndex: 0,
        liveDetailsChannelItem: null as MediaItem | null,
        titleMenuOpen: false,
        titleMenuKind: "actions" as "actions" | "undo",
        titleMenuHeading: "",
        titleMenuNotice: "",
        titleMenuChoices: [] as TitleMenuChoiceView[],
        titleMenuSlots: Array.from({ length: 7 }, () => ({ ...emptyTitleMenuChoice })) as TitleMenuChoiceView[],
        titleMenuFocusIndex: 0,
        titleMenuItem: null as MediaItem | null,
        titleMenuOrigin: "home" as "home" | "library" | "discover" | "search",
        titleMenuReturnIndex: 0,
        titleMenuBusy: false,
        titleMenuOkLabel: "",
        titleMenuSelectLabel: "",
        titleMenuBackLabel: "",
        titleMenuCancelLabel: "",
        currentProfileId: "",
        homeNotice: "",
        homeAddLabel: "",
        homeShelfLabel: "",
        surface: tokens["color.surface.3"],
        secondary: tokens["color.text.secondary"],
        noticeGlass: tokens["color.fill.notice-glass-tv"],
        railSearch: railIcon("search"),
        railSearchSelected: railIcon("search", true),
        railSearchFocus: railIcon("search", false, true),
        railHome: railIcon("home", true),
        railHomeUnselected: railIcon("home"),
        railHomeFocus: railIcon("home", false, true),
        railDiscover: railIcon("discover"),
        railDiscoverSelected: railIcon("discover", true),
        railDiscoverFocus: railIcon("discover", false, true),
        railLive: railIcon("live"),
        railLiveSelected: railIcon("live", true),
        railLiveFocus: railIcon("live", false, true),
        railList: railIcon("list"),
        railListSelected: railIcon("list", true),
        railListFocus: railIcon("list", false, true),
        railSettings: railIcon("settings"),
        railSettingsFocus: railIcon("settings", false, true),
        homeProfileAvatar: "",
        optionsIcon: "",
        optionsLabel: "",
        danger: tokens["color.status.danger-tv"],
        codeSize: pairCodeSize,
        codeLetterSpacing: pairCodeSize * 0.08,
        phase: "starting" as "starting" | "pairing" | "expired" | "error" | "profiles" | "ready" | "home" | "discover" | "library" | "search" | "live" | "settings" | "detail" | "sources" | "provider" | "sourceDetails" | "preparing" | "player" | "playerTracks",
        address: "Connecting…",
        code: "••••••",
        qr: "",
        error: "",
        markLabel: "",
        brandLabel: "",
        titleLabel: "",
        introLabel: "",
        expiredLabel: "",
        retryLabel: "",
        retryIcon: "",
        startingLabel: "",
        profilesLabel: "",
        profilesWordmark: "",
        profiles: [] as TvProfile[],
        profileSlots: Array.from({ length: 6 }, () => ({ ...emptyProfileTile })),
        profilePage: 0,
        profileFocus: 0,
        profileFocusTarget: "tile" as "tile" | "manage",
        profileStartX: 424,
        managing: false,
        profileError: "",
        okLabel: "",
        selectLabel: "",
        moveIcon: "",
        moveLabel: "",
      };
    },
    hooks: {
      ready() {
        if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:app-ready");
        const session = api.createSessionDriver((view) => {
          if (new URLSearchParams(location.search).has("perfdebug")) performance.mark(`viptv:session-${view.phase}`);
          if (view.identity) this.profiles = [...view.identity.profiles];
          if (view.phase === "Pairing") void this.beginPairing();
          else if (view.phase === "Profiles") {
            if (view.identity) this.showProfiles(view.identity.profiles);
            else void api.me().then(identity => this.showProfiles(identity.profiles), cause => {
              this.error = cause instanceof Error ? cause.message : "Could not load profiles.";
              this.phase = "error";
            });
          }
          else if (view.phase === "Ready" && view.selectedProfileId) void this.loadHome(view.selectedProfileId);
          else if (view.phase === "Error") {
            this.error = view.error ?? "The TV could not complete this request.";
            this.phase = "error";
          }
        }, (message) => {
          this.error = message;
          this.phase = "error";
        });
        disposeSession = () => session.dispose();
        this.$listen("profile-focus", (slot: number) => {
          this.profileFocus = Number(slot);
          this.profileFocusTarget = "tile";
        });
        this.$listen("profile-move", ({ slot, delta }: { slot: number; delta: number }) => this.moveProfile(Number(slot), delta));
        this.$listen("profile-manage-focus", () => {
          this.profileFocusTarget = "manage";
          this.$select("manageProfiles")?.$focus();
        });
        this.$listen("profile-restore-focus", () => {
          this.profileFocusTarget = "tile";
          this.$select(`profile${this.profileFocus}`)?.$focus();
        });
        this.$listen("profile-manage-toggle", () => this.toggleManageProfiles());
        this.$listen("profile-hold", (slot: number) => {
          this.managing = true;
          this.profilesLabel = "Manage profiles";
          this.profileFocus = Number(slot);
          setTimeout(() => this.revealProfileTiles(), 0);
        });
        this.$listen("profile-activate", (slot: number) => void this.activateProfile(Number(slot)));
        this.$listen("home-action-focused", (position: number) => {
          if (this.homeFocusZone === "action" && Number(position) === this.homeActionIndex)
            this.homeActionIndex = Number(position);
        });
        this.$listen("home-action-move", ({ position, delta }: { position: number; delta: number }) =>
          this.moveHomeAction(Number(position), delta));
        this.$listen("home-cards-enter", () => this.focusHomeCard(0));
        this.$listen("home-action-return", () => this.focusHomeAction(this.homeActionIndex));
        this.$listen("home-card-focused", (position: number) => {
          if (this.homeFocusZone === "card" && Number(position) === this.homeCardIndex)
            this.homeCardIndex = Number(position);
        });
        this.$listen("home-card-move", ({ position, delta }: { position: number; delta: number }) =>
          this.moveHomeCard(Number(position), delta));
        this.$listen("home-action-activate", () => void this.activateHomeAction());
        this.$listen("home-action-hold", () => { this.homeNotice = "Choose a source from the title screen."; });
        this.$listen("home-card-activate", () => void this.openDetailByCard());
        this.$listen("home-card-hold", (position: number) => {
          const item = this.home.queueItems[Number(position)];
          if (item) this.openTitleMenu(item, "home", Number(position));
        });
        this.$listen("rail-focused", (position: number) => { this.railFocusIndex = Number(position); });
        this.$listen("rail-move", (delta: number) => this.moveRail(Number(delta)));
        this.$listen("rail-exit", () => this.closeRail());
        this.$listen("rail-activate", () => this.activateRail());
        this.$listen("discover-chip-focused", (position: number) => { this.discoverChipIndex = Number(position); });
        this.$listen("discover-chip-move", (delta: number) => this.moveDiscoverChip(Number(delta)));
        this.$listen("discover-chip-activate", () => void this.activateDiscoverChip());
        this.$listen("discover-card-enter", () => this.focusDiscoverCard(this.discoverCardIndex));
        this.$listen("discover-card-focused", (position: number) => { this.discoverCardIndex = Number(position); });
        this.$listen("discover-card-move", (direction: string) => this.moveDiscoverCard(direction));
        this.$listen("discover-card-activate", () => this.activateDiscoverCard());
        this.$listen("discover-card-hold", (position: number) => {
          const item = this.discoverItems[Number(position)];
          if (item) this.openTitleMenu(item, "discover", Number(position));
        });
        this.$listen("discover-option-focused", (position: number) => { this.discoverOptionIndex = Number(position); });
        this.$listen("discover-option-move", (delta: number) => this.moveDiscoverOption(Number(delta)));
        this.$listen("discover-option-activate", () => void this.selectDiscoverOption());
        this.$listen("discover-option-close", () => this.closeDiscoverFilter());
        this.$listen("library-segment-focused", (position: number) => { this.librarySegmentIndex = Number(position); });
        this.$listen("library-segment-move", (delta: number) => this.moveLibrarySegment(Number(delta)));
        this.$listen("library-segment-activate", () => void this.activateLibrarySegment());
        this.$listen("library-card-enter", () => this.focusLibraryCard(this.libraryCardIndex));
        this.$listen("library-card-focused", (position: number) => { this.libraryCardIndex = Number(position); });
        this.$listen("library-card-move", (direction: string) => this.moveLibraryCard(direction));
        this.$listen("library-card-activate", () => this.activateLibraryCard());
        this.$listen("library-card-hold", (position: number) => {
          const item = this.libraryItems[Number(position)];
          if (item) this.openTitleMenu(item, "library", Number(position));
        });
        this.$listen("search-key-focused", (position: number) => { this.searchKeyIndex = Number(position); this.searchLastKeyIndex = Number(position); });
        this.$listen("search-key-move", (direction: string) => this.moveSearchKey(direction));
        this.$listen("search-key-activate", () => this.activateSearchKey());
        this.$listen("search-key-back", () => this.backFromSearch());
        this.$listen("search-physical-character", (value: string) => this.setSearchQuery((this.searchQuery + value).slice(0, 256)));
        this.$listen("search-jump-results", () => this.focusSearchResult(0));
        this.$listen("search-card-focused", (position: number) => { this.searchResultIndex = Number(position); });
        this.$listen("search-card-move", (direction: string) => this.moveSearchResult(direction));
        this.$listen("search-card-activate", () => this.activateSearchResult());
        this.$listen("search-card-hold", (position: number) => {
          const card = this.searchCards[Number(position)];
          if (card) this.openTitleMenu(card.item, "search", Number(position));
        });
        this.$listen("search-card-back", () => this.returnFromSearch());
        this.$listen("live-filter-focused", (position: number) => { this.liveFilterIndex = Number(position); this.liveFocusZone = "filter"; });
        this.$listen("live-filter-move", (delta: number) => this.moveLiveFilter(Number(delta)));
        this.$listen("live-filter-activate", () => void this.activateLiveFilter());
        this.$listen("live-enter-channels", () => this.focusLiveChannel(this.liveSelectedRow));
        this.$listen("live-search-key-focused", (position: number) => { this.liveSearchKeyIndex = Number(position); });
        this.$listen("live-search-key-move", (direction: string) => this.moveLiveSearchKey(direction));
        this.$listen("live-search-key-activate", () => this.activateLiveSearchKey());
        this.$listen("live-search-close", () => this.closeLiveSearch());
        this.$listen("guide-channel-focused", (row: number) => {
          const selected = Number(row);
          const changed = this.liveSelectedRow !== selected || this.liveSelectedCellIndex !== null || this.liveFocusZone !== "channel";
          this.liveSelectedRow = selected; this.liveSelectedCellIndex = null; this.liveFocusZone = "channel";
          if (changed) this.refreshLiveView();
        });
        this.$listen("guide-channel-move", (delta: number) => this.moveLiveChannel(Number(delta)));
        this.$listen("guide-channel-left", () => this.openRail());
        this.$listen("guide-program-enter", (row: number) => this.enterLiveProgram(Number(row)));
        this.$listen("guide-channel-activate", (row: number) => this.watchLiveChannel(Number(row)));
        this.$listen("guide-channel-hold", (row: number) => this.openLiveDetailsForChannel(Number(row)));
        this.$listen("guide-program-focused", ({ row, index }: { row: number; index: number; position: number }) => {
          // A reprojected For child can emit focus after the remote has moved
          // into the filter row. Keep the newer focus destination authoritative.
          if (this.liveFocusZone === "filter") {
            setTimeout(() => { if (this.phase === "live" && this.liveFocusZone === "filter") this.focusLiveFilter(this.liveFilterIndex); }, 0);
            return;
          }
          const changed = this.liveSelectedRow !== row || this.liveSelectedCellIndex !== index || this.liveFocusZone !== "program";
          this.liveSelectedRow = row; this.liveSelectedCellIndex = index;
          this.liveProgramPosition = liveCanonicalPrograms.findIndex(block => block.row === row && block.index === index);
          this.liveFocusZone = "program";
          if (changed) this.refreshLiveView();
        });
        this.$listen("guide-program-move", ({ position, direction }: { position: number; direction: string }) => this.moveLiveProgram(position, direction));
        this.$listen("guide-program-activate", () => this.activateLiveProgram(this.focusedLiveProgramPosition()));
        this.$listen("guide-program-hold", () => this.openLiveDetailsForProgram(this.focusedLiveProgramPosition()));
        this.$listen("live-details-focused", (position: number) => { this.liveDetailsOptionIndex = Number(position); });
        this.$listen("live-details-move", (delta: number) => this.focusLiveDetailsOption(Math.max(0, Math.min(1, this.liveDetailsOptionIndex + Number(delta)))));
        this.$listen("live-details-activate", () => this.activateLiveDetails());
        this.$listen("live-details-back", () => this.closeLiveDetails());
        this.$listen("settings-row-focused", (position: number) => {
          this.settingsSelectedIndex = Number(position);
          this.settingsFocusZone = "row";
          this.refreshSettingsPanel();
        });
        this.$listen("settings-row-move", (delta: number) => this.moveSettingsRow(Number(delta)));
        this.$listen("settings-row-left", () => this.openRail());
        this.$listen("settings-row-right", () => {
          if (this.settingsPage === "Settings" && this.settingsSelectedIndex === 0) this.focusSettingsProfile(0);
        });
        this.$listen("settings-row-activate", () => void this.activateSettingsRow());
        this.$listen("settings-profile-focused", (position: number) => { this.settingsProfileIndex = Number(position); this.settingsFocusZone = "profile"; });
        this.$listen("settings-profile-move", (delta: number) => this.moveSettingsProfile(Number(delta)));
        this.$listen("settings-profile-exit", () => this.focusSettingsRow(0));
        this.$listen("settings-profile-activate", () => void this.activateSettingsProfile());
        this.$listen("settings-choice-focused", (position: number) => { this.settingsChoiceIndex = this.settingsDialogView.start + Number(position); });
        this.$listen("settings-choice-move", (delta: number) => this.moveSettingsChoice(Number(delta)));
        this.$listen("settings-choice-activate", () => void this.activateSettingsChoice());
        this.$listen("settings-dialog-back", () => this.closeSettingsDialog());
        this.$listen("settings-back", () => this.backFromSettings());
        this.$listen("title-menu-focused", (position: number) => { this.titleMenuFocusIndex = Number(position); });
        this.$listen("title-menu-move", (delta: number) => this.moveTitleMenu(Number(delta)));
        this.$listen("title-menu-activate", () => void this.activateTitleMenu());
        this.$listen("title-menu-back", () => this.closeTitleMenu());
        this.$listen("title-action-move", (delta: number) =>
          Number(delta) < 0 && this.detailActionIndex === 0
            ? this.openRail()
            : this.focusTitleAction(Math.max(0, Math.min(3, this.detailActionIndex + Number(delta)))));
        this.$listen("title-episodes-enter", () => {
          if (this.detail.episodes.length) this.focusTitleEpisode(0);
        });
        this.$listen("title-actions-return", () => this.focusTitleAction(this.detailActionIndex));
        this.$listen("title-episode-move", (delta: number) => {
          const count = this.detail.episodes.length;
          if (count) this.focusTitleEpisode(Math.max(0, Math.min(count - 1, this.detailEpisodeIndex + Number(delta))));
        });
        this.$listen("title-action-activate", () => void this.activateTitleAction());
        this.$listen("title-action-hold", () => {
          if (this.phase === "detail" && this.detail.target) void this.openSources(this.detail.target, false);
        });
        this.$listen("title-episode-activate", () => {
          const episode = this.detail.episodes[this.detailEpisodeIndex]?.item;
          if (this.phase === "detail" && episode) void this.openSources(episode, false);
        });
        this.$listen("source-chip-move", (delta: number) => this.focusSourceChip(Math.max(0, Math.min(4, this.sourceChipIndex + Number(delta)))));
        this.$listen("source-chip-activate", (position: number) => this.chooseSourceQuality(Number(position)));
        this.$listen("source-provider-focus", () => this.focusSourceProvider());
        this.$listen("source-chip-restore", () => this.focusSourceChip(this.sourceChipIndex));
        this.$listen("source-rows-enter", () => this.focusSourceRow(0));
        this.$listen("source-provider-activate", () => this.openProviderPicker());
        this.$listen("provider-option-move", (delta: number) => this.moveProviderOption(Number(delta)));
        this.$listen("provider-option-activate", () => this.selectProviderOption());
        this.$listen("source-row-move", (delta: number) => this.moveSourceRow(Number(delta)));
        this.$listen("source-quality-step", (delta: number) => this.stepSourceQuality(Number(delta)));
        this.$listen("source-row-activate", () => this.selectSourceRow());
        this.$listen("source-row-hold", () => this.openSourceDetails());
        this.$listen("source-detail-close", () => this.closeSourceDetails());
        this.$listen("player-control-move", (delta: number) => this.focusPlayerControl(Math.max(0, Math.min(6, this.playerFocusIndex + Number(delta)))));
        this.$listen("player-timeline-focus", () => this.focusPlayerTimeline());
        this.$listen("player-controls-return", () => this.focusPlayerControl(this.playerFocusIndex));
        this.$listen("player-control-activate", () => void this.activatePlayerControl());
        this.$listen("player-seek-preview", (delta: number) => this.previewPlayerSeek(Number(delta)));
        this.$listen("player-seek-commit", () => void this.commitPlayerSeek());
        this.$listen("player-track-move", (delta: number) => this.moveTrackFocus(Number(delta)));
        this.$listen("player-track-activate", () => void this.selectTrackChoice());
        void session.dispatch({ Begin: {
          origin: api.serverOrigin,
          allowInsecurePreview: import.meta.env.DEV && api.serverOrigin === location.origin,
        } });
      },
      destroy() {
        ++pairingGeneration;
        pairingScope?.abort();
        homeScope?.abort();
        ++homeGeneration;
        detailScope?.abort();
        ++detailGeneration;
        discoverScope?.abort();
        ++discoverGeneration;
        libraryScope?.abort();
        ++libraryGeneration;
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        clearInterval(heartbeatTimer);
        clearTimeout(chromeTimer);
        ++playbackGeneration;
        void playback?.dispose().catch(() => undefined);
        document.getElementById("player-shade")?.style.setProperty("display", "none");
        clearTimeout(pairingTimer);
        disposeSession?.();
      },
    },
    methods: {
      async loadHome(profileId: string) {
        if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-start");
        const generation = ++homeGeneration;
        homeScope?.abort();
        homeScope = api.createScope();
        const selectedProfile = this.profiles.find(profile => profile.id === profileId);
        this.homeProfileAvatar = selectedProfile ? profileTileData(selectedProfile).image : "";
        this.railProfileName = selectedProfile?.name ?? "Profile";
        this.railCurrent = "home";
        this.currentProfileId = profileId;
        this.homeNotice = "";
        this.phase = "ready";
        this.startingLabel = "Starting VIPTV…";
        try {
          const view = await loadHomeView(api, profileId, homeScope.signal);
          if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-data");
          if (generation !== homeGeneration || homeScope.signal.aborted) return;
          this.phase = "home";
          if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-phase");
          setTimeout(() => {
            if (generation !== homeGeneration) return;
            this.homeAddLabel = view.saved ? "✓" : "+";
            this.homeShelfLabel = "Continue watching";
            this.okLabel = "OK";
            this.selectLabel = "Select";
            this.optionsIcon = "≡";
            this.optionsLabel = "Options";
            this.home = view;
            this.homeCards = Array.from({ length: 6 }, (_, index) => view.cards[index] ?? { ...emptyHomeCard });
            this.revealHomeControls();
            this.focusHomeAction(0);
            if (new URLSearchParams(location.search).has("perfdebug")) performance.mark("viptv:home-focus-request");
          }, 16);
          void enrichHomeHero(api, view, homeScope.signal).then(enriched => {
            if (generation === homeGeneration && !homeScope?.signal.aborted) this.home = enriched;
          }).catch(() => { /* Packaged queue metadata remains usable. */ });
        } catch (cause) {
          if (generation !== homeGeneration || homeScope.signal.aborted) return;
          this.error = cause instanceof Error ? cause.message : "Could not load Home.";
          this.phase = "error";
        }
      },
      revealHomeControls() {
        for (let index = 0; index < 3; index++)
          (this.$select(`heroAction${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < 6; index++)
          (this.$select(`homeCard${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusHomeAction(index: number) {
        this.homeFocusZone = "action";
        this.homeActionIndex = index;
        this.$select(`heroAction${index}`)?.$focus();
      },
      moveHomeAction(position: number, delta: number) {
        if (delta < 0 && this.homeActionIndex === 0) { this.openRail(); return; }
        this.focusHomeAction(Math.max(0, Math.min(2, this.homeActionIndex + delta)));
      },
      focusHomeCard(index: number) {
        this.homeFocusZone = "card";
        this.homeCardIndex = index;
        this.$select(`homeCard${index}`)?.$focus();
      },
      moveHomeCard(position: number, delta: number) {
        const count = this.home.cards.length;
        if (!count) return;
        if (delta < 0 && this.homeCardIndex === 0) { this.openRail(); return; }
        this.focusHomeCard(Math.max(0, Math.min(count - 1, this.homeCardIndex + delta)));
      },
      openRail() {
        if (this.phase !== "home" && this.phase !== "detail" && this.phase !== "discover" && this.phase !== "library" && this.phase !== "search" && this.phase !== "live" && this.phase !== "settings") return;
        this.railReturnZone = this.phase === "home" ? this.homeFocusZone
          : this.phase === "discover" ? this.discoverFocusZone
          : this.phase === "library" ? this.libraryFocusZone
          : this.phase === "search" ? this.searchFocusZone === "key" ? "key" : "result"
          : this.phase === "live" ? this.liveFocusZone : this.phase === "settings" ? this.settingsFocusZone : this.detailFocusZone;
        this.railReturnIndex = this.phase === "home"
          ? this.homeFocusZone === "card" ? this.homeCardIndex : this.homeActionIndex
          : this.phase === "discover" ? this.discoverFocusZone === "card" ? this.discoverCardIndex : this.discoverChipIndex
          : this.phase === "library" ? this.libraryFocusZone === "card" ? this.libraryCardIndex : this.librarySegmentIndex
          : this.phase === "search" ? this.searchFocusZone === "key" ? this.searchKeyIndex : this.searchResultIndex
          : this.phase === "live" ? this.liveFocusZone === "filter" ? this.liveFilterIndex : this.liveFocusZone === "program" ? this.liveProgramPosition : this.liveSelectedRow
          : this.phase === "settings" ? this.settingsFocusZone === "profile" ? this.settingsProfileIndex : this.settingsSelectedIndex
          : this.detailFocusZone === "episode" ? this.detailEpisodeIndex : this.detailActionIndex;
        this.railExpanded = true;
        this.railNotice = "";
        this.focusRail(this.railCurrent === "search" ? 1 : this.railCurrent === "discover" ? 3 : this.railCurrent === "live" ? 4 : this.railCurrent === "library" ? 5 : this.railCurrent === "settings" ? 6 : 2);
        setTimeout(() => {
          if (!this.railExpanded) return;
          for (let index = 0; index < 7; index++)
            (this.$select(`rail${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 0);
      },
      focusRail(index: number) {
        this.railFocusIndex = index;
        this.$select(`rail${index}`)?.$focus();
      },
      moveRail(delta: number) {
        this.focusRail(Math.max(0, Math.min(6, this.railFocusIndex + delta)));
      },
      closeRail() {
        if (!this.railExpanded) return;
        this.railExpanded = false;
        this.railNotice = "";
        if (this.phase === "home") {
          if (this.railReturnZone === "card") this.focusHomeCard(this.railReturnIndex);
          else this.focusHomeAction(this.railReturnIndex);
        } else if (this.phase === "detail") {
          if (this.railReturnZone === "episode") this.focusTitleEpisode(this.railReturnIndex);
          else this.focusTitleAction(this.railReturnIndex);
        } else if (this.phase === "discover") {
          if (this.railReturnZone === "chip") this.focusDiscoverChip(this.railReturnIndex);
          else this.focusDiscoverCard(this.railReturnIndex);
        } else if (this.phase === "library") {
          if (this.railReturnZone === "segment") this.focusLibrarySegment(this.railReturnIndex);
          else this.focusLibraryCard(this.railReturnIndex);
        } else if (this.phase === "search") {
          if (this.railReturnZone === "result") this.focusSearchResult(this.railReturnIndex);
          else this.focusSearchKey(this.railReturnIndex);
        } else if (this.phase === "live") {
          if (this.railReturnZone === "filter") this.focusLiveFilter(this.railReturnIndex);
          else if (this.railReturnZone === "program") this.focusLiveProgram(this.railReturnIndex);
          else this.focusLiveChannel(this.railReturnIndex);
        } else if (this.phase === "settings") {
          if (this.railReturnZone === "profile") this.focusSettingsProfile(this.railReturnIndex);
          else this.focusSettingsRow(this.railReturnIndex);
        }
      },
      activateRail() {
        if (!this.railExpanded) return;
        if (this.railFocusIndex === 0) {
          this.railExpanded = false;
          this.showProfiles(this.profiles);
        } else if (this.railFocusIndex === 2) {
          if (this.phase === "home") this.closeRail();
          else this.goHomeFromRail();
        } else if (this.railFocusIndex === 1) {
          if (this.phase === "search") this.closeRail();
          else {
            this.searchReturnPhase = this.phase === "discover" ? "discover" : this.phase === "library" ? "library" : "home";
            this.searchReturnZone = this.railReturnZone === "chip" ? "chip" : this.railReturnZone === "segment" ? "segment" : this.railReturnZone === "card" ? "card" : "action";
            this.searchReturnIndex = this.railReturnIndex;
            void this.openSearch();
          }
        } else if (this.railFocusIndex === 3) {
          if (this.phase === "discover") this.closeRail();
          else {
            if (this.phase === "home") {
              this.discoverReturnPhase = "home";
              this.discoverReturnZone = this.railReturnZone === "card" ? "card" : "action";
              this.discoverReturnIndex = this.railReturnIndex;
            } else if (this.phase === "library") {
              this.discoverReturnPhase = "library";
              this.discoverReturnZone = this.railReturnZone === "segment" ? "segment" : "card";
              this.discoverReturnIndex = this.railReturnIndex;
            } else if (this.phase === "search") {
              this.discoverReturnPhase = "search";
              this.discoverReturnZone = this.railReturnZone === "result" ? "result" : "key";
              this.discoverReturnIndex = this.railReturnIndex;
            }
            void this.openDiscover();
          }
        } else if (this.railFocusIndex === 5) {
          if (this.phase === "library") this.closeRail();
          else {
            this.libraryReturnPhase = this.phase === "search" ? "search" : this.phase === "discover" ? "discover" : "home";
            this.libraryReturnZone = this.railReturnZone === "result" ? "result" : this.railReturnZone === "key" ? "key" : this.railReturnZone === "chip" ? "chip" : this.railReturnZone === "card" ? "card" : "action";
            this.libraryReturnIndex = this.railReturnIndex;
            void this.openLibrary();
          }
        } else if (this.railFocusIndex === 4) {
          if (this.phase === "live") this.closeRail();
          else {
            this.liveReturnPhase = this.phase === "search" ? "search" : this.phase === "discover" ? "discover" : this.phase === "library" ? "library" : "home";
            this.liveReturnZone = this.railReturnZone === "result" ? "result" : this.railReturnZone === "key" ? "key" : this.railReturnZone === "chip" ? "chip" : this.railReturnZone === "segment" ? "segment" : this.railReturnZone === "card" ? "card" : "action";
            this.liveReturnIndex = this.railReturnIndex;
            void this.openLive();
          }
        } else if (this.railFocusIndex === 6) {
          if (this.phase === "settings") this.closeRail();
          else {
            this.settingsReturnPhase = this.phase === "search" ? "search" : this.phase === "discover" ? "discover" : this.phase === "library" ? "library" : this.phase === "live" ? "live" : "home";
            this.settingsReturnZone = this.railReturnZone === "result" ? "result" : this.railReturnZone === "key" ? "key" : this.railReturnZone === "filter" ? "filter" : this.railReturnZone === "program" ? "program" : this.railReturnZone === "channel" ? "channel" : this.railReturnZone === "chip" ? "chip" : this.railReturnZone === "segment" ? "segment" : this.railReturnZone === "card" ? "card" : "action";
            this.settingsReturnIndex = this.railReturnIndex;
            void this.openSettings();
          }
        }
      },
      goHomeFromRail() {
        discoverScope?.abort(); ++discoverGeneration;
        libraryScope?.abort(); ++libraryGeneration;
        searchScope?.abort(); ++searchGeneration; clearTimeout(searchTimer);
        liveScope?.abort(); ++liveGeneration; clearInterval(liveClockTimer);
        settingsScope?.abort(); ++settingsGeneration;
        detailScope?.abort(); ++detailGeneration;
        this.railExpanded = false;
        this.railCurrent = "home";
        this.phase = "home";
        setTimeout(() => {
          this.revealHomeControls();
          if (this.homeFocusZone === "card") this.focusHomeCard(this.homeCardIndex);
          else this.focusHomeAction(this.homeActionIndex);
        }, 0);
      },
      async openDiscover() {
        if (this.phase === "library") {
          libraryScope?.abort();
          ++libraryGeneration;
        }
        if (this.phase === "search") { searchScope?.abort(); ++searchGeneration; clearTimeout(searchTimer); }
        const generation = ++discoverGeneration;
        discoverScope?.abort();
        const scope = api.createScope();
        discoverScope = scope;
        this.railExpanded = false;
        this.railCurrent = "discover";
        this.phase = "discover";
        this.discoverError = "";
        this.discoverBusy = true;
        setTimeout(() => {
          if (this.phase !== "discover") return;
          this.discoverHeading = "Discover";
          this.discoverOkLabel = "OK";
          this.discoverSelectLabel = "Select";
          this.discoverOptionsIcon = "≡";
          this.discoverOptionsLabel = "Options";
        }, 0);
        try {
          const available = await api.catalogs({ signal: scope.signal });
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverCatalogs = available;
          const previous = this.discoverCatalog;
          const selected = available.find(candidate => candidate.id === previous?.id && candidate.type === previous.type && candidate.addonId === previous.addonId)
            ?? initialCatalog(available);
          if (selected) void this.loadDiscoverCatalog(selected);
          else {
            this.discoverBusy = false;
            this.discoverError = "No catalogs are available. Add or enable a catalog addon in Settings.";
          }
        } catch (cause) {
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverBusy = false;
          this.discoverError = cause instanceof Error ? cause.message : "Unable to load catalogs.";
        }
      },
      async loadDiscoverCatalog(catalog: Catalog, values: Record<string, string> = catalogDefaults(catalog), skip = 0, focusCard = true) {
        if (skip) {
          const pageKey = `${catalog.addonId ?? ""}:${catalog.type}:${catalog.id}:${JSON.stringify(values)}@${skip}`;
          if (pageKey === discoverRequestedPage) return;
          discoverRequestedPage = pageKey;
        } else discoverRequestedPage = "";
        const generation = ++discoverGeneration;
        discoverScope?.abort();
        const scope = api.createScope();
        discoverScope = scope;
        this.discoverCatalog = catalog;
        this.discoverValues = values;
        const chips = discoverChips(this.discoverCatalogs, catalog, values);
        this.discoverChips = Array.from({ length: 12 }, (_, index) => chips[index] ?? { ...emptyDiscoverChip });
        if (!skip) {
          this.discoverItems = [];
          this.discoverWindowStart = 0;
          this.discoverCardIndex = 0;
          this.refreshDiscoverCards();
        }
        this.discoverError = "";
        const request = requestForCatalog(catalog, values, skip);
        if (!request) {
          this.discoverBusy = false;
          this.discoverError = "Choose the required filters to browse this catalog.";
          this.revealDiscoverChips();
          return;
        }
        this.discoverBusy = true;
        try {
          const page = await api.discover(request, { signal: scope.signal });
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverItems = skip
            ? [...this.discoverItems, ...page.items.filter(item => !this.discoverItems.some(old => old.type === item.type && old.id === item.id))]
            : [...page.items];
          this.discoverNextSkip = page.hasMore ? page.nextSkip ?? skip + page.items.length : null;
          this.discoverBusy = false;
          this.discoverError = this.discoverItems.length ? "" : "No titles yet";
          this.refreshDiscoverCards();
          this.revealDiscoverChips();
          if (!skip && focusCard) setTimeout(() => {
            if (generation === discoverGeneration && this.phase === "discover" && !this.discoverFilterOpen && !this.railExpanded)
              this.focusDiscoverCard(0);
          }, 60);
        } catch (cause) {
          if (generation !== discoverGeneration || scope.signal.aborted) return;
          this.discoverBusy = false;
          this.discoverError = cause instanceof Error ? cause.message : "Unable to load titles.";
          this.revealDiscoverChips();
        }
      },
      refreshDiscoverCards() {
        const visible = this.discoverItems.slice(this.discoverWindowStart, this.discoverWindowStart + 12);
        this.discoverCards = Array.from({ length: 12 }, (_, index) => visible[index] ? discoverCard(visible[index]) : { ...emptyDiscoverCard });
        setTimeout(() => {
          if (this.phase !== "discover") return;
          for (let index = 0; index < 12; index++)
            (this.$select("discoverScreen")?.$select(`discoverCard${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 0);
      },
      revealDiscoverChips() {
        setTimeout(() => {
          if (this.phase !== "discover") return;
          for (let index = 0; index < 12; index++)
            (this.$select("discoverScreen")?.$select(`discoverChip${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 0);
      },
      focusDiscoverChip(index: number) {
        this.discoverFocusZone = "chip";
        this.discoverChipIndex = index;
        this.$select("discoverScreen")?.$select(`discoverChip${index}`)?.$focus();
      },
      moveDiscoverChip(delta: number) {
        if (delta < 0 && this.discoverChipIndex === 0) { this.openRail(); return; }
        const last = Math.max(0, this.discoverChips.filter(chip => chip.visible).length - 1);
        this.focusDiscoverChip(Math.max(0, Math.min(last, this.discoverChipIndex + delta)));
      },
      focusDiscoverCard(index: number) {
        if (!this.discoverItems[index]) return;
        this.discoverFocusZone = "card";
        this.discoverCardIndex = index;
        const previousWindow = this.discoverWindowStart;
        if (index < this.discoverWindowStart) this.discoverWindowStart = Math.floor(index / 4) * 4;
        else if (index >= this.discoverWindowStart + 12) this.discoverWindowStart = (Math.floor(index / 4) - 2) * 4;
        noteDiscoverWindow(index, this.discoverWindowStart, this.discoverItems.length);
        if (this.discoverWindowStart !== previousWindow) this.refreshDiscoverCards();
        const local = index - this.discoverWindowStart;
        if (this.discoverWindowStart !== previousWindow)
          setTimeout(() => {
            this.$select("discoverScreen")?.$select(`discoverCard${local}`)?.$focus();
            noteFocus("discover-card", index);
          }, 0);
        else this.$select("discoverScreen")?.$select(`discoverCard${local}`)?.$focus();
      },
      moveDiscoverCard(direction: string) {
        const index = this.discoverCardIndex;
        if (direction === "left" && index % 4 === 0) { this.openRail(); return; }
        if (direction === "up" && index < 4) { this.focusDiscoverChip(Math.min(this.discoverChipIndex, Math.max(0, this.discoverChips.filter(chip => chip.visible).length - 1))); return; }
        const delta = direction === "left" ? -1 : direction === "right" ? 1 : direction === "up" ? -4 : 4;
        const next = index + delta;
        if (next >= 0 && next < this.discoverItems.length && (direction !== "right" || index % 4 !== 3)) this.focusDiscoverCard(next);
        if (direction === "down" && this.discoverNextSkip !== null && this.discoverItems.length - next < 8 && !this.discoverBusy && this.discoverCatalog)
          void this.loadDiscoverCatalog(this.discoverCatalog, this.discoverValues, this.discoverNextSkip);
      },
      activateDiscoverCard() {
        const item = this.discoverItems[this.discoverCardIndex];
        if (item) void this.openDetail(item);
      },
      async activateDiscoverChip() {
        const chip = this.discoverChips[this.discoverChipIndex];
        if (!chip?.visible) return;
        if (chip.kind === "group") {
          const first = catalogForGroup(this.discoverCatalogs, chip.value as ReturnType<typeof discoverTypeGroup>);
          if (first && chip.value !== discoverTypeGroup(this.discoverCatalog?.type ?? ""))
            void this.loadDiscoverCatalog(first, catalogDefaults(first), 0, false);
        } else if (chip.kind === "catalog") {
          const current = this.discoverCatalog;
          if (!current) return;
          const next = catalogsForGroup(this.discoverCatalogs, discoverTypeGroup(current.type))[Number(chip.value)];
          if (next && !sameCatalog(next, current)) void this.loadDiscoverCatalog(next, catalogDefaults(next), 0, false);
        } else this.openDiscoverFilter(chip.value);
      },
      openDiscoverFilter(name: string) {
        const filter = this.discoverCatalog && catalogFilters(this.discoverCatalog).find(candidate => candidate.name === name);
        if (!filter) return;
        if (!filter.options.length) {
          this.discoverError = "Text filters are not available yet.";
          return;
        }
        this.discoverFilterName = name;
        this.discoverFilterTitle = "";
        this.discoverFilterOkLabel = "";
        this.discoverFilterSelectLabel = "";
        this.discoverBackLabel = "";
        this.discoverCancelLabel = "";
        this.discoverFilterValue = this.discoverValues[name] || "Any";
        this.discoverFilterReturnChip = this.discoverChipIndex;
        this.discoverOptionLabels = Array.from({ length: 8 }, (_, index) => (filter.required ? [...filter.options, "Cancel"] : ["Any", ...filter.options, "Cancel"])[index] ?? "");
        this.discoverFilterOpen = true;
        noteDiscoverFilter(true);
        setTimeout(() => {
          if (!this.discoverFilterOpen) return;
          this.discoverFilterTitle = name === "genre" ? "Genre" : name.charAt(0).toUpperCase() + name.slice(1);
          this.discoverFilterOkLabel = "OK";
          this.discoverFilterSelectLabel = "Select";
          this.discoverBackLabel = "BACK";
          this.discoverCancelLabel = "Cancel";
          for (let index = 0; index < 8; index++)
            (this.$select(`discoverOption${index}`) as unknown as { reveal?: () => void })?.reveal?.();
          this.focusDiscoverOption(Math.max(0, this.discoverOptionLabels.indexOf(this.discoverFilterValue)));
        }, 0);
      },
      focusDiscoverOption(index: number) {
        this.discoverOptionIndex = index;
        this.$select(`discoverOption${index}`)?.$focus();
      },
      moveDiscoverOption(delta: number) {
        const last = Math.max(0, this.discoverOptionLabels.filter(Boolean).length - 1);
        this.focusDiscoverOption(Math.max(0, Math.min(last, this.discoverOptionIndex + delta)));
      },
      closeDiscoverFilter() {
        if (!this.discoverFilterOpen) return;
        this.discoverFilterOpen = false;
        noteDiscoverFilter(false);
        this.focusDiscoverChip(this.discoverFilterReturnChip);
      },
      async selectDiscoverOption() {
        const value = this.discoverOptionLabels[this.discoverOptionIndex];
        const catalog = this.discoverCatalog;
        if (!catalog || !value) return;
        if (value === "Cancel") { this.closeDiscoverFilter(); return; }
        const name = this.discoverFilterName;
        this.closeDiscoverFilter();
        void this.loadDiscoverCatalog(catalog, { ...this.discoverValues, [name]: value === "Any" ? "" : value }, 0, false);
      },
      returnFromDiscover() {
        discoverScope?.abort();
        ++discoverGeneration;
        this.discoverFilterOpen = false;
        this.railExpanded = false;
        this.railCurrent = this.discoverReturnPhase;
        this.phase = this.discoverReturnPhase;
        setTimeout(() => {
          if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.discoverReturnZone === "segment") this.focusLibrarySegment(this.discoverReturnIndex);
            else this.focusLibraryCard(this.discoverReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            if (this.discoverReturnZone === "result") this.focusSearchResult(this.discoverReturnIndex);
            else this.focusSearchKey(this.discoverReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.discoverReturnZone === "card") this.focusHomeCard(this.discoverReturnIndex);
            else this.focusHomeAction(this.discoverReturnIndex);
          }
        }, 0);
      },
      async openLibrary() {
        if (this.phase === "discover") {
          discoverScope?.abort();
          ++discoverGeneration;
        }
        if (this.phase === "search") { searchScope?.abort(); ++searchGeneration; clearTimeout(searchTimer); }
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        this.railExpanded = false;
        this.railCurrent = "library";
        this.phase = "library";
        this.libraryMode = "favorites";
        this.librarySegmentIndex = 0;
        this.libraryCardIndex = 0;
        this.libraryWindowStart = 0;
        this.libraryError = "";
        this.libraryBusy = true;
        this.libraryItems = [...this.home.favoriteItems];
        this.refreshLibraryCards();
        setTimeout(() => {
          if (this.phase !== "library") return;
          this.libraryHeading = "My List";
          this.libraryOkLabel = "OK";
          this.librarySelectLabel = "Select";
          this.libraryOptionsIcon = "≡";
          this.libraryOptionsLabel = "Options";
          this.revealLibrarySegments();
        }, 0);
        try {
          const favorites = await api.favorites(this.currentProfileId, { signal: scope.signal });
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryFavorites = favorites;
          this.libraryItems = favorites;
          noteLibraryState("favorites", favorites.length);
          this.libraryBusy = false;
          this.libraryError = favorites.length ? "" : "Your list is empty. Add titles with the + button.";
          this.refreshLibraryCards();
          setTimeout(() => {
            if (generation === libraryGeneration && this.phase === "library" && !this.railExpanded)
              if (favorites.length) this.focusLibraryCard(0);
              else this.focusLibrarySegment(0);
          }, 60);
        } catch (cause) {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryBusy = false;
          this.libraryError = cause instanceof Error ? cause.message : "Unable to load My List.";
          this.focusLibrarySegment(0);
        }
      },
      async loadLibraryQueue(offset = 0) {
        if (offset) {
          const pageKey = `${this.currentProfileId}@${offset}`;
          if (pageKey === libraryRequestedPage) return;
          libraryRequestedPage = pageKey;
        } else libraryRequestedPage = "";
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        this.libraryMode = "queue";
        this.libraryBusy = true;
        this.libraryError = "";
        if (!offset) {
          this.libraryWindowStart = 0;
          this.libraryCardIndex = 0;
          this.libraryItems = this.libraryQueueItems.length ? [...this.libraryQueueItems] : [...this.home.queueItems];
          this.refreshLibraryCards();
        }
        try {
          const page = await api.queue(this.currentProfileId, offset, { signal: scope.signal });
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryQueueItems = offset
            ? [...this.libraryQueueItems, ...page.items.filter(item => !this.libraryQueueItems.some(old => old.type === item.type && old.id === item.id))]
            : [...page.items];
          this.libraryItems = [...this.libraryQueueItems];
          noteLibraryState("queue", this.libraryItems.length);
          this.libraryNextOffset = page.nextOffset;
          this.libraryBusy = false;
          this.libraryError = this.libraryItems.length ? "" : "Nothing in progress. Titles you start watching appear here.";
          this.refreshLibraryCards();
        } catch (cause) {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.libraryBusy = false;
          this.libraryError = cause instanceof Error ? cause.message : "Unable to load Continue Watching.";
        }
      },
      async reloadLibraryFavorites(index: number) {
        const generation = ++libraryGeneration;
        libraryScope?.abort();
        const scope = api.createScope();
        libraryScope = scope;
        try {
          const favorites = await api.favorites(this.currentProfileId, { signal: scope.signal });
          if (generation !== libraryGeneration || scope.signal.aborted || this.phase !== "library") return;
          this.libraryFavorites = favorites;
          this.libraryItems = [...favorites];
          this.libraryWindowStart = 0;
          this.libraryCardIndex = Math.min(index, Math.max(0, favorites.length - 1));
          this.libraryError = favorites.length ? "" : "Your list is empty. Add titles with the + button.";
          noteLibraryState("favorites", favorites.length);
          this.refreshLibraryCards();
          setTimeout(() => {
            if (generation !== libraryGeneration || this.phase !== "library") return;
            if (favorites.length) this.focusLibraryCard(this.libraryCardIndex);
            else this.focusLibrarySegment(0);
          }, 40);
        } catch {
          if (generation !== libraryGeneration || scope.signal.aborted) return;
          this.focusLibraryCard(Math.min(index, Math.max(0, this.libraryItems.length - 1)));
        }
      },
      revealLibrarySegments() {
        for (let index = 0; index < 2; index++)
          (this.$select("libraryScreen")?.$select(`librarySegment${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      refreshLibraryCards() {
        const visible = this.libraryItems.slice(this.libraryWindowStart, this.libraryWindowStart + 12);
        this.libraryCards = Array.from({ length: 12 }, (_, index) => visible[index]
          ? libraryCard(visible[index], this.libraryMode === "queue") : { ...emptyDiscoverCard });
        setTimeout(() => {
          if (this.phase !== "library" && this.sourceReturnOrigin !== "library") return;
          for (let index = 0; index < 12; index++)
            (this.$select("libraryScreen")?.$select(`libraryCard${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 0);
      },
      focusLibrarySegment(index: number) {
        this.libraryFocusZone = "segment";
        this.librarySegmentIndex = index;
        this.$select("libraryScreen")?.$select(`librarySegment${index}`)?.$focus();
      },
      moveLibrarySegment(delta: number) {
        if (delta < 0 && this.librarySegmentIndex === 0) { this.openRail(); return; }
        this.focusLibrarySegment(Math.max(0, Math.min(1, this.librarySegmentIndex + delta)));
      },
      async activateLibrarySegment() {
        if (this.librarySegmentIndex === 1) void this.loadLibraryQueue();
        else {
          libraryScope?.abort();
          ++libraryGeneration;
          this.libraryMode = "favorites";
          this.libraryItems = [...this.libraryFavorites];
          noteLibraryState("favorites", this.libraryItems.length);
          this.libraryWindowStart = 0;
          this.libraryCardIndex = 0;
          this.libraryNextOffset = null;
          this.libraryError = this.libraryItems.length ? "" : "Your list is empty. Add titles with the + button.";
          this.refreshLibraryCards();
        }
      },
      focusLibraryCard(index: number) {
        if (!this.libraryItems[index]) return;
        this.libraryFocusZone = "card";
        this.libraryCardIndex = index;
        const previousWindow = this.libraryWindowStart;
        if (index < this.libraryWindowStart) this.libraryWindowStart = Math.floor(index / 4) * 4;
        else if (index >= this.libraryWindowStart + 12) this.libraryWindowStart = (Math.floor(index / 4) - 2) * 4;
        if (this.libraryWindowStart !== previousWindow) this.refreshLibraryCards();
        const local = index - this.libraryWindowStart;
        if (this.libraryWindowStart !== previousWindow)
          setTimeout(() => {
            this.$select("libraryScreen")?.$select(`libraryCard${local}`)?.$focus();
            noteFocus("library-card", index);
          }, 0);
        else this.$select("libraryScreen")?.$select(`libraryCard${local}`)?.$focus();
      },
      moveLibraryCard(direction: string) {
        const index = this.libraryCardIndex;
        if (direction === "left" && index % 4 === 0) { this.openRail(); return; }
        if (direction === "up" && index < 4) { this.focusLibrarySegment(this.librarySegmentIndex); return; }
        const delta = direction === "left" ? -1 : direction === "right" ? 1 : direction === "up" ? -4 : 4;
        const next = index + delta;
        if (next >= 0 && next < this.libraryItems.length && (direction !== "right" || index % 4 !== 3)) this.focusLibraryCard(next);
        if (direction === "down" && this.libraryMode === "queue" && this.libraryNextOffset !== null && this.libraryItems.length - next < 8 && !this.libraryBusy)
          void this.loadLibraryQueue(this.libraryNextOffset);
      },
      activateLibraryCard() {
        const item = this.libraryItems[this.libraryCardIndex];
        if (!item) return;
        const action = cardPresentation(item, this.libraryMode === "queue" ? "queue" : "catalog").primaryAction;
        if (action === "resume" || action === "next") void this.openSources(item, true);
        else if (action === "sources" || action === "play") void this.openSources(item, false);
        else void this.openDetail(item);
      },
      returnFromLibrary() {
        libraryScope?.abort();
        ++libraryGeneration;
        this.railExpanded = false;
        this.phase = this.libraryReturnPhase;
        this.railCurrent = this.libraryReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.libraryReturnZone === "chip") this.focusDiscoverChip(this.libraryReturnIndex);
            else this.focusDiscoverCard(this.libraryReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            if (this.libraryReturnZone === "result") this.focusSearchResult(this.libraryReturnIndex);
            else this.focusSearchKey(this.libraryReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.libraryReturnZone === "card") this.focusHomeCard(this.libraryReturnIndex);
            else this.focusHomeAction(this.libraryReturnIndex);
          }
        }, 0);
      },
      async openSearch() {
        if (this.phase === "discover") { discoverScope?.abort(); ++discoverGeneration; }
        if (this.phase === "library") { libraryScope?.abort(); ++libraryGeneration; }
        const generation = ++searchGeneration;
        searchScope?.abort();
        clearTimeout(searchTimer);
        const scope = api.createScope();
        searchScope = scope;
        this.railExpanded = false;
        this.railCurrent = "search";
        this.phase = "search";
        this.searchPlaceholder = "";
        this.searchQuery = "";
        this.searchCaretX = 218;
        this.searchRows = [];
        this.searchHeadings = [];
        this.searchCards = [];
        this.searchSectionOffsets = {};
        this.searchVerticalOffset = 0;
        this.searchStatus = "";
        this.searchBusy = false;
        this.searchPartial = false;
        noteSearchState("", 0, false, false);
        this.searchKeyIndex = 0;
        this.searchResultIndex = 0;
        setTimeout(() => {
          if (this.phase !== "search") return;
          this.searchHeading = "Search";
          this.searchPlaceholder = "Search movies and series";
          this.searchCaretX = searchCaretPosition(this.searchPlaceholder);
          this.searchStatus = "Find your next favorite.";
          this.searchOkLabel = "OK";
          this.searchTypeLabel = "Type";
          this.searchJumpIcon = "▶▶";
          this.searchJumpLabel = "Jump to results";
          this.searchBackLabel = "BACK";
          this.searchDeleteLabel = "Delete";
          this.revealSearchKeys();
          this.focusSearchKey(0);
        }, 60);
        try {
          const catalogs = await api.catalogs({ signal: scope.signal });
          if (generation === searchGeneration && !scope.signal.aborted) this.searchCatalogs = catalogs;
        } catch (cause) {
          if (generation === searchGeneration && !scope.signal.aborted)
            this.searchStatus = cause instanceof Error ? cause.message : "Unable to load searchable catalogs.";
        }
      },
      revealSearchKeys() {
        for (let index = 0; index < searchKeys.length; index++)
          (this.$select("searchScreen")?.$select(`searchKey${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      setSearchQuery(value: string) {
        const next = value.slice(0, 256);
        this.searchQuery = next;
        this.searchCaretX = searchCaretPosition(next || this.searchPlaceholder);
        const generation = ++searchGeneration;
        searchScope?.abort();
        clearTimeout(searchTimer);
        this.searchRows = [];
        this.searchHeadings = [];
        this.searchCards = [];
        this.searchSectionOffsets = {};
        this.searchVerticalOffset = 0;
        this.searchPartial = false;
        this.searchBusy = false;
        this.searchStatus = next.trim() ? "" : "Find your next favorite.";
        noteSearchState(next, 0, false, false);
        if (next.trim()) searchTimer = setTimeout(() => void this.runSearch(next.trim(), generation), 650);
      },
      async runSearch(query: string, generation: number) {
        const scope = api.createScope();
        searchScope = scope;
        this.searchBusy = true;
        this.searchStatus = "Searching…";
        noteSearchState(query, 0, true, false);
        const rows: SearchRow[] = [];
        let partial = false;
        try {
          const catalogs = this.searchCatalogs.length ? this.searchCatalogs : await api.catalogs({ signal: scope.signal });
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchCatalogs = catalogs;
          const searchable = catalogs.filter(catalog => catalog.supportsSearch).slice(0, 128);
          for (let index = 0; index < searchable.length; index += 3) {
            const pages = await Promise.all(searchable.slice(index, index + 3).map(async catalog => {
              try {
                const page = await api.discover({ type: catalog.type, catalog: catalog.id, addonId: catalog.addonId, search: query }, { signal: scope.signal });
                return { name: catalog.name, items: page.items.slice(0, 24), catalog } as SearchRow;
              } catch {
                partial = true;
                return { name: catalog.name, items: [], catalog } as SearchRow;
              }
            }));
            if (generation !== searchGeneration || scope.signal.aborted) return;
            rows.push(...pages);
            this.searchRows = [...rows];
            this.refreshSearchLayout();
          }
          try {
            const live = await api.live({ view: "us", search: query, limit: 80 }, { signal: scope.signal });
            if (generation !== searchGeneration || scope.signal.aborted) return;
            rows.push({ name: "Live TV", items: live.channels.slice(0, 24) });
          } catch { partial = true; }
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchRows = [...rows];
          this.searchPartial = partial;
          this.searchBusy = false;
          this.refreshSearchLayout();
          noteSearchState(query, this.searchCards.length, false, partial, true);
          this.searchStatus = this.searchHeadings.length
            ? partial ? "Some sources couldn't load." : ""
            : partial ? "No matching titles. Some sources couldn't load." : "No matching titles";
        } catch (cause) {
          if (generation !== searchGeneration || scope.signal.aborted) return;
          this.searchBusy = false;
          this.searchPartial = true;
          this.searchStatus = cause instanceof Error ? cause.message : "Search could not finish.";
          noteSearchState(query, this.searchCards.length, false, true, true);
        }
      },
      refreshSearchLayout() {
        const view = projectSearch(this.searchRows, this.searchSectionOffsets, this.searchVerticalOffset);
        this.searchHeadings = view.headings;
        this.searchCards = view.cards;
        setTimeout(() => {
          if (this.phase !== "search") return;
          for (let index = 0; index < this.searchCards.length; index++)
            (this.$select("searchScreen")?.$select(`searchCard${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 40);
      },
      focusSearchKey(index: number) {
        this.searchFocusZone = "key";
        this.searchKeyIndex = index;
        this.searchLastKeyIndex = index;
        this.$select("searchScreen")?.$select(`searchKey${index}`)?.$focus();
      },
      moveSearchKey(direction: string) {
        const index = this.searchKeyIndex;
        if (direction === "right" && ((index < 36 && index % 6 === 5) || index === 38) && this.searchCards.length) {
          this.focusSearchResult(0); return;
        }
        if (direction === "left" && ((index < 36 && index % 6 === 0) || index === 36)) { this.openRail(); return; }
        let next = index;
        if (index < 36) {
          if (direction === "left") next = Math.max(0, index - 1);
          else if (direction === "right") next = Math.min(35, index + 1);
          else if (direction === "up") next = Math.max(0, index - 6);
          else if (direction === "down") next = index >= 30 ? 36 + Math.floor((index % 6) / 2) : index + 6;
        } else {
          if (direction === "left") next = Math.max(36, index - 1);
          else if (direction === "right") next = Math.min(38, index + 1);
          else if (direction === "up") next = 30 + (index - 36) * 2;
        }
        this.focusSearchKey(next);
      },
      activateSearchKey() {
        const key = searchKeys[this.searchKeyIndex];
        if (!key) return;
        if (key.action === "character") this.setSearchQuery(this.searchQuery + key.label);
        else if (key.action === "space") this.setSearchQuery(this.searchQuery + " ");
        else if (key.action === "delete") this.setSearchQuery(this.searchQuery.slice(0, -1));
        else this.setSearchQuery("");
      },
      focusSearchResult(index: number) {
        const card = this.searchCards[index];
        if (!card) return;
        this.searchFocusZone = "result";
        this.searchResultIndex = index;
        const start = this.searchSectionOffsets[card.section] ?? 0;
        let nextStart = start;
        if (card.localIndex < start) nextStart = card.localIndex;
        else if (card.localIndex >= start + 3) nextStart = card.localIndex - 2;
        const vertical = card.sectionIndex > 1 ? (card.sectionIndex - 1) * 360 : 0;
        const changed = nextStart !== start || vertical !== this.searchVerticalOffset;
        if (changed) {
          this.searchSectionOffsets = { ...this.searchSectionOffsets, [card.section]: nextStart };
          this.searchVerticalOffset = vertical;
          this.refreshSearchLayout();
        }
        const focusWhenReady = (attempt: number) => {
          if (this.phase !== "search" || this.titleMenuOpen || this.searchFocusZone !== "result" || this.searchResultIndex !== index) return;
          const target = this.$select("searchScreen")?.$select(`searchCard${index}`) as unknown as { $focus?: () => void; focused?: boolean } | undefined;
          target?.$focus?.();
          if (attempt >= 18) return;
          setTimeout(() => {
            const current = this.$select("searchScreen")?.$select(`searchCard${index}`) as unknown as { focused?: boolean } | undefined;
            if (!current?.focused) focusWhenReady(attempt + 1);
          }, 50);
        };
        if (changed) setTimeout(() => focusWhenReady(0), 40);
        else focusWhenReady(0);
      },
      moveSearchResult(direction: string) {
        const current = this.searchCards[this.searchResultIndex];
        if (!current) return;
        if (direction === "left" && current.localIndex === 0) { this.focusSearchKey(this.searchLastKeyIndex); return; }
        let next = -1;
        if (direction === "left" || direction === "right")
          next = this.searchCards.findIndex(card => card.section === current.section && card.localIndex === current.localIndex + (direction === "left" ? -1 : 1));
        else {
          const targetSection = current.sectionIndex + (direction === "up" ? -1 : 1);
          const candidates = this.searchCards.map((card, index) => ({ card, index })).filter(entry => entry.card.sectionIndex === targetSection);
          next = candidates[Math.min(current.localIndex, candidates.length - 1)]?.index ?? -1;
        }
        if (next >= 0) this.focusSearchResult(next);
      },
      activateSearchResult() {
        const card = this.searchCards[this.searchResultIndex];
        if (!card) return;
        if (card.item.type === "live") void this.openSources(card.item, false);
        else void this.openDetail(card.item);
      },
      backFromSearch() {
        if (this.searchFocusZone === "key" && this.searchQuery) this.setSearchQuery(this.searchQuery.slice(0, -1));
        else this.returnFromSearch();
      },
      returnFromSearch() {
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        settingsScope?.abort();
        ++settingsGeneration;
        this.railExpanded = false;
        this.phase = this.searchReturnPhase;
        this.railCurrent = this.searchReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            if (this.searchReturnZone === "chip") this.focusDiscoverChip(this.searchReturnIndex);
            else this.focusDiscoverCard(this.searchReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            if (this.searchReturnZone === "segment") this.focusLibrarySegment(this.searchReturnIndex);
            else this.focusLibraryCard(this.searchReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.searchReturnZone === "card") this.focusHomeCard(this.searchReturnIndex);
            else this.focusHomeAction(this.searchReturnIndex);
          }
        }, 0);
      },
      async openLive() {
        if (this.phase === "discover") { discoverScope?.abort(); ++discoverGeneration; }
        if (this.phase === "library") { libraryScope?.abort(); ++libraryGeneration; }
        if (this.phase === "search") { searchScope?.abort(); ++searchGeneration; clearTimeout(searchTimer); }
        const generation = ++liveGeneration;
        liveScope?.abort();
        clearInterval(liveClockTimer);
        const scope = api.createScope();
        liveScope = scope;
        this.railExpanded = false;
        this.railCurrent = "live";
        this.phase = "live";
        this.liveChrome = { ...this.liveChrome, homeProfileAvatar: this.homeProfileAvatar };
        this.liveDetailsOpen = false;
        this.liveSearchOpen = false;
        liveSearchCanonicalQuery = "";
        this.liveSearchUppercase = false;
        this.liveNow = Date.now() / 1000;
        this.liveWindowStart = halfHour();
        this.liveFollowing = true;
        this.liveSelectedRow = 0;
        this.liveSelectedCellIndex = null;
        this.liveFocusZone = "channel";
        this.liveFilterId = "all";
        this.liveFilterIndex = 1;
        this.liveOffset = 0;
        liveCanonicalChannels = [];
        this.liveGuides = {};
        this.liveStatus = "Loading channels…";
        this.refreshLiveView();
        setTimeout(() => {
          if (this.phase !== "live") return;
          this.liveLabel = "LIVE";
          this.livePreviewLabel = "Live preview";
          this.liveOkLabel = "OK";
          this.liveWatchLabel = "Watch";
          this.liveOptionsIcon = "≡";
          this.liveDetailsLabel = "Details";
          this.liveChannelIcon = "▲ ▼";
          this.liveChannelsLabel = "Channels";
          this.liveTimeIcon = "◀ ▶";
          this.liveTimeLabel = "Time";
          this.revealLiveControls();
        }, 40);
        const [categoriesResult, channelsResult] = await Promise.allSettled([
          api.liveCategories("us", { signal: scope.signal }),
          api.live({ view: "us", offset: 0, limit: 40 }, { signal: scope.signal }),
        ]);
        if (generation !== liveGeneration || scope.signal.aborted) return;
        if (categoriesResult.status === "fulfilled") this.liveCategories = [...categoriesResult.value.categories];
        liveCanonicalFilters = liveFilters(this.liveCategories, "all");
        this.liveFilters = liveCanonicalFilters.map(filter => ({ ...filter }));
        if (channelsResult.status === "fulfilled") {
          liveCanonicalChannels = channelsResult.value.channels.map(channel => ({ ...channel }));
          this.liveTotal = channelsResult.value.total;
          this.liveStatus = liveCanonicalChannels.length ? "" : "No channels here yet. Choose another filter.";
          this.refreshLiveView();
          setTimeout(() => { if (generation === liveGeneration && this.phase === "live" && liveCanonicalChannels.length) this.focusLiveChannel(0); }, 70);
          void this.loadLiveGuides(generation, scope);
        } else {
          this.liveStatus = channelsResult.reason instanceof Error ? channelsResult.reason.message : "Unable to load channels.";
          this.refreshLiveView();
        }
        liveClockTimer = setInterval(() => {
          if (this.phase !== "live") return;
          this.liveNow = Date.now() / 1000;
          if (this.liveFollowing) this.liveWindowStart = halfHour();
          this.refreshLiveView();
        }, 30_000);
      },
      async loadLiveGuides(generation: number, scope: ReturnType<TvApi["createScope"]>) {
        const first = Math.max(0, this.liveSelectedRow - 3);
        const needed = liveCanonicalChannels.slice(first, first + 7).filter(channel => !this.liveGuides[channel.id]);
        const gathered: Record<string, Guide> = {};
        let cursor = 0;
        const worker = async () => {
          while (cursor < needed.length && !scope.signal.aborted) {
            const channel = needed[cursor++];
            try {
              const guide = await api.guide(channel.id, { signal: scope.signal });
              if (generation !== liveGeneration || scope.signal.aborted) return;
              gathered[channel.id] = guide;
            } catch { /* A channel still has an actionable no-guide block. */ }
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, needed.length) }, worker));
        if (generation === liveGeneration && !scope.signal.aborted && Object.keys(gathered).length) {
          this.liveGuides = { ...this.liveGuides, ...gathered };
          this.refreshLiveView();
        }
      },
      refreshLiveView() {
        const view = projectLiveGuide(liveCanonicalChannels, this.liveGuides, this.liveNow, this.liveWindowStart,
          this.liveSelectedRow, this.liveSelectedCellIndex, this.liveOffset);
        liveCanonicalRows = view.channels;
        liveCanonicalPrograms = view.programs;
        this.liveRows = view.channels.map(row => ({ ...row, channel: { ...row.channel } }));
        this.livePrograms = view.programs.map(block => ({ ...block, channel: { ...block.channel } }));
        this.liveTimeline = view.timeline;
        this.liveHero = view.hero;
        this.liveNowX = view.nowX;
        this.liveNowLabel = view.nowLabel;
        liveCanonicalFilters = liveFilters(this.liveCategories, this.liveFilterId);
        this.liveFilters = liveCanonicalFilters.map(filter => ({ ...filter }));
        noteLiveState(this.liveSelectedRow, this.liveSelectedCellIndex, liveCanonicalChannels.length, liveCanonicalPrograms.length,
          this.liveFilterId, this.liveWindowStart, this.liveNowX);
        setTimeout(() => { if (this.phase === "live") this.revealLiveControls(); }, 40);
      },
      revealLiveControls() {
        const screen = this.$select("liveScreen");
        for (let index = 0; index < liveCanonicalFilters.length; index++)
          (screen?.$select(`liveFilter${liveCanonicalFilters[index].id}`) as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < liveCanonicalRows.length; index++)
          (screen?.$select(`liveChannel${liveCanonicalRows[index].channel.id}`) as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < liveCanonicalPrograms.length; index++)
          (screen?.$select(`liveProgram${liveCanonicalPrograms[index].id}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusLiveFilter(index: number) {
        ++liveFocusGeneration;
        this.liveFocusZone = "filter";
        this.liveFilterIndex = index;
        const filter = liveCanonicalFilters[index];
        if (!filter) return;
        const focusWhenReady = (attempt: number) => {
          if (this.phase !== "live" || this.liveDetailsOpen || this.liveFocusZone !== "filter" || this.liveFilterIndex !== index) return;
          const target = this.$select("liveScreen")?.$select(`liveFilter${filter.id}`) as unknown as { $focus?: () => void } | undefined;
          if (target) { target.$focus?.(); return; }
          if (attempt < 12) setTimeout(() => focusWhenReady(attempt + 1), 50);
        };
        focusWhenReady(0);
      },
      moveLiveFilter(delta: number) {
        if (delta < 0 && this.liveFilterIndex === 0) { this.openRail(); return; }
        this.focusLiveFilter(Math.max(0, Math.min(liveCanonicalFilters.length - 1, this.liveFilterIndex + delta)));
      },
      async activateLiveFilter() {
        const filter = liveCanonicalFilters[this.liveFilterIndex];
        if (!filter) return;
        if (filter.id === "search") { this.openLiveSearch(); return; }
        if (filter.id === this.liveFilterId) return;
        void this.loadLiveFilter(filter.id);
      },
      openLiveSearch() {
        this.liveSearchOpen = true;
        this.liveSearchKeyIndex = 0;
        if (liveSearchPhysicalListener) window.removeEventListener("keydown", liveSearchPhysicalListener, true);
        liveSearchPhysicalListener = (event: KeyboardEvent) => {
          if (!this.liveSearchOpen) return;
          if (event.key.length === 1 && /^[a-z0-9 :/._@-]$/i.test(event.key))
            this.setLiveSearchQuery(liveSearchCanonicalQuery + event.key);
          else if (event.key === "Backspace") this.setLiveSearchQuery(liveSearchCanonicalQuery.slice(0, -1));
          else return;
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        window.addEventListener("keydown", liveSearchPhysicalListener, true);
        setTimeout(() => {
          if (!this.liveSearchOpen) return;
          const screen = this.$select("liveSearchScreen") as unknown as { reveal?: () => void; setQuery?: (query: string) => void } | undefined;
          screen?.reveal?.();
          screen?.setQuery?.(liveSearchCanonicalQuery);
          for (const key of liveSearchKeys)
            (this.$select("liveSearchScreen")?.$select(`liveSearchKey${key.id}`) as unknown as { reveal?: () => void })?.reveal?.();
          this.focusLiveSearchKey(0);
        }, 60);
      },
      closeLiveSearch() {
        if (!this.liveSearchOpen) return;
        this.stopLiveSearchInput();
        this.liveSearchOpen = false;
        setTimeout(() => { if (this.phase === "live" && !this.liveSearchOpen) this.focusLiveFilter(0); }, 40);
      },
      stopLiveSearchInput() {
        if (liveSearchPhysicalListener) window.removeEventListener("keydown", liveSearchPhysicalListener, true);
        liveSearchPhysicalListener = null;
      },
      setLiveSearchQuery(value: string) {
        liveSearchCanonicalQuery = value.slice(0, 128);
        (this.$select("liveSearchScreen") as unknown as { setQuery?: (query: string) => void })?.setQuery?.(liveSearchCanonicalQuery);
        setTimeout(() => { if (this.liveSearchOpen) this.focusLiveSearchKey(this.liveSearchKeyIndex); }, 0);
      },
      focusLiveSearchKey(index: number) {
        const key = liveSearchKeys[index];
        if (!key) return;
        this.liveSearchKeyIndex = index;
        const target = this.$select("liveSearchScreen")?.$select(`liveSearchKey${key.id}`) as unknown as { $focus?: () => void; restoreFocus?: () => void } | undefined;
        target?.$focus?.();
        target?.restoreFocus?.();
      },
      moveLiveSearchKey(direction: string) {
        const key = liveSearchKeys[this.liveSearchKeyIndex];
        if (!key) return;
        const row = liveSearchKeys.filter(candidate => candidate.y === key.y);
        const local = row.findIndex(candidate => candidate.id === key.id);
        if (direction === "left" || direction === "right") {
          const target = row[Math.max(0, Math.min(row.length - 1, local + (direction === "left" ? -1 : 1)))];
          this.focusLiveSearchKey(liveSearchKeys.findIndex(candidate => candidate.id === target.id));
        } else {
          const y = [...new Set(liveSearchKeys.map(candidate => candidate.y))]
            .filter(candidate => direction === "up" ? candidate < key.y : candidate > key.y)
            .sort((a, b) => Math.abs(a - key.y) - Math.abs(b - key.y))[0];
          const other = liveSearchKeys.filter(candidate => candidate.y === y);
          if (!other.length) return;
          const center = key.x + key.width / 2;
          const target = other.reduce((best, candidate) =>
            Math.abs(candidate.x + candidate.width / 2 - center) < Math.abs(best.x + best.width / 2 - center) ? candidate : best);
          this.focusLiveSearchKey(liveSearchKeys.findIndex(candidate => candidate.id === target.id));
        }
      },
      activateLiveSearchKey() {
        const key = liveSearchKeys[this.liveSearchKeyIndex];
        if (!key) return;
        if (key.action === "cancel") { this.closeLiveSearch(); return; }
        if (key.action === "done") { this.stopLiveSearchInput(); this.liveSearchOpen = false; void this.loadLiveFilter(this.liveFilterId, 0, 0); return; }
        if (key.action === "delete") { this.setLiveSearchQuery(liveSearchCanonicalQuery.slice(0, -1)); return; }
        if (key.action === "space") { this.setLiveSearchQuery(liveSearchCanonicalQuery + " "); return; }
        if (key.action === "case") {
          this.liveSearchUppercase = !this.liveSearchUppercase;
          this.liveSearchView = { keys: liveSearchKeys.map(entry => ({
            ...entry, label: this.liveSearchUppercase && entry.action === "character" ? entry.label.toUpperCase() : entry.label,
          })) };
          setTimeout(() => {
            for (const entry of liveSearchKeys)
              (this.$select("liveSearchScreen")?.$select(`liveSearchKey${entry.id}`) as unknown as { reveal?: () => void })?.reveal?.();
            this.focusLiveSearchKey(this.liveSearchKeyIndex);
          }, 30);
          return;
        }
        this.setLiveSearchQuery(liveSearchCanonicalQuery + (this.liveSearchUppercase ? key.label.toUpperCase() : key.label));
      },
      async loadLiveFilter(filterId: string, offset = 0, focusRow = 0) {
        const generation = ++liveGeneration;
        liveScope?.abort();
        const scope = api.createScope();
        liveScope = scope;
        this.liveFilterId = filterId;
        this.liveSelectedRow = focusRow;
        this.liveSelectedCellIndex = null;
        this.liveOffset = offset;
        liveCanonicalChannels = [];
        this.liveGuides = {};
        this.liveStatus = "Loading channels…";
        this.refreshLiveView();
        const collection = filterId === "favorites" || filterId === "recent" ? filterId : undefined;
        const category = filterId.startsWith("category:") ? filterId.slice(9) : undefined;
        try {
          const page = await api.live({ view: "us", collection, category, search: liveSearchCanonicalQuery.trim() || undefined, offset, limit: PAGE_SIZE }, { signal: scope.signal });
          if (generation !== liveGeneration || scope.signal.aborted) return;
          liveCanonicalChannels = page.channels.map(channel => ({ ...channel }));
          this.liveSelectedRow = Math.max(0, Math.min(focusRow, liveCanonicalChannels.length - 1));
          this.liveTotal = page.total;
          this.liveStatus = page.channels.length ? "" : "No channels here yet. Choose another filter.";
          this.refreshLiveView();
          setTimeout(() => {
            if (generation !== liveGeneration || this.phase !== "live") return;
            if (liveCanonicalChannels.length) this.focusLiveChannel(this.liveSelectedRow);
            else this.focusLiveFilter(this.liveFilterIndex);
          }, 60);
          void this.loadLiveGuides(generation, scope);
        } catch (cause) {
          if (generation !== liveGeneration || scope.signal.aborted) return;
          this.liveStatus = cause instanceof Error ? cause.message : "Unable to load channels.";
          this.refreshLiveView();
        }
      },
      focusLiveChannel(row: number) {
        if (!liveCanonicalChannels[row]) return;
        ++liveFocusGeneration;
        const previous = liveCanonicalRows.findIndex(value => value.row === row);
        this.liveSelectedRow = row;
        this.liveSelectedCellIndex = null;
        this.liveFocusZone = "channel";
        if (previous < 0) this.refreshLiveView();
        const visible = liveCanonicalRows.find(value => value.row === row);
        if (!visible) return;
        const focus = () => this.$select("liveScreen")?.$select(`liveChannel${visible.channel.id}`)?.$focus();
        if (previous < 0) setTimeout(focus, 50);
        else focus();
        void this.loadLiveGuides(liveGeneration, liveScope!);
      },
      moveLiveChannel(delta: number) {
        const next = this.liveSelectedRow + delta;
        if (next < 0) {
          if (this.liveOffset > 0) void this.loadLiveFilter(this.liveFilterId, Math.max(0, this.liveOffset - PAGE_SIZE), PAGE_SIZE - 1);
          else this.focusLiveFilter(this.liveFilterIndex);
          return;
        }
        if (next < liveCanonicalChannels.length) this.focusLiveChannel(next);
        else if (this.liveOffset + liveCanonicalChannels.length < this.liveTotal)
          void this.loadLiveFilter(this.liveFilterId, this.liveOffset + PAGE_SIZE, 0);
      },
      enterLiveProgram(row: number) {
        const current = liveCanonicalPrograms.findIndex(block => block.row === row && block.cell.start <= this.liveNow && block.cell.end > this.liveNow);
        const index = current >= 0 ? current : liveCanonicalPrograms.findIndex(block => block.row === row);
        if (index >= 0) this.focusLiveProgram(index);
      },
      focusLiveProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (!block) return;
        ++liveFocusGeneration;
        this.liveFocusZone = "program";
        this.liveProgramPosition = position;
        this.$select("liveScreen")?.$select(`liveProgram${block.id}`)?.$focus();
      },
      focusedLiveProgramPosition() {
        return liveCanonicalPrograms.findIndex(block => block.row === this.liveSelectedRow && block.index === this.liveSelectedCellIndex);
      },
      moveLiveProgram(_position: number, direction: string) {
        // Blits may reuse a focused For child after its row reprojects, leaving
        // its positional prop stale. The focused row/cell identity is current.
        const block = liveCanonicalPrograms[this.focusedLiveProgramPosition()];
        if (!block) return;
        if (direction === "left" && block.index === 0) {
          if (!this.moveLiveWindow(-1, block.row, this.liveWindowStart - 1)) this.focusLiveChannel(block.row);
          return;
        }
        if (direction === "left" || direction === "right") {
          const next = liveCanonicalPrograms.findIndex(candidate => candidate.row === block.row && candidate.index === block.index + (direction === "left" ? -1 : 1));
          if (next >= 0) this.focusLiveProgram(next);
          else if (direction === "right") this.moveLiveWindow(1, block.row,
            Math.min(halfHour() + DAY_SECONDS + WINDOW_SECONDS - 1, this.liveWindowStart + HOUR_SECONDS));
          return;
        }
        const row = block.row + (direction === "up" ? -1 : 1);
        if (row < 0) {
          if (this.liveOffset > 0) void this.loadLiveFilter(this.liveFilterId, Math.max(0, this.liveOffset - PAGE_SIZE), PAGE_SIZE - 1);
          else this.focusLiveFilter(this.liveFilterIndex);
          return;
        }
        if (!liveCanonicalChannels[row]) {
          if (direction === "down" && this.liveOffset + liveCanonicalChannels.length < this.liveTotal)
            void this.loadLiveFilter(this.liveFilterId, this.liveOffset + PAGE_SIZE, 0);
          return;
        }
        const at = Math.max(this.liveNow, block.cell.start);
        this.liveSelectedRow = row;
        this.refreshLiveView();
        const transition = ++liveFocusGeneration;
        setTimeout(() => {
          if (transition !== liveFocusGeneration || this.liveFocusZone !== "program") return;
          const next = liveCanonicalPrograms.findIndex(candidate => candidate.row === row && candidate.cell.start <= at && candidate.cell.end > at);
          if (next >= 0) this.focusLiveProgram(next);
          else this.focusLiveChannel(row);
        }, 40);
        void this.loadLiveGuides(liveGeneration, liveScope!);
      },
      moveLiveWindow(direction: -1 | 1, row: number, focusAt: number) {
        const minimum = halfHour();
        const next = Math.max(minimum, Math.min(minimum + DAY_SECONDS, this.liveWindowStart + direction * HOUR_SECONDS));
        if (next === this.liveWindowStart) return false;
        this.liveFollowing = false;
        this.liveWindowStart = next;
        this.refreshLiveView();
        const transition = ++liveFocusGeneration;
        setTimeout(() => {
          if (this.phase !== "live" || transition !== liveFocusGeneration || this.liveFocusZone !== "program") return;
          const target = liveCanonicalPrograms.findIndex(candidate => candidate.row === row && candidate.cell.start <= focusAt && candidate.cell.end > focusAt);
          if (target >= 0) this.focusLiveProgram(target);
          else this.focusLiveChannel(row);
        }, 50);
        return true;
      },
      activateLiveProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (!block) return;
        if (block.cell.start > this.liveNow) this.openLiveDetailsForProgram(position);
        else this.watchLiveChannel(block.row);
      },
      watchLiveChannel(row: number) {
        const channel = liveCanonicalChannels[row];
        if (channel) void this.openSources(channel, false);
      },
      openLiveDetailsForChannel(row: number) {
        const block = liveCanonicalPrograms.findIndex(candidate => candidate.row === row && candidate.airing);
        if (block >= 0) this.openLiveDetailsForProgram(block);
        else if (liveCanonicalChannels[row]) this.openLiveDetails(liveCanonicalChannels[row], undefined, "channel", row);
      },
      openLiveDetailsForProgram(position: number) {
        const block = liveCanonicalPrograms[position];
        if (block) this.openLiveDetails(block.channel, block.program, "program", position);
      },
      openLiveDetails(channel: MediaItem, program: Guide["programs"][number] | undefined, returnZone: "program" | "channel", index: number) {
        if (this.phase !== "live") return;
        const zone = guideZone(this.liveGuides[channel.id]?.timezone);
        this.liveDetailsChannelItem = channel;
        this.liveDetailsReturnZone = returnZone;
        this.liveDetailsReturnIndex = index;
        this.liveDetailsTitle = "";
        this.liveDetailsChannel = "";
        this.liveDetailsRange = "";
        this.liveDetailsDescription = "";
        this.liveDetailsOpen = true;
        setTimeout(() => {
          if (!this.liveDetailsOpen) return;
          this.liveDetailsTitle = program?.title || "Programme details";
          this.liveDetailsChannel = channel.name;
          this.liveDetailsRange = program ? `·  ${timeRange(program.start, program.end, zone)}` : "";
          this.liveDetailsDescription = program?.description || "No guide information. You can still watch this channel.";
          this.liveDetailsWatchLabel = "Watch channel now";
          this.liveDetailsCloseLabel = "Close";
          this.liveDetailsOkLabel = "OK";
          this.liveDetailsSelectLabel = "Select";
          this.liveDetailsBackLabel = "BACK";
          for (let slot = 0; slot < 2; slot++)
            (this.$select("liveDetailsScreen")?.$select(`liveDetailsOption${slot}`) as unknown as { reveal?: () => void })?.reveal?.();
          this.focusLiveDetailsOption(0);
        }, 50);
      },
      focusLiveDetailsOption(index: number) {
        this.liveDetailsOptionIndex = index;
        this.$select("liveDetailsScreen")?.$select(`liveDetailsOption${index}`)?.$focus();
      },
      closeLiveDetails(restore = true) {
        if (!this.liveDetailsOpen) return;
        this.liveDetailsOpen = false;
        if (!restore) return;
        const index = this.liveDetailsReturnIndex;
        const zone = this.liveDetailsReturnZone;
        setTimeout(() => {
          if (this.phase !== "live" || this.liveDetailsOpen) return;
          if (zone === "program") this.focusLiveProgram(index);
          else this.focusLiveChannel(index);
        }, 40);
      },
      activateLiveDetails() {
        if (!this.liveDetailsOpen) return;
        if (this.liveDetailsOptionIndex === 1) { this.closeLiveDetails(); return; }
        const row = this.liveDetailsReturnZone === "program"
          ? liveCanonicalPrograms[this.liveDetailsReturnIndex]?.row ?? this.liveSelectedRow
          : this.liveDetailsReturnIndex;
        this.closeLiveDetails(false);
        this.watchLiveChannel(row);
      },
      returnFromLive() {
        liveScope?.abort(); ++liveGeneration; clearInterval(liveClockTimer);
        this.stopLiveSearchInput();
        this.liveDetailsOpen = false;
        this.liveSearchOpen = false;
        this.railExpanded = false;
        this.phase = this.liveReturnPhase;
        this.railCurrent = this.liveReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips(); this.refreshDiscoverCards();
            if (this.liveReturnZone === "chip") this.focusDiscoverChip(this.liveReturnIndex);
            else this.focusDiscoverCard(this.liveReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments(); this.refreshLibraryCards();
            if (this.liveReturnZone === "segment") this.focusLibrarySegment(this.liveReturnIndex);
            else this.focusLibraryCard(this.liveReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            if (this.liveReturnZone === "result") this.focusSearchResult(this.liveReturnIndex);
            else this.focusSearchKey(this.liveReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.liveReturnZone === "card") this.focusHomeCard(this.liveReturnIndex);
            else this.focusHomeAction(this.liveReturnIndex);
          }
        }, 0);
      },
      async openSettings() {
        const generation = ++settingsGeneration;
        settingsScope?.abort();
        const scope = api.createScope();
        settingsScope = scope;
        this.railExpanded = false;
        this.railCurrent = "settings";
        this.phase = "settings";
        this.settingsPage = "Settings";
        this.settingsSelectedIndex = 0;
        this.settingsFocusZone = "row";
        this.settingsDialogOpen = false;
        this.settingsPrefs = defaultSettingsPreferences;
        this.settingsAddons = [];
        this.refreshSettingsView();
        setTimeout(() => {
          if (this.phase !== "settings" || generation !== settingsGeneration) return;
          this.refreshSettingsView();
          this.revealSettingsControls();
          this.focusSettingsRow(0);
        }, 70);
        const [preferences, addons] = await Promise.allSettled([
          api.preferences(this.currentProfileId, { signal: scope.signal }),
          api.addons({ signal: scope.signal }),
        ]);
        if (generation !== settingsGeneration || scope.signal.aborted || this.phase !== "settings") return;
        if (preferences.status === "fulfilled") this.settingsPrefs = preferences.value;
        if (addons.status === "fulfilled") this.settingsAddons = [...addons.value];
        this.refreshSettingsView();
      },
      refreshSettingsView() {
        settingsCanonicalRows = settingsRows(this.settingsPage, this.settingsPrefs, this.settingsAddons, api.serverOrigin, packageInfo.version);
        const rows = Array.from({ length: 6 }, (_, index) => settingsCanonicalRows[index] ? { ...settingsCanonicalRows[index] } : { ...emptySettingsRow });
        const profiles = settingsProfiles(this.profiles, this.currentProfileId);
        this.settingsRowsCount = Math.min(6, settingsCanonicalRows.length);
        this.settingsView = {
          page: this.settingsPage,
          rows,
          profiles: Array.from({ length: 4 }, (_, index) => profiles[index] ? { ...profiles[index] } : { ...emptySettingsProfile }),
          showProfiles: this.settingsPage === "Settings" && this.settingsSelectedIndex === 0,
          avatar: this.homeProfileAvatar,
          railSearch: this.railSearch, railHome: this.railHomeUnselected,
          railDiscover: this.railDiscover, railLive: this.railLive,
          railList: this.railList, railSettings: railIcon("settings", true),
          version: `VIPTV ${packageInfo.version}`,
        };
        this.refreshSettingsPanel();
        setTimeout(() => { if (this.phase === "settings") this.revealSettingsControls(); }, 50);
      },
      refreshSettingsPanel() {
        const row = settingsCanonicalRows[this.settingsSelectedIndex];
        if (!row) return;
        this.settingsPanel = {
          title: row.title,
          description: row.description,
          caption: this.settingsPage === "Playback preferences"
            ? "Applies to your next playback. Manual track choices take priority."
            : this.settingsPage === "Addons"
              ? "Shared by all profiles and devices on your account." : "",
        };
        const showProfiles = this.settingsPage === "Settings" && this.settingsSelectedIndex === 0;
        if (this.settingsView.showProfiles !== showProfiles)
          this.settingsView = { ...this.settingsView, showProfiles };
      },
      revealSettingsControls() {
        const screen = this.$select("settingsScreen");
        (screen as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < this.settingsRowsCount; index++)
          (screen?.$select(`settingsRow${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < Math.min(4, this.profiles.length); index++)
          (screen?.$select(`settingsProfile${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusSettingsRow(index: number) {
        if (!settingsCanonicalRows[index]) return;
        this.settingsSelectedIndex = index;
        this.settingsFocusZone = "row";
        this.refreshSettingsPanel();
        this.$select("settingsScreen")?.$select(`settingsRow${index}`)?.$focus();
      },
      moveSettingsRow(delta: number) {
        const next = Math.max(0, Math.min(this.settingsRowsCount - 1, this.settingsSelectedIndex + delta));
        this.focusSettingsRow(next);
      },
      focusSettingsProfile(index: number) {
        if (!this.profiles[index]) return;
        this.settingsProfileIndex = index;
        this.settingsFocusZone = "profile";
        this.$select("settingsScreen")?.$select(`settingsProfile${index}`)?.$focus();
      },
      moveSettingsProfile(delta: number) {
        const next = this.settingsProfileIndex + delta;
        if (next < 0) this.focusSettingsRow(0);
        else if (next < Math.min(4, this.profiles.length)) this.focusSettingsProfile(next);
      },
      async activateSettingsProfile() {
        const profile = this.profiles[this.settingsProfileIndex];
        if (!profile) return;
        try { await api.selectProfile(profile.id); }
        catch (cause) {
          this.settingsPanel = { ...this.settingsPanel, description: cause instanceof Error ? cause.message : "Could not open this profile." };
        }
      },
      async activateSettingsRow() {
        const row = settingsCanonicalRows[this.settingsSelectedIndex];
        if (!row) return;
        if (this.settingsPage === "Settings") {
          if (row.id === "settings-profiles") { this.showProfiles(this.profiles); return; }
          if (row.id === "settings-manage") { this.showProfiles(this.profiles); this.toggleManageProfiles(); return; }
          if (row.id === "settings-playback" || row.id === "settings-addons") {
            this.settingsPage = row.id === "settings-playback" ? "Playback preferences" : "Addons";
            this.settingsSelectedIndex = 0;
            this.refreshSettingsView();
            setTimeout(() => this.focusSettingsRow(0), 60);
            return;
          }
          if (row.id === "signout") this.openSettingsSignOut();
          return;
        }
        if (this.settingsPage === "Playback preferences") {
          const choice = settingsChoices(row.id, this.settingsPrefs);
          if (choice) this.openSettingsChoice(row.title, choice.key, choice.options);
        } else if (row.id === "addon-add") {
          this.settingsPanel = { ...this.settingsPanel, description: "Install addon text entry is not available in this preview yet." };
        } else {
          const addon = this.settingsAddons[this.settingsSelectedIndex - 1];
          if (addon) this.openSettingsAddonManage(addon);
        }
      },
      openSettingsAddonManage(addon: JsonObject) {
        this.settingsDialogAddon = addon;
        this.settingsDialogKind = "addonManage";
        settingsCanonicalChoices = [
          { label: addon.enabled === false ? "Enable" : "Disable", value: "toggle", current: false, visible: true },
          { label: "Remove addon", value: "remove-addon", current: false, visible: true },
          { label: "Cancel", value: "__cancel__", current: false, visible: true },
        ];
        this.settingsChoiceIndex = 0;
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog(`Manage ${String(addon.name ?? "Addon")}`);
        setTimeout(() => this.focusSettingsChoice(0), 60);
      },
      openSettingsAddonRemove() {
        const addon = this.settingsDialogAddon;
        if (!addon) return;
        this.settingsDialogKind = "addonRemove";
        settingsCanonicalChoices = [
          { label: "Cancel", value: "__cancel__", current: false, visible: true },
          { label: "Remove", value: "remove", current: false, visible: true },
        ];
        this.settingsChoiceIndex = 0;
        this.refreshSettingsDialog(`Remove ${String(addon.name ?? "Addon")}?`);
        setTimeout(() => this.focusSettingsChoice(0), 60);
      },
      openSettingsChoice(title: string, key: keyof PlaybackPreferences, choices: SettingsChoiceView[]) {
        this.settingsDialogKind = "choice";
        this.settingsDialogKey = key;
        settingsCanonicalChoices = [...choices, { label: "Cancel", value: "__cancel__", current: false, visible: true }];
        this.settingsChoiceIndex = Math.max(0, choices.findIndex(choice => choice.current));
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog(title);
        setTimeout(() => this.focusSettingsChoice(this.settingsChoiceIndex), 60);
      },
      openSettingsSignOut() {
        this.settingsDialogKind = "signout";
        settingsCanonicalChoices = [
          { label: "Sign out", value: "signout", current: false, visible: true },
          { label: "Cancel", value: "__cancel__", current: false, visible: true },
        ];
        this.settingsChoiceIndex = 1;
        this.settingsDialogOpen = true;
        this.refreshSettingsDialog("Sign out of this TV?");
        setTimeout(() => this.focusSettingsChoice(1), 60);
      },
      refreshSettingsDialog(title: string) {
        const start = Math.max(0, Math.min(this.settingsChoiceIndex - 3, settingsCanonicalChoices.length - 8));
        this.settingsDialogView = {
          title,
          choices: Array.from({ length: 8 }, (_, index) => settingsCanonicalChoices[start + index] ? { ...settingsCanonicalChoices[start + index] } : { ...emptySettingsChoice }),
          start,
          signout: this.settingsDialogKind === "signout",
        };
        setTimeout(() => {
          if (!this.settingsDialogOpen) return;
          (this.$select("settingsScreen")?.$select("settingsDialogScreen") as unknown as { reveal?: () => void })?.reveal?.();
          for (let index = 0; index < Math.min(8, settingsCanonicalChoices.length - start); index++)
            (this.$select("settingsScreen")?.$select("settingsDialogScreen")?.$select(`settingsChoice${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 40);
      },
      focusSettingsChoice(index: number) {
        if (!settingsCanonicalChoices[index]) return;
        this.settingsChoiceIndex = index;
        const start = this.settingsDialogView.start;
        if (index < start || index >= start + 8) {
          this.refreshSettingsDialog(this.settingsDialogView.title);
          setTimeout(() => this.$select("settingsScreen")?.$select("settingsDialogScreen")?.$select(`settingsChoice${index - this.settingsDialogView.start}`)?.$focus(), 60);
        } else this.$select("settingsScreen")?.$select("settingsDialogScreen")?.$select(`settingsChoice${index - start}`)?.$focus();
      },
      moveSettingsChoice(delta: number) {
        this.focusSettingsChoice(Math.max(0, Math.min(settingsCanonicalChoices.length - 1, this.settingsChoiceIndex + delta)));
      },
      closeSettingsDialog() {
        if (!this.settingsDialogOpen) return;
        if (this.settingsDialogKind === "addonRemove" && this.settingsDialogAddon) {
          this.openSettingsAddonManage(this.settingsDialogAddon);
          return;
        }
        this.settingsDialogOpen = false;
        setTimeout(() => { if (this.phase === "settings") this.focusSettingsRow(this.settingsSelectedIndex); }, 40);
      },
      async activateSettingsChoice() {
        const choice = settingsCanonicalChoices[this.settingsChoiceIndex];
        if (!choice) return;
        if (this.settingsDialogKind === "addonManage") {
          if (choice.value === "__cancel__") { this.closeSettingsDialog(); return; }
          if (choice.value === "remove-addon") { this.openSettingsAddonRemove(); return; }
          const addon = this.settingsDialogAddon;
          if (!addon) return;
          this.settingsDialogOpen = false;
          try {
            await api.updateAddon(String(addon.id ?? ""), { enabled: addon.enabled === false });
            this.settingsAddons = [...await api.addons()];
            if (this.phase === "settings") { this.refreshSettingsView(); this.focusSettingsRow(this.settingsSelectedIndex); }
          } catch (cause) {
            this.settingsPanel = { ...this.settingsPanel, description: cause instanceof Error ? cause.message : "Could not update addon." };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        if (this.settingsDialogKind === "addonRemove") {
          if (choice.value === "__cancel__") { this.closeSettingsDialog(); return; }
          const addon = this.settingsDialogAddon;
          if (!addon) return;
          this.settingsDialogOpen = false;
          try {
            await api.deleteAddon(String(addon.id ?? ""));
            this.settingsAddons = [...await api.addons()];
            if (this.phase === "settings") {
              this.settingsSelectedIndex = Math.min(this.settingsSelectedIndex, this.settingsAddons.length);
              this.refreshSettingsView();
              this.focusSettingsRow(this.settingsSelectedIndex);
            }
          } catch (cause) {
            this.settingsPanel = { ...this.settingsPanel, description: cause instanceof Error ? cause.message : "Could not remove addon." };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        if (choice.value === "__cancel__") { this.closeSettingsDialog(); return; }
        if (this.settingsDialogKind === "signout") {
          this.settingsDialogOpen = false;
          try { await api.signOut(); }
          catch (cause) {
            this.settingsPanel = { ...this.settingsPanel, description: cause instanceof Error ? cause.message : "Could not sign out." };
            this.focusSettingsRow(this.settingsSelectedIndex);
          }
          return;
        }
        const patch = { [this.settingsDialogKey]: choice.value } as Partial<PlaybackPreferences>;
        this.closeSettingsDialog();
        try {
          this.settingsPrefs = await api.savePreferences(this.currentProfileId, patch);
          if (this.phase === "settings") this.refreshSettingsView();
        } catch (cause) {
          this.settingsPanel = { ...this.settingsPanel, description: cause instanceof Error ? cause.message : "Could not save preference." };
        }
      },
      backFromSettings() {
        if (this.settingsDialogOpen) { this.closeSettingsDialog(); return; }
        if (this.settingsFocusZone === "profile") { this.focusSettingsRow(0); return; }
        if (this.settingsPage !== "Settings") {
          const restore = this.settingsPage === "Playback preferences" ? 1 : 3;
          this.settingsPage = "Settings";
          this.settingsSelectedIndex = restore;
          this.refreshSettingsView();
          setTimeout(() => this.focusSettingsRow(restore), 60);
          return;
        }
        this.returnFromSettings();
      },
      returnFromSettings() {
        settingsScope?.abort(); ++settingsGeneration;
        this.railExpanded = false;
        this.phase = this.settingsReturnPhase;
        this.railCurrent = this.settingsReturnPhase;
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips(); this.refreshDiscoverCards();
            if (this.settingsReturnZone === "chip") this.focusDiscoverChip(this.settingsReturnIndex);
            else this.focusDiscoverCard(this.settingsReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments(); this.refreshLibraryCards();
            if (this.settingsReturnZone === "segment") this.focusLibrarySegment(this.settingsReturnIndex);
            else this.focusLibraryCard(this.settingsReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            if (this.settingsReturnZone === "result") this.focusSearchResult(this.settingsReturnIndex);
            else this.focusSearchKey(this.settingsReturnIndex);
          } else if (this.phase === "live") {
            this.refreshLiveView();
            if (this.settingsReturnZone === "filter") this.focusLiveFilter(this.settingsReturnIndex);
            else if (this.settingsReturnZone === "program") this.focusLiveProgram(this.settingsReturnIndex);
            else this.focusLiveChannel(this.settingsReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.settingsReturnZone === "card") this.focusHomeCard(this.settingsReturnIndex);
            else this.focusHomeAction(this.settingsReturnIndex);
          }
        }, 40);
      },
      openTitleMenu(item: MediaItem, origin: "home" | "library" | "discover" | "search", index: number) {
        const inQueue = [...this.home.queueItems, ...this.libraryQueueItems]
          .some(candidate => candidate.type === item.type && candidate.id === item.id);
        const saved = [...this.home.favoriteItems, ...this.libraryFavorites]
          .some(candidate => candidate.type === item.type && candidate.id === item.id);
        this.titleMenuItem = item;
        this.titleMenuOrigin = origin;
        this.titleMenuReturnIndex = index;
        this.titleMenuKind = "actions";
        this.titleMenuChoices = titleMenuChoices(item, inQueue, saved);
        this.titleMenuSlots = Array.from({ length: 7 }, (_, slot) => this.titleMenuChoices[slot] ?? { ...emptyTitleMenuChoice });
        this.titleMenuFocusIndex = 0;
        this.titleMenuHeading = "";
        this.titleMenuNotice = "";
        this.titleMenuBusy = false;
        this.titleMenuOpen = true;
        noteTitleMenu(true, "actions");
        setTimeout(() => {
          if (!this.titleMenuOpen || this.titleMenuKind !== "actions") return;
          this.titleMenuHeading = item.name;
          this.titleMenuOkLabel = "OK";
          this.titleMenuSelectLabel = "Select";
          this.titleMenuBackLabel = "BACK";
          this.titleMenuCancelLabel = "Cancel";
          this.revealTitleMenu();
          this.focusTitleMenu(0);
        }, 40);
      },
      revealTitleMenu() {
        for (let index = 0; index < 7; index++)
          (this.$select("titleMenuScreen")?.$select(`titleMenuOption${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusTitleMenu(index: number) {
        this.titleMenuFocusIndex = index;
        this.$select("titleMenuScreen")?.$select(`titleMenuOption${index}`)?.$focus();
      },
      moveTitleMenu(delta: number) {
        const last = Math.max(0, this.titleMenuChoices.length - 1);
        this.focusTitleMenu(Math.max(0, Math.min(last, this.titleMenuFocusIndex + delta)));
      },
      closeTitleMenu(restore = true) {
        if (!this.titleMenuOpen) return;
        this.titleMenuOpen = false;
        this.titleMenuBusy = false;
        noteTitleMenu(false, this.titleMenuKind);
        if (!restore) return;
        if (this.titleMenuOrigin === "home") {
          const last = this.home.queueItems.length - 1;
          if (last >= 0) this.focusHomeCard(Math.min(this.titleMenuReturnIndex, last));
          else this.focusHomeAction(0);
        } else if (this.titleMenuOrigin === "library") {
          const last = this.libraryItems.length - 1;
          if (last >= 0) this.focusLibraryCard(Math.min(this.titleMenuReturnIndex, last));
          else this.focusLibrarySegment(this.libraryMode === "queue" ? 1 : 0);
        } else if (this.titleMenuOrigin === "discover") this.focusDiscoverCard(this.titleMenuReturnIndex);
        else {
          const index = this.titleMenuReturnIndex;
          setTimeout(() => {
            if (this.phase === "search" && !this.titleMenuOpen) this.focusSearchResult(index);
          }, 40);
          // The result row is a clipped Blits for-loop. Under a busy renderer
          // its focus node can be ready one frame after the menu disappears.
          setTimeout(() => {
            if (this.phase !== "search" || this.titleMenuOpen || this.searchFocusZone !== "result" || this.searchResultIndex !== index) return;
            const result = this.$select("searchScreen")?.$select(`searchCard${index}`) as unknown as { focused?: boolean } | undefined;
            if (!result?.focused) this.focusSearchResult(index);
          }, 140);
        }
      },
      updateQueueLists(items: readonly MediaItem[]) {
        const cards = queueHomeCards(items);
        this.home = { ...this.home, queueItems: items, cards };
        this.homeCards = Array.from({ length: 6 }, (_, index) => cards[index] ?? { ...emptyHomeCard });
        this.libraryQueueItems = [...items];
        if (this.libraryMode === "queue") {
          this.libraryItems = [...items];
          this.libraryCardIndex = Math.min(this.libraryCardIndex, Math.max(0, items.length - 1));
          this.refreshLibraryCards();
          noteLibraryState("queue", items.length);
        }
        this.revealHomeControls();
      },
      async refreshQueueAfterMenu() {
        const page = await api.queue(this.currentProfileId, 0);
        this.updateQueueLists(page.items);
        this.libraryNextOffset = page.nextOffset;
      },
      showUndoMenu(item: MediaItem) {
        this.titleMenuKind = "undo";
        this.titleMenuChoices = [
          titleMenuChoice("undo", "Undo"),
          titleMenuChoice("done", "Done"),
        ];
        this.titleMenuSlots = Array.from({ length: 7 }, (_, index) => this.titleMenuChoices[index] ?? { ...emptyTitleMenuChoice });
        this.titleMenuHeading = "";
        this.titleMenuNotice = "";
        this.titleMenuBusy = false;
        noteTitleMenu(true, "undo");
        setTimeout(() => {
          if (!this.titleMenuOpen || this.titleMenuKind !== "undo") return;
          this.titleMenuHeading = "Removed from Continue Watching";
          this.revealTitleMenu();
          this.focusTitleMenu(0);
        }, 40);
      },
      async activateTitleMenu() {
        if (!this.titleMenuOpen || this.titleMenuBusy) return;
        const choice = this.titleMenuChoices[this.titleMenuFocusIndex];
        const item = this.titleMenuItem;
        if (!choice || !item) return;
        if (choice.key === "cancel" || choice.key === "done") { this.closeTitleMenu(); return; }
        if (choice.key === "previous" || choice.key === "source" || choice.key === "restart" || choice.key === "watchLive") {
          const target = choice.key === "previous" ? item.previousEpisode : choice.key === "restart" ? { ...item, position: 0 } : item;
          if (!target) return;
          this.closeTitleMenu(false);
          void this.openSources(target, choice.key === "previous");
          return;
        }
        this.titleMenuBusy = true;
        try {
          if (choice.key === "watched") {
            await api.correctProgress(this.currentProfileId, item, !item.watched);
            await this.refreshQueueAfterMenu();
            this.closeTitleMenu();
          } else if (choice.key === "hide") {
            await api.setQueueVisibility(this.currentProfileId, item, true);
            this.updateQueueLists(this.home.queueItems.filter(candidate => candidate.type !== item.type || candidate.id !== item.id));
            this.showUndoMenu(item);
          } else if (choice.key === "undo") {
            await api.setQueueVisibility(this.currentProfileId, item, false);
            await this.refreshQueueAfterMenu();
            this.closeTitleMenu();
          } else if (choice.key === "favorite") {
            await api.toggleFavorite(this.currentProfileId, item);
            const favorites = await api.favorites(this.currentProfileId);
            this.home = { ...this.home, favoriteItems: favorites };
            this.libraryFavorites = favorites;
            if (this.libraryMode === "favorites") {
              this.libraryItems = [...favorites];
              this.refreshLibraryCards();
              noteLibraryState("favorites", favorites.length);
            }
            this.closeTitleMenu();
          }
        } catch (cause) {
          this.titleMenuNotice = cause instanceof Error ? cause.message : "This action could not finish.";
          this.titleMenuBusy = false;
        }
      },
      async activateHomeAction() {
        if (this.phase !== "home" || this.homeFocusZone !== "action") return;
        const action = ["play", "details", "save"][this.homeActionIndex];
        if (action === "save" && this.home.heroItem && this.currentProfileId) {
          try {
            const saved = await api.toggleFavorite(this.currentProfileId, this.home.heroItem);
            const favoriteItems = saved
              ? [...this.home.favoriteItems, this.home.heroItem]
              : this.home.favoriteItems.filter(favorite => favorite.id !== this.home.heroItem?.id);
            this.home = { ...this.home, saved, favoriteItems };
            this.homeAddLabel = saved ? "✓" : "+";
            (this.$select("heroAction2") as unknown as { reveal?: () => void })?.reveal?.();
            this.homeNotice = saved ? "Added to My List" : "Removed from My List";
          } catch (cause) {
            this.homeNotice = cause instanceof Error ? cause.message : "Could not update My List.";
          }
          return;
        }
        if (action === "details" && this.home.heroItem) {
          void this.openDetail(this.home.heroItem);
          return;
        }
        this.homeNotice = "Playback is unavailable.";
      },
      openDetailByCard() {
        const item = this.home.queueItems[this.homeCardIndex];
        if (item) void this.openDetail(item);
      },
      async openDetail(item: MediaItem) {
        if (this.phase !== "home" && this.phase !== "discover" && this.phase !== "library" && this.phase !== "search") return;
        const generation = ++detailGeneration;
        detailScope?.abort();
        detailScope = api.createScope();
        this.detailReturnPhase = this.phase;
        if (this.phase === "home") {
          this.detailReturnZone = this.homeFocusZone;
          this.detailReturnIndex = this.homeFocusZone === "card" ? this.homeCardIndex : this.homeActionIndex;
        } else if (this.phase === "discover") {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.discoverCardIndex;
        } else if (this.phase === "search") {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.searchResultIndex;
          searchScope?.abort();
          ++searchGeneration;
          clearTimeout(searchTimer);
        } else {
          this.detailReturnZone = "card";
          this.detailReturnIndex = this.libraryCardIndex;
        }
        this.homeNotice = "";
        try {
          const view = await loadDetailView(api, item, this.currentProfileId, this.home.favoriteItems, detailScope.signal);
          if (generation !== detailGeneration || detailScope.signal.aborted) return;
          this.phase = "detail";
          setTimeout(() => {
            if (generation !== detailGeneration) return;
            this.detail = view;
            this.detailEpisodes = Array.from({ length: 5 }, (_, index) => view.episodes[index] ?? { ...emptyDetailEpisode });
            this.detailSaveIcon = view.saved ? "✓" : "+";
            this.detailSeasonLabel = `Season ${view.season}`;
            this.detailCountLabel = `${view.episodeCount} ${view.episodeCount === 1 ? "episode" : "episodes"}`;
            this.detailNotice = "";
            this.revealTitleControls();
            this.focusTitleAction(0);
          }, 50);
        } catch (cause) {
          if (generation !== detailGeneration || detailScope.signal.aborted) return;
          this.homeNotice = cause instanceof Error ? cause.message : "Could not open title.";
        }
      },
      revealTitleControls() {
        for (let index = 0; index < 4; index++)
          (this.$select(`titleAction${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < 5; index++)
          (this.$select(`titleEpisode${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusTitleAction(index: number) {
        this.detailFocusZone = "action";
        this.detailActionIndex = index;
        this.$select(`titleAction${index}`)?.$focus();
      },
      focusTitleEpisode(index: number) {
        this.detailFocusZone = "episode";
        this.detailEpisodeIndex = index;
        this.$select(`titleEpisode${index}`)?.$focus();
      },
      async activateTitleAction() {
        if (this.phase !== "detail" || this.detailFocusZone !== "action") return;
        const action = ["play", "source", "save", "info"][this.detailActionIndex];
        if (action === "save" && this.detail.item && this.currentProfileId) {
          try {
            const saved = await api.toggleFavorite(this.currentProfileId, this.detail.item);
            this.detail = { ...this.detail, saved };
            this.detailSaveIcon = saved ? "✓" : "+";
            setTimeout(() => (this.$select("titleAction2") as unknown as { reveal?: () => void })?.reveal?.(), 0);
            this.detailNotice = saved ? "Added to My List" : "Removed from My List";
          } catch (cause) {
            this.detailNotice = cause instanceof Error ? cause.message : "Could not update My List.";
          }
          return;
        }
        if ((action === "play" || action === "source") && this.detail.target) {
          void this.openSources(this.detail.target, action === "play" && !!this.detail.target.position);
          return;
        }
        this.detailNotice = action === "info" ? this.detail.synopsis : "Choose source is not available yet.";
      },
      async openSources(item: MediaItem, resume: boolean) {
        if (this.phase !== "detail" && this.phase !== "library" && this.phase !== "home" && this.phase !== "discover" && this.phase !== "search" && this.phase !== "live") return;
        const generation = ++sourceGeneration;
        sourceScope?.abort();
        clearTimeout(sourceTimer);
        const scope = api.createScope();
        sourceScope = scope;
        this.sourceReturnOrigin = this.phase;
        if (this.phase === "library") this.sourceReturnIndex = this.libraryCardIndex;
        else if (this.phase === "home") this.sourceReturnIndex = this.homeCardIndex;
        else if (this.phase === "discover") this.sourceReturnIndex = this.discoverCardIndex;
        else if (this.phase === "search") this.sourceReturnIndex = this.searchResultIndex;
        else if (this.phase === "live") {
          this.sourceReturnZone = this.liveFocusZone === "program" ? "program" : "channel";
          this.sourceReturnIndex = this.liveFocusZone === "program" ? this.liveProgramPosition : this.liveSelectedRow;
        }
        else {
          this.sourceReturnZone = this.detailFocusZone;
          this.sourceReturnIndex = this.detailFocusZone === "episode" ? this.detailEpisodeIndex : this.detailActionIndex;
        }
        this.sourceResume = resume;
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceNotice = "";
        this.source = projectSources(item, [], true, false);
        this.sourceChips = Array.from({ length: 5 }, (_, index) => this.source.chips[index] ?? { ...emptySourceChip });
        this.sourceRows = Array.from({ length: 6 }, () => ({ ...emptySourceRow }));
        this.phase = "sources";
        setTimeout(() => {
          if (generation !== sourceGeneration) return;
          this.sourcePanelTitle = "Choose a source";
          this.sourceProviderLabel = "All providers";
          this.sourceOkLabel = "OK";
          this.sourcePlayLabel = "Play";
          this.sourceArrowLabel = "◀ ▶";
          this.sourceQualityLabel = "Quality";
          this.sourceBackLabel = "BACK";
          this.sourceCloseLabel = "Close";
          this.revealSourceControls();
          this.focusSourceChip(0);
        }, 50);
        try {
          const discovery = await api.sources(item, { signal: scope.signal });
          let state = { after: 0, sources: [] as readonly MediaSource[], polls: 0 };
          while (generation === sourceGeneration && !scope.signal.aborted) {
            const step = await api.pollSourcesStep(discovery.id, state, { signal: scope.signal });
            if (generation !== sourceGeneration || scope.signal.aborted) return;
            state = step.state;
            const hadRows = this.source.sources.length > 0;
            this.updateSources(state.sources, !step.done, step.done);
            if (!hadRows && state.sources.length) setTimeout(() => {
              if (generation === sourceGeneration && this.phase === "sources") this.focusSourceRow(0);
            }, 50);
            if (resume && item.sourceAddonId && item.sourceFingerprint) {
              const exact = exactResumeSource(item, state.sources);
              if (exact) {
                this.sourceSelectedId = exact.id;
                noteSourceIntent(item.id, exact.id, item.position ?? 0, true);
                void this.playSource(item, exact, item.position ?? 0);
                return;
              }
            }
            if (step.done) {
              if (resume) this.sourceNotice = "Your previous source is unavailable. Choose a source to continue.";
              break;
            }
            await new Promise<void>(resolve => {
              const finish = () => { clearTimeout(sourceTimer); scope.signal.removeEventListener("abort", finish); resolve(); };
              sourceTimer = setTimeout(finish, 1500);
              scope.signal.addEventListener("abort", finish, { once: true });
            });
          }
        } catch (cause) {
          if (generation !== sourceGeneration || scope.signal.aborted) return;
          this.sourceNotice = cause instanceof Error ? cause.message : "Could not find sources.";
          this.updateSources(this.source.sources, false, true);
        }
      },
      updateSources(sources: readonly MediaSource[], busy: boolean, done: boolean) {
        const item = this.source.item;
        if (!item) return;
        this.source = projectSources(item, sources, busy, done, this.source.quality, this.source.provider);
        noteSourceFilter(this.source.quality, this.source.provider, this.source.rows.length);
        this.sourceChips = Array.from({ length: 5 }, (_, index) => this.source.chips[index] ?? { ...emptySourceChip });
        this.sourceWindowStart = Math.min(this.sourceWindowStart, Math.max(0, this.source.rows.length - 6));
        this.sourceRowIndex = Math.min(this.sourceRowIndex, Math.max(0, this.source.rows.length - 1));
        this.sourceRows = Array.from({ length: 6 }, (_, index) => this.source.rows[this.sourceWindowStart + index] ?? { ...emptySourceRow });
        setTimeout(() => { if (this.phase === "sources") this.revealSourceControls(); }, 60);
      },
      revealSourceControls() {
        for (let index = 0; index < 5; index++)
          (this.$select(`sourceChip${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        (this.$select("sourceProvider") as unknown as { reveal?: () => void })?.reveal?.();
        for (let index = 0; index < 6; index++)
          (this.$select(`sourceRow${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusSourceChip(index: number) {
        if (this.phase !== "sources") return;
        this.sourceFocusZone = "chip";
        this.sourceChipIndex = index;
        this.$select(`sourceChip${index}`)?.$focus();
      },
      focusSourceProvider() {
        if (this.phase !== "sources") return;
        this.sourceFocusZone = "provider";
        this.$select("sourceProvider")?.$focus();
      },
      focusSourceRow(index: number) {
        if (this.phase !== "sources" || !this.source.rows.length) return;
        this.sourceFocusZone = "row";
        this.sourceRowIndex = Math.max(0, Math.min(this.source.rows.length - 1, index));
        const previousStart = this.sourceWindowStart;
        if (this.sourceRowIndex < this.sourceWindowStart) this.sourceWindowStart = this.sourceRowIndex;
        else if (this.sourceRowIndex >= this.sourceWindowStart + 6) this.sourceWindowStart = this.sourceRowIndex - 5;
        noteSourceWindow(this.sourceRowIndex, this.sourceWindowStart);
        if (this.sourceWindowStart !== previousStart) {
          this.sourceRows = Array.from({ length: 6 }, (_, slot) => this.source.rows[this.sourceWindowStart + slot] ?? { ...emptySourceRow });
          setTimeout(() => { if (this.phase === "sources") this.revealSourceControls(); }, 60);
        }
        const slot = this.sourceRowIndex - this.sourceWindowStart;
        this.$select(`sourceRow${slot}`)?.$focus();
        setTimeout(() => {
          if (this.phase === "sources")
            (this.$select(`sourceRow${this.sourceRowIndex - this.sourceWindowStart}`) as unknown as { reveal?: () => void })?.reveal?.();
        }, 60);
      },
      moveSourceRow(delta: number) {
        if (this.phase !== "sources") return;
        if (this.sourceRowIndex === 0 && delta < 0) this.focusSourceProvider();
        else this.focusSourceRow(this.sourceRowIndex + delta);
      },
      selectSourceRow() {
        if (this.phase !== "sources") return;
        const row = this.source.rows[this.sourceRowIndex];
        const item = this.source.item;
        if (!row?.source || !item) return;
        this.sourceSelectedId = row.source.id;
        noteSourceIntent(item.id, row.source.id, item.position ?? 0, this.sourceResume);
        void this.playSource(item, row.source, item.position ?? 0);
      },
      async ensurePlaybackRuntime() {
        if (playback) return playback;
        const video = document.getElementById("tv-video") as HTMLVideoElement | null;
        if (!video) throw new Error("TV video surface is unavailable.");
        const { createLightningPlaybackRuntime } = await import("./playbackRuntime");
        if (playback) return playback;
        playback = createLightningPlaybackRuntime(api, platform, video, snapshot => this.updatePlayerSnapshot(snapshot));
        return playback;
      },
      async playSource(item: MediaItem, source: MediaSource, position: number) {
        if (this.phase !== "sources") return;
        const generation = ++playbackGeneration;
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        this.playerItem = item;
        const title = item.name;
        const episodeLine = item.season !== undefined
          ? `S${item.season} · E${item.episode ?? 1} · ${item.episodeTitle ?? item.name}` : "";
        this.playerTitle = "";
        this.playerEpisodeLine = "";
        this.preparingText = "Preparing playback…";
        this.playerNotice = "";
        this.phase = "preparing";
        const layer = document.getElementById("video-layer")!;
        this.setPlayerShade(false);
        if (platform === "tizen") document.body.style.background = "transparent";
        else layer.style.display = "block";
        try {
          const runtime = await this.ensurePlaybackRuntime();
          if (generation !== playbackGeneration || this.phase !== "preparing") return;
          const started = await runtime.start(item, source, position);
          if (generation !== playbackGeneration) {
            if (runtime.controller.snapshot.active?.session.id === started.session.id) await runtime.stop();
            return;
          }
          // Persist the controller's enriched item so progress retains the
          // selected source's addon/fingerprint identity on exit and heartbeat.
          this.playerItem = started.intent.item;
          this.playerSessionId = started.session.id;
          this.playerSessionDuration = started.session.duration;
          this.phase = "player";
          this.playerOverlay = true;
          this.setPlayerShade(true);
          this.nowPlayingLabel = "NOW PLAYING";
          this.playerLegend = "OK  Select     ◀ ▶  Move     BACK  Hide controls";
          this.updatePlayerSnapshot(runtime.player.snapshot);
          setTimeout(() => {
            if (generation !== playbackGeneration || this.phase !== "player") return;
            this.playerTitle = title;
            this.playerEpisodeLine = episodeLine;
            this.revealPlayerControls();
            this.focusPlayerControl(1);
          }, 50);
          clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (this.phase !== "player" || !this.playerSessionId || !this.playerItem) return;
            void api.heartbeat(this.playerSessionId).catch(() => undefined);
            if (this.playerItem.type !== "live") {
              const time = runtime.player.snapshot.time;
              void api.saveProgress(this.currentProfileId, this.playerItem,
                time.positionSeconds, time.durationSeconds ?? this.playerSessionDuration).catch(() => undefined);
            }
          }, 15000);
        } catch (cause) {
          if (generation !== playbackGeneration) return;
          layer.style.display = "none";
          this.setPlayerShade(false);
          document.body.style.background = "";
          this.phase = "sources";
          this.sourceNotice = cause instanceof Error ? cause.message : "This source could not be played.";
          setTimeout(() => this.focusSourceRow(this.sourceRowIndex), 0);
        }
      },
      updatePlayerSnapshot(snapshot: PlayerSnapshot) {
        this.playerSnapshot = snapshot;
        notePlayerState(snapshot.state, snapshot.time.positionSeconds);
        this.playerStatus = snapshot.state.toUpperCase();
        this.playerToggleIcon = snapshot.state === "paused" ? "▶" : "Ⅱ";
        const position = snapshot.time.positionSeconds;
        const duration = snapshot.time.durationSeconds ?? this.playerSessionDuration;
        if (this.playerSeekPreview === null) {
          this.playerPositionText = playerClock(position);
          this.playerProgress = duration > 0 ? Math.min(1, position / duration) : 0;
        }
        this.playerDurationText = duration > 0 ? playerClock(duration) : "";
        if (snapshot.error && this.phase === "player") this.playerNotice = snapshot.error.message;
        if (snapshot.state === "playing" && this.phase === "player") this.schedulePlayerChromeHide();
      },
      setPlayerShade(visible: boolean) {
        const shade = document.getElementById("player-shade");
        if (shade) shade.style.display = visible ? "block" : "none";
      },
      schedulePlayerChromeHide() {
        clearTimeout(chromeTimer);
        if (!this.playerOverlay || this.trackPanelOpen || this.playerSnapshot?.state !== "playing") return;
        chromeTimer = setTimeout(() => {
          if (this.phase === "player" && this.playerSnapshot?.state === "playing") {
            this.playerOverlay = false;
            this.setPlayerShade(false);
            this.$focus();
          }
        }, 7000);
      },
      revealPlayerControls() {
        for (let index = 0; index < 7; index++)
          (this.$select(`playerControl${index}`) as unknown as { reveal?: () => void })?.reveal?.();
      },
      focusPlayerControl(index: number) {
        if (this.phase !== "player") return;
        this.playerOverlay = true;
        this.setPlayerShade(true);
        this.playerFocusIndex = index;
        this.$select(`playerControl${index}`)?.$focus();
        this.schedulePlayerChromeHide();
      },
      focusPlayerTimeline() {
        if (this.phase !== "player") return;
        this.playerOverlay = true;
        this.setPlayerShade(true);
        this.$select("playerTimeline")?.$focus();
        this.schedulePlayerChromeHide();
      },
      async activatePlayerControl() {
        if (this.phase !== "player") return;
        const runtime = playback;
        if (!runtime) return;
        const action = ["back10", "toggle", "forward30", "next", "audio", "subtitles", "exit"][this.playerFocusIndex];
        try {
          if (action === "toggle") {
            if (runtime.player.snapshot.state === "paused") await runtime.player.play();
            else await runtime.player.pause();
          } else if (action === "back10" || action === "forward30") {
            const current = runtime.player.snapshot.time.positionSeconds;
            const duration = runtime.player.snapshot.time.durationSeconds ?? this.playerSessionDuration;
            const target = Math.max(0, Math.min(duration || Infinity, current + (action === "back10" ? -10 : 30)));
            await runtime.controller.seekFrom(() => target, () => current);
          } else if (action === "exit") {
            await this.exitPlayer();
            return;
          } else if (action === "audio" || action === "subtitles") {
            this.openTrackPanel(action === "audio" ? "audio" : "text");
            return;
          } else this.playerNotice = `${action} is unavailable.`;
        } catch (cause) {
          this.playerNotice = cause instanceof Error ? cause.message : "The TV could not complete this request.";
        }
        this.schedulePlayerChromeHide();
      },
      openTrackPanel(kind: "audio" | "text") {
        if (this.phase !== "player" || !playback) return;
        const session = playback.controller.snapshot.active?.session;
        if (!session) return;
        const choices = trackChoicesFor(kind, playback.player, session);
        if (!choices.length) { this.playerNotice = kind === "audio" ? "No audio tracks are available." : "No subtitles are available."; return; }
        this.trackPanelKind = kind;
        this.trackReturnControlIndex = this.playerFocusIndex;
        this.trackChoices = choices;
        this.trackSlots = Array.from({ length: 8 }, (_, index) => choices[index] ?? { ...emptyTrackChoice });
        this.trackFocusIndex = Math.max(0, choices.findIndex(choice => choice.current));
        this.trackNotice = "";
        this.trackPanelOpen = true;
        this.phase = "playerTracks";
        noteTrackPanel(true, kind);
        this.playerOverlay = true;
        this.setPlayerShade(true);
        clearTimeout(chromeTimer);
        setTimeout(() => {
          if (!this.trackPanelOpen || this.phase !== "playerTracks") return;
          this.trackPanelTitle = kind === "audio" ? "Audio Tracks" : "Subtitles";
          this.trackLegend = "▲ ▼  Move     OK  Select     BACK  Close";
          for (let index = 0; index < 8; index++)
            (this.$select(`playerTrack${index}`) as unknown as { reveal?: () => void })?.reveal?.();
          this.focusTrackChoice(this.trackFocusIndex);
        }, 50);
      },
      focusTrackChoice(index: number) {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen) return;
        this.trackFocusIndex = index;
        this.$select(`playerTrack${index}`)?.$focus();
      },
      moveTrackFocus(delta: number) {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen) return;
        this.focusTrackChoice(Math.max(0, Math.min(this.trackChoices.length - 1, this.trackFocusIndex + delta)));
      },
      async selectTrackChoice() {
        if (this.phase !== "playerTracks" || !this.trackPanelOpen || !playback) return;
        const choice = this.trackChoices[this.trackFocusIndex];
        if (!choice) return;
        noteTrackSelection(this.trackPanelKind, choice.id, choice.available);
        if (!choice.available) { this.trackNotice = "This track is not supported on this TV."; return; }
        this.closeTrackPanel();
        try {
          if (choice.mode === "off") {
            const session = playback.controller.snapshot.active?.session;
            if (session?.mode === "direct" && playback.player.capabilities.canDisableTextTrack)
              await playback.player.selectTextTrack(null);
            else await playback.controller.replaceTracks({ subtitlesOff: true });
          } else if (choice.mode === "native") {
            if (this.trackPanelKind === "audio") await playback.player.selectAudioTrack(choice.id);
            else await playback.player.selectTextTrack(choice.id);
          } else if (this.trackPanelKind === "audio") {
            await playback.controller.replaceTracks({ audioTrackIndex: choice.inputIndex });
          } else {
            await playback.controller.replaceTracks({ subtitleTrackIndex: choice.inputIndex, subtitlesOff: false });
          }
          const active = playback.controller.snapshot.active;
          if (active) {
            this.playerSessionId = active.session.id;
            this.playerSessionDuration = active.session.duration;
          }
        } catch (cause) {
          this.playerNotice = cause instanceof Error ? cause.message : "Could not change this track.";
        }
      },
      closeTrackPanel() {
        if (!this.trackPanelOpen) return;
        this.trackPanelOpen = false;
        this.phase = "player";
        noteTrackPanel(false, this.trackPanelKind);
        this.trackNotice = "";
        setTimeout(() => {
          if (this.phase === "player") this.focusPlayerControl(this.trackReturnControlIndex);
        }, 0);
      },
      previewPlayerSeek(delta: number) {
        if (this.phase !== "player" || !playback) return;
        const current = this.playerSeekPreview ?? playback.player.snapshot.time.positionSeconds;
        const duration = playback.player.snapshot.time.durationSeconds ?? this.playerSessionDuration;
        this.playerSeekPreview = Math.max(0, Math.min(duration || Infinity, current + delta));
        this.playerSeekLabel = playerClock(this.playerSeekPreview);
        this.playerProgress = duration > 0 ? Math.min(1, this.playerSeekPreview / duration) : 0;
        this.playerLegend = "◀ ▶  Seek     OK  Jump     BACK  Cancel";
        clearTimeout(chromeTimer);
      },
      async commitPlayerSeek() {
        if (this.phase !== "player" || !playback || this.playerSeekPreview === null) return;
        const target = this.playerSeekPreview;
        const current = playback.player.snapshot.time.positionSeconds;
        try { await playback.controller.seekFrom(() => target, () => current); }
        catch (cause) { this.playerNotice = cause instanceof Error ? cause.message : "The stream could not seek there."; }
        finally {
          this.playerSeekPreview = null;
          this.playerSeekLabel = "";
          this.playerLegend = "OK  Select     ◀ ▶  Move     BACK  Hide controls";
          this.updatePlayerSnapshot(playback.player.snapshot);
        }
      },
      async exitPlayer() {
        if (this.phase !== "player" && this.phase !== "playerTracks" && this.phase !== "preparing") return;
        ++playbackGeneration;
        clearInterval(heartbeatTimer);
        clearTimeout(chromeTimer);
        const runtime = playback;
        const snapshot = runtime?.player.snapshot;
        if (runtime && this.playerItem && snapshot && this.playerItem.type !== "live")
          await api.saveProgress(this.currentProfileId, this.playerItem,
            snapshot.time.positionSeconds, snapshot.time.durationSeconds ?? this.playerSessionDuration).catch(() => undefined);
        await runtime?.stop().catch(() => undefined);
        document.getElementById("video-layer")!.style.display = "none";
        this.setPlayerShade(false);
        document.body.style.background = "";
        this.phase = "sources";
        this.playerOverlay = true;
        this.trackPanelOpen = false;
        this.playerSeekPreview = null;
        this.playerSeekLabel = "";
        this.updateSources(this.source.sources, false, true);
        setTimeout(() => this.focusSourceRow(this.sourceRowIndex), 0);
      },
      openSourceDetails() {
        if (this.phase !== "sources") return;
        const source = this.source.rows[this.sourceRowIndex]?.source;
        if (!source) return;
        this.sourceDetailsReturnIndex = this.sourceRowIndex;
        this.phase = "sourceDetails";
        setTimeout(() => {
          if (this.phase !== "sourceDetails") return;
          this.sourceDetailsHeading = "Source details";
          this.sourceDetailsBody = [source.name, source.title, source.filename, source.sourceName]
            .filter(Boolean).join("\n");
          this.$select("sourceDetailsClose")?.$focus();
        }, 50);
      },
      closeSourceDetails() {
        if (this.phase !== "sourceDetails") return;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceRow(this.sourceDetailsReturnIndex);
        }, 0);
      },
      chooseSourceQuality(index: number) {
        const quality = this.source.chips[index]?.quality;
        if (this.phase !== "sources" || !quality || !this.source.item) return;
        this.source = projectSources(this.source.item, this.source.sources, this.source.busy, this.source.done, quality, this.source.provider);
        noteSourceFilter(this.source.quality, this.source.provider, this.source.rows.length);
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceChips = Array.from({ length: 5 }, (_, slot) => this.source.chips[slot] ?? { ...emptySourceChip });
        this.sourceRows = Array.from({ length: 6 }, (_, slot) => this.source.rows[slot] ?? { ...emptySourceRow });
        this.sourceChipIndex = index;
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          // Do not steal focus if the user already moved into the rows.
          if (this.sourceFocusZone === "chip" && this.sourceChipIndex === index) this.focusSourceChip(index);
        }, 60);
      },
      stepSourceQuality(delta: number) {
        const count = this.source.chips.length;
        if (this.phase !== "sources" || !count) return;
        const index = this.source.chips.findIndex(chip => chip.quality === this.source.quality);
        const next = (index + delta + count) % count;
        this.chooseSourceQuality(next);
        if (this.source.rows.length) setTimeout(() => this.focusSourceRow(0), 0);
        else this.focusSourceChip(next);
      },
      closeSources() {
        if (this.phase !== "sources") return;
        sourceScope?.abort();
        ++sourceGeneration;
        clearTimeout(sourceTimer);
        this.phase = this.sourceReturnOrigin;
        this.sourceNotice = "";
        setTimeout(() => {
          if (this.phase === "library") {
            this.revealLibrarySegments();
            this.refreshLibraryCards();
            this.focusLibraryCard(this.sourceReturnIndex);
          } else if (this.phase === "home") {
            this.revealHomeControls();
            this.focusHomeCard(this.sourceReturnIndex);
          } else if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            this.focusDiscoverCard(this.sourceReturnIndex);
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            this.focusSearchResult(this.sourceReturnIndex);
          } else if (this.phase === "live") {
            this.refreshLiveView();
            if (this.sourceReturnZone === "program") this.focusLiveProgram(this.sourceReturnIndex);
            else this.focusLiveChannel(this.sourceReturnIndex);
          } else if (this.sourceReturnZone === "episode") this.focusTitleEpisode(this.sourceReturnIndex);
          else this.focusTitleAction(this.sourceReturnIndex);
        }, 0);
      },
      openProviderPicker() {
        if (this.phase !== "sources") return;
        const labels = ["All", ...new Set(this.source.sources.map(source => source.sourceName ?? source.name)), "Cancel"];
        this.providerChoices = Array.from({ length: 6 }, (_, index) => ({
          label: labels[index] ?? "",
          current: labels[index] === this.source.provider,
          visible: index < labels.length,
        }));
        this.providerChoiceIndex = Math.max(0, Math.min(5, labels.indexOf(this.source.provider)));
        this.phase = "provider";
        setTimeout(() => {
          if (this.phase !== "provider") return;
          this.providerPanelTitle = "Source provider";
          for (let index = 0; index < 6; index++)
            (this.$select(`providerOption${index}`) as unknown as { reveal?: () => void })?.reveal?.();
          this.focusProviderOption(this.providerChoiceIndex);
        }, 50);
      },
      focusProviderOption(index: number) {
        if (this.phase !== "provider") return;
        this.providerChoiceIndex = index;
        this.$select(`providerOption${index}`)?.$focus();
      },
      moveProviderOption(delta: number) {
        const count = this.providerChoices.filter(choice => choice.visible).length;
        if (this.phase !== "provider" || !count) return;
        this.focusProviderOption(Math.max(0, Math.min(count - 1, this.providerChoiceIndex + delta)));
      },
      selectProviderOption() {
        if (this.phase !== "provider") return;
        const choice = this.providerChoices[this.providerChoiceIndex];
        if (!choice?.visible || choice.label === "Cancel") { this.closeProviderPicker(); return; }
        const item = this.source.item;
        if (!item) { this.closeProviderPicker(); return; }
        this.source = projectSources(item, this.source.sources, this.source.busy, this.source.done, this.source.quality, choice.label);
        noteSourceFilter(this.source.quality, this.source.provider, this.source.rows.length);
        this.sourceRowIndex = 0;
        this.sourceWindowStart = 0;
        this.sourceChips = Array.from({ length: 5 }, (_, index) => this.source.chips[index] ?? { ...emptySourceChip });
        this.sourceRows = Array.from({ length: 6 }, (_, index) => this.source.rows[index] ?? { ...emptySourceRow });
        this.sourceProviderLabel = choice.label === "All" ? "All providers" : choice.label;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceProvider();
        }, 60);
      },
      closeProviderPicker() {
        if (this.phase !== "provider") return;
        this.phase = "sources";
        setTimeout(() => {
          if (this.phase !== "sources") return;
          this.revealSourceControls();
          this.focusSourceProvider();
        }, 0);
      },
      returnFromDetail() {
        detailScope?.abort();
        ++detailGeneration;
        this.phase = this.detailReturnPhase;
        this.detailNotice = "";
        setTimeout(() => {
          if (this.phase === "discover") {
            this.revealDiscoverChips();
            this.refreshDiscoverCards();
            this.focusDiscoverCard(this.detailReturnIndex);
          } else if (this.phase === "library") {
            this.revealLibrarySegments();
            if (this.libraryMode === "favorites") void this.reloadLibraryFavorites(this.detailReturnIndex);
            else {
              this.refreshLibraryCards();
              this.focusLibraryCard(this.detailReturnIndex);
            }
          } else if (this.phase === "search") {
            this.refreshSearchLayout();
            this.focusSearchResult(this.detailReturnIndex);
          } else {
            this.revealHomeControls();
            if (this.detailReturnZone === "card") this.focusHomeCard(this.detailReturnIndex);
            else this.focusHomeAction(this.detailReturnIndex);
          }
        }, 0);
      },
      showProfiles(profiles: readonly TvProfile[]) {
        discoverScope?.abort();
        ++discoverGeneration;
        libraryScope?.abort();
        ++libraryGeneration;
        searchScope?.abort();
        ++searchGeneration;
        clearTimeout(searchTimer);
        liveScope?.abort();
        ++liveGeneration;
        clearInterval(liveClockTimer);
        this.liveDetailsOpen = false;
        this.profiles = [...profiles];
        this.railExpanded = false;
        this.phase = "profiles";
        this.profilePage = 0;
        this.profileFocus = 0;
        this.profileFocusTarget = "tile";
        this.managing = false;
        this.profileError = "";
        this.refreshProfileSlots();
        setTimeout(() => {
          this.profilesWordmark = "VIPTV";
          this.profilesLabel = "Who's watching?";
          this.okLabel = "OK";
          this.selectLabel = "Select";
          this.moveIcon = "◀ ▶";
          this.moveLabel = "Move";
          this.revealProfileTiles();
          this.$select("profile0")?.$focus();
        }, 50);
      },
      revealProfileTiles() {
        for (let index = 0; index < 6; index++)
          (this.$select(`profile${index}`) as unknown as { reveal?: () => void })?.reveal?.();
        (this.$select("manageProfiles") as unknown as { reveal?: () => void })?.reveal?.();
      },
      refreshProfileSlots() {
        const visible = this.profiles.slice(this.profilePage * 5, this.profilePage * 5 + 5).map(profileTileData);
        visible.push(addProfileTile);
        this.profileSlots = Array.from({ length: 6 }, (_, index) => visible[index] ?? { ...emptyProfileTile });
        this.profileStartX = (1920 - (visible.length * 220 + (visible.length - 1) * 64)) / 2;
      },
      moveProfile(slot: number, delta: number) {
        const count = this.profileSlots.filter(tile => tile.visible).length;
        const next = Math.max(0, Math.min(count - 1, slot + delta));
        // Record intent before Blits applies focus on its next frame. A fast
        // Right+Enter must activate the newly intended tile, not the old one.
        this.profileFocus = next;
        this.profileFocusTarget = "tile";
        this.$select(`profile${next}`)?.$focus();
      },
      toggleManageProfiles() {
        this.managing = !this.managing;
        this.profilesLabel = this.managing ? "Manage profiles" : "Who's watching?";
        this.selectLabel = this.managing ? "Edit" : "Select";
        this.profileFocusTarget = "tile";
        this.profileFocus = 0;
        (this.$select("manageProfiles") as unknown as { reveal?: () => void })?.reveal?.();
        setTimeout(() => {
          this.revealProfileTiles();
          this.$select("profile0")?.$focus();
        }, 0);
      },
      async activateProfile(_slot: number) {
        if (this.profileFocusTarget === "manage") { this.toggleManageProfiles(); return; }
        const tile = this.profileSlots[this.profileFocus];
        if (!tile?.visible) return;
        if (tile.add || this.managing) {
          this.profileError = "Profile editing is unavailable.";
          return;
        }
        this.profileError = "";
        try { await api.selectProfile(tile.id); }
        catch (cause) {
          this.profileError = cause instanceof Error ? cause.message : "Could not open this profile.";
        }
      },
      async beginPairing() {
        const generation = ++pairingGeneration;
        pairingScope?.abort();
        clearTimeout(pairingTimer);
        pairingScope = api.createScope();
        this.phase = "pairing";
        // Initially hidden text nodes are not rasterized by the current
        // WebGL web-font path. Populate labels after the pairing tree shows.
        setTimeout(() => {
          if (generation !== pairingGeneration) return;
          this.markLabel = "V";
          this.brandLabel = "VIPTV";
          this.titleLabel = "Sign in to VIPTV";
          this.introLabel = "Visit this address, then enter the code shown below.";
          this.expiredLabel = "This code expired.";
          this.retryLabel = "Try again";
          this.retryIcon = "⟳";
          this.okLabel = "OK";
          this.selectLabel = "Select";
          this.moveIcon = "◀ ▶";
          this.moveLabel = "Move";
        }, 50);
        this.address = "Connecting…";
        this.code = "••••••";
        this.qr = "";
        this.error = "";
        try {
          const code = await api.beginPairing(`viptv ${platform}`, { signal: pairingScope.signal });
          if (generation !== pairingGeneration) return;
          this.address = code.verificationUri.replace(/^https?:\/\//i, "");
          this.code = code.userCode;
          this.qr = await QRCode.toDataURL(code.verificationUriComplete || code.verificationUri);
          if (generation !== pairingGeneration) return;
          const expiresAt = Date.now() + code.expiresIn * 1000;
          const poll = async (pair: DevicePairing) => {
            if (generation !== pairingGeneration) return;
            if (Date.now() > expiresAt) {
              this.phase = "expired";
              this.expiredLabel = "";
              setTimeout(() => { if (generation === pairingGeneration) this.expiredLabel = "This code expired."; }, 50);
              return;
            }
            try {
              await api.claimPairing(pair.deviceCode, { signal: pairingScope?.signal });
              if (generation !== pairingGeneration) return;
              const identity = await api.me({ signal: pairingScope?.signal });
              if (generation === pairingGeneration) this.showProfiles(identity.profiles);
            } catch (cause) {
              if (generation !== pairingGeneration || pairingScope?.signal.aborted) return;
              const status = (cause as { status?: number }).status;
              if (status === 400 || status === 428) {
                pairingTimer = setTimeout(() => void poll(pair), Math.max(1, pair.intervalSeconds) * 1000);
              } else {
                this.error = cause instanceof Error ? cause.message : "The TV could not complete this request.";
                this.phase = "error";
              }
            }
          };
          pairingTimer = setTimeout(() => void poll(code), Math.max(1, code.intervalSeconds) * 1000);
        } catch (cause) {
          if (generation !== pairingGeneration || pairingScope?.signal.aborted) return;
          this.error = cause instanceof Error ? cause.message : "The TV could not complete this request.";
          this.phase = "error";
        }
      },
    },
    input: {
      // Blits dispatches key-down and invokes a returned callback on key-up.
      // This keeps the existing release-to-activate semantics on this screen.
      enter() {
        if (this.phase !== "expired" && this.phase !== "error" && this.phase !== "pairing") return;
        return () => void this.beginPairing();
      },
      back() {
        if (this.liveDetailsOpen) this.closeLiveDetails();
        else if (this.titleMenuOpen) this.closeTitleMenu();
        else if (this.railExpanded) this.closeRail();
        else if (this.discoverFilterOpen) this.closeDiscoverFilter();
        else if (this.phase === "profiles" && this.managing) this.toggleManageProfiles();
        else if (this.phase === "playerTracks") this.closeTrackPanel();
        else if (this.phase === "player") {
          if (this.trackPanelOpen) this.closeTrackPanel();
          else if (this.playerSeekPreview !== null) {
            this.playerSeekPreview = null;
            this.playerSeekLabel = "";
            this.playerLegend = "OK  Select     ◀ ▶  Move     BACK  Hide controls";
            if (this.playerSnapshot) this.updatePlayerSnapshot(this.playerSnapshot);
          } else if (this.playerOverlay) {
            this.playerOverlay = false;
            this.setPlayerShade(false);
            clearTimeout(chromeTimer);
            this.$focus();
          } else void this.exitPlayer();
        }
        else if (this.phase === "preparing") void this.exitPlayer();
        else if (this.phase === "sourceDetails") this.closeSourceDetails();
        else if (this.phase === "provider") this.closeProviderPicker();
        else if (this.phase === "sources") this.closeSources();
        else if (this.phase === "detail") this.returnFromDetail();
        else if (this.phase === "discover") this.returnFromDiscover();
        else if (this.phase === "library") this.returnFromLibrary();
        else if (this.phase === "search") this.backFromSearch();
        else if (this.phase === "settings") this.backFromSettings();
        else if (this.phase === "live") {
          if (this.liveSearchOpen) this.closeLiveSearch();
          else this.returnFromLive();
        }
        else if (this.phase === "home" && this.profiles.length) this.showProfiles(this.profiles);
      },
      any() {
        if (this.phase === "player" && !this.playerOverlay) this.focusPlayerControl(1);
      },
    },
  });
}
