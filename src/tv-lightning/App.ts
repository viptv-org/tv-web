import Blits from "@lightningjs/blits";
import QRCode from "qrcode";
import type { TvApi, DevicePairing, TvProfile, MediaItem, MediaSource } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";
import { ProfileTile, ManageProfilesButton, addProfileTile, emptyProfileTile, profileTileData } from "./ProfileTile";
import { emptyHome, enrichHomeHero, loadHomeView, type HomeView } from "./homeModel";
import { railIcon } from "./railIcons";
import { HomeAction, HomeCard } from "./HomeFocus";
import { emptyHomeCard } from "./homeModel";
import { emptyDetail, emptyDetailEpisode, loadDetailView, type DetailView } from "./detailModel";
import { TitleAction, EpisodeTile } from "./TitleFocus";
import { emptySources, emptySourceRow, projectSources, type SourcesView } from "./sourceModel";
import { SourceChip, SourceProvider, SourceRow, ProviderOption, SourceDetailsClose, emptySourceChip, emptyProviderChoice } from "./SourceFocus";
import { notePlayerState, noteSourceFilter, noteSourceIntent, noteSourceWindow } from "./focusDebug";
import { createLightningPlaybackRuntime, type LightningPlaybackRuntime } from "./playbackRuntime";
import { PlayerControl, PlayerTimeline } from "./PlayerFocus";
import type { PlayerSnapshot } from "@viptv/video";
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
  let sourceGeneration = 0;
  let sourceScope: ReturnType<TvApi["createScope"]> | undefined;
  let sourceTimer: ReturnType<typeof setTimeout> | undefined;
  let playback: LightningPlaybackRuntime | undefined;
  let playbackGeneration = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let chromeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposeSession: (() => void) | undefined;
  return Blits.Application({
    components: { ProfileTile, ManageProfilesButton, HomeAction, HomeCard, TitleAction, EpisodeTile, SourceChip, SourceProvider, SourceRow, ProviderOption, SourceDetailsClose, PlayerControl, PlayerTimeline },
    template: `
      <Element w="1920" h="1080" :color="$phase === 'player' || $phase === 'preparing' ? 'rgba(0,0,0,0)' : $background">
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
        <Element :show="$phase === 'home'">
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
        <Element :show="$phase === 'detail' || $phase === 'sources' || $phase === 'provider' || $phase === 'sourceDetails'">
          <Element x="1120" y="0" w="800" h="720" :src="$detail.heroImage" :show="$detail.heroImage !== ''" alpha="0.75" />
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
        <Element :show="$phase === 'player' && $playerOverlay">
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
        <Text x="700" y="190" maxwidth="520" align="center" :content="$playerNotice" font="Onest" size="24" color="$primary" :show="$phase === 'player'" />
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
        sourceReturnZone: "action" as "action" | "episode",
        sourceReturnIndex: 0,
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
        currentProfileId: "",
        homeNotice: "",
        homeAddLabel: "",
        homeShelfLabel: "",
        surface: tokens["color.surface.3"],
        secondary: tokens["color.text.secondary"],
        noticeGlass: tokens["color.fill.notice-glass-tv"],
        railSearch: railIcon("search"),
        railHome: railIcon("home", true),
        railDiscover: railIcon("discover"),
        railLive: railIcon("live"),
        railList: railIcon("list"),
        railSettings: railIcon("settings"),
        homeProfileAvatar: "",
        optionsIcon: "",
        optionsLabel: "",
        danger: tokens["color.status.danger-tv"],
        codeSize: pairCodeSize,
        codeLetterSpacing: pairCodeSize * 0.08,
        phase: "starting" as "starting" | "pairing" | "expired" | "error" | "profiles" | "ready" | "home" | "detail" | "sources" | "provider" | "sourceDetails" | "preparing" | "player",
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
        const session = api.createSessionDriver((view) => {
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
        this.$listen("title-action-move", (delta: number) =>
          this.focusTitleAction(Math.max(0, Math.min(3, this.detailActionIndex + Number(delta)))));
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
        const generation = ++homeGeneration;
        homeScope?.abort();
        homeScope = api.createScope();
        const selectedProfile = this.profiles.find(profile => profile.id === profileId);
        this.homeProfileAvatar = selectedProfile ? profileTileData(selectedProfile).image : "";
        this.currentProfileId = profileId;
        this.homeNotice = "";
        this.phase = "ready";
        this.startingLabel = "Starting VIPTV…";
        try {
          const view = await loadHomeView(api, profileId, homeScope.signal);
          if (generation !== homeGeneration || homeScope.signal.aborted) return;
          this.phase = "home";
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
          }, 50);
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
        this.focusHomeCard(Math.max(0, Math.min(count - 1, this.homeCardIndex + delta)));
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
        if (this.phase !== "home") return;
        const generation = ++detailGeneration;
        detailScope?.abort();
        detailScope = api.createScope();
        this.detailReturnZone = this.homeFocusZone;
        this.detailReturnIndex = this.homeFocusZone === "card" ? this.homeCardIndex : this.homeActionIndex;
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
        if (this.phase !== "detail") return;
        const generation = ++sourceGeneration;
        sourceScope?.abort();
        clearTimeout(sourceTimer);
        const scope = api.createScope();
        sourceScope = scope;
        this.sourceReturnZone = this.detailFocusZone;
        this.sourceReturnIndex = this.detailFocusZone === "episode" ? this.detailEpisodeIndex : this.detailActionIndex;
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
      ensurePlaybackRuntime() {
        if (playback) return playback;
        const video = document.getElementById("tv-video") as HTMLVideoElement | null;
        if (!video) throw new Error("TV video surface is unavailable.");
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
          const runtime = this.ensurePlaybackRuntime();
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
        if (!this.playerOverlay || this.playerSnapshot?.state !== "playing") return;
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
          } else this.playerNotice = `${action} is unavailable.`;
        } catch (cause) {
          this.playerNotice = cause instanceof Error ? cause.message : "The TV could not complete this request.";
        }
        this.schedulePlayerChromeHide();
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
        if (this.phase !== "player" && this.phase !== "preparing") return;
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
        this.phase = "detail";
        this.sourceNotice = "";
        setTimeout(() => {
          if (this.sourceReturnZone === "episode") this.focusTitleEpisode(this.sourceReturnIndex);
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
        this.phase = "home";
        this.detailNotice = "";
        setTimeout(() => {
          this.revealHomeControls();
          if (this.detailReturnZone === "card") this.focusHomeCard(this.detailReturnIndex);
          else this.focusHomeAction(this.detailReturnIndex);
        }, 0);
      },
      showProfiles(profiles: readonly TvProfile[]) {
        this.profiles = [...profiles];
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
        if (this.phase === "profiles" && this.managing) this.toggleManageProfiles();
        else if (this.phase === "player") {
          if (this.playerSeekPreview !== null) {
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
        else if (this.phase === "home" && this.profiles.length) this.showProfiles(this.profiles);
      },
      any() {
        if (this.phase === "player" && !this.playerOverlay) this.focusPlayerControl(1);
      },
    },
  });
}
