import Blits from "@lightningjs/blits";
import QRCode from "qrcode";
import type { TvApi, DevicePairing } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";

type TvPlatform = "tizen" | "vizio" | "webos";
const px = (name: keyof typeof tokens) => Number.parseFloat(String(tokens[name]));
// Lightning's web-font texture is wider than the DOM glyph run at the same
// nominal size. This measured renderer adjustment keeps the code inside the
// current TV card while the full pixel-parity pass remains open.
const pairCodeSize = Number.parseFloat(tokens["type.tv.pair-code"].fontSize) * (80 / 88);

function pairingGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 800;
  const context = canvas.getContext("2d")!;
  // CSS reference: radial-gradient(closest-side, wash, transparent) on a
  // 1400×800 pseudo-element centred at 50% × 45% of the TV frame.
  context.translate(700, 400);
  context.scale(700, 400);
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
    template: `
      <Element w="1920" h="1080" color="$background">
        <Element x="260" y="86" w="1400" h="800" src="$glow" />
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
        <Text x="96" y="54" :show="$phase === 'profiles'" :content="$profilesLabel" font="Bricolage" size="56" color="$primary" />
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
        glow: pairingGlow(),
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
            this.phase = "profiles";
            setTimeout(() => { this.profilesLabel = "Who's watching?"; }, 50);
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
              await api.me({ signal: pairingScope?.signal });
              if (generation === pairingGeneration) this.phase = "profiles";
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
    },
  });
}
