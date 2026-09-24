import Blits from "@lightningjs/blits";
import QRCode from "qrcode";
import type { TvApi, DevicePairing, TvProfile, MediaItem } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";
import { ProfileTile, ManageProfilesButton, addProfileTile, emptyProfileTile, profileTileData } from "./ProfileTile";
import { emptyHome, enrichHomeHero, loadHomeView, type HomeView } from "./homeModel";
import { railIcon } from "./railIcons";
import { HomeAction, HomeCard } from "./HomeFocus";
import { emptyHomeCard } from "./homeModel";
import { emptyDetail, emptyDetailEpisode, loadDetailView, type DetailView } from "./detailModel";
import { TitleAction, EpisodeTile } from "./TitleFocus";

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
  let disposeSession: (() => void) | undefined;
  return Blits.Application({
    components: { ProfileTile, ManageProfilesButton, HomeAction, HomeCard, TitleAction, EpisodeTile },
    template: `
      <Element w="1920" h="1080" color="$background">
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
        <Element :show="$phase === 'detail'">
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
        phase: "starting" as "starting" | "pairing" | "expired" | "error" | "profiles" | "ready" | "home" | "detail",
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
        this.$listen("title-action-hold", () => { this.detailNotice = "Choose source is not available yet."; });
        this.$listen("title-episode-activate", () => { this.detailNotice = "Choose source is not available yet."; });
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
        this.detailNotice = action === "info" ? this.detail.synopsis : "Choose source is not available yet.";
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
        else if (this.phase === "detail") this.returnFromDetail();
        else if (this.phase === "home" && this.profiles.length) this.showProfiles(this.profiles);
      },
    },
  });
}
