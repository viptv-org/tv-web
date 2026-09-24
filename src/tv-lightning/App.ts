import Blits from "@lightningjs/blits";
import QRCode from "qrcode";
import type { TvApi, DevicePairing, TvProfile } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";
import { ProfileTile, ManageProfilesButton, addProfileTile, emptyProfileTile, profileTileData } from "./ProfileTile";

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
  let disposeSession: (() => void) | undefined;
  return Blits.Application({
    components: { ProfileTile, ManageProfilesButton },
    template: `
      <Element w="1920" h="1080" color="$background">
        <Element x="260" y="86" w="1400" h="800" src="$pairingGlow" :show="$phase !== 'profiles'" />
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
        danger: tokens["color.status.danger-tv"],
        codeSize: pairCodeSize,
        codeLetterSpacing: pairCodeSize * 0.08,
        phase: "starting" as "starting" | "pairing" | "expired" | "error" | "profiles" | "ready",
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
          if (view.phase === "Pairing") void this.beginPairing();
          else if (view.phase === "Profiles") {
            if (view.identity) this.showProfiles(view.identity.profiles);
            else void api.me().then(identity => this.showProfiles(identity.profiles), cause => {
              this.error = cause instanceof Error ? cause.message : "Could not load profiles.";
              this.phase = "error";
            });
          }
          else if (view.phase === "Ready") {
            this.phase = "ready";
            setTimeout(() => { this.startingLabel = "Starting VIPTV…"; }, 50);
          }
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
        void session.dispatch({ Begin: {
          origin: api.serverOrigin,
          allowInsecurePreview: import.meta.env.DEV && api.serverOrigin === location.origin,
        } });
      },
      destroy() {
        ++pairingGeneration;
        pairingScope?.abort();
        clearTimeout(pairingTimer);
        disposeSession?.();
      },
    },
    methods: {
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
      },
    },
  });
}
