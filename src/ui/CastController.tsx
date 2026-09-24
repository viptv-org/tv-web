/*
 * Watch on TV (design references: DeskCastSearch, DeskCastManual, DeskCastBusy, DeskCastPin,
 * DeskCastRemote, DeskCastError, WebCastUnavailable, PhCastUnavailable). A centred dialog on
 * desktop (580 wide once a TV is connected, for the remote), a bottom sheet on phones. Styles:
 * src/styles/screens/settings.css (.vx-cast-*) on the overlay / field / button primitives.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Monitor, Pause, Volume1, Volume2 } from "lucide-react";
import type { VizioControllerOutput, VizioRemoteKey } from "../../vendor/core/typescript/wire";
import { DialogBackdrop } from "./DialogBackdrop";
import { Dialog, DialogText } from "./primitives/Overlays";
import { ButtonContent, buttonClass } from "./primitives/Button";
import { TextField } from "./primitives/Fields";
import { InlineError, StatusLine } from "./primitives/Feedback";
import { PlayIcon } from "./primitives/icons";

export interface CastControllerProps {
  /** Public receiver deployed by the host; never the local Tauri window origin. */
  receiverUrl?: string;
  onClose(): void;
}

type Challenge = { challengeType: number; token: number };
type DiscoveredTv = { name: string; host: string };
type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Dev-only preview bridge (tests/preview): a scripted SmartCast in a plain browser, so the
 * pairing states can be rendered without the Tauri runtime. Never present in builds.
 */
const previewBridge = import.meta.env.DEV
  ? (globalThis as { __VIPTV_SMARTCAST_PREVIEW__?: { invoke: Invoke; receiverUrl?: string } }).__VIPTV_SMARTCAST_PREVIEW__
  : undefined;

/** Trust the native discovery list only as far as its shape: a name to show, an address to connect. */
function parseDiscoveredTvs(payload: string): DiscoveredTv[] {
  const list: unknown = JSON.parse(payload);
  if (!Array.isArray(list)) return [];
  return list.flatMap(item => {
    if (typeof item !== "object" || item === null) return [];
    const { host, name } = item as Record<string, unknown>;
    if (typeof host !== "string" || !host.trim()) return [];
    const address = host.trim();
    return [{ host: address, name: typeof name === "string" && name.trim() ? name.trim() : `TV (${address})` }];
  });
}

const REMOTE_PAD = [
  ["UP", "Up", <ChevronUp key="up" aria-hidden="true" strokeWidth={2.4} />],
  ["LEFT", "Left", <ChevronLeft key="left" aria-hidden="true" strokeWidth={2.4} />],
  ["OK", "OK", null],
  ["RIGHT", "Right", <ChevronRight key="right" aria-hidden="true" strokeWidth={2.4} />],
  ["DOWN", "Down", <ChevronDown key="down" aria-hidden="true" strokeWidth={2.4} />],
] as const;
const REMOTE_KEYS: readonly (readonly [VizioRemoteKey, string, ReactNode])[] = [
  ["BACK", "Back on TV", <ChevronLeft key="back" aria-hidden="true" strokeWidth={2.2} />],
  ["PLAY", "Play", <PlayIcon key="play" aria-hidden="true" />],
  ["PAUSE", "Pause", <Pause key="pause" aria-hidden="true" strokeWidth={2.2} />],
  ["VOL_DOWN", "Volume down", <Volume1 key="down" aria-hidden="true" strokeWidth={2.2} />],
  ["VOL_UP", "Volume up", <Volume2 key="up" aria-hidden="true" strokeWidth={2.2} />],
];

/** Owns its overlay layer; focus returns to the opener through the app's closeCast. */
export function CastController({ receiverUrl = previewBridge?.receiverUrl, onClose }: CastControllerProps) {
  const native = "__TAURI_INTERNALS__" in window || previewBridge !== undefined;
  const call: Invoke = previewBridge ? previewBridge.invoke : invoke;
  const [host, setHost] = useState("");
  const [pin, setPin] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredTv[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [manual, setManual] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (native && active.current) void call("smartcast_cancel").catch(() => undefined);
    };
  }, [native]);

  // Native mode searches the local network once per open; browser mode keeps
  // its handoff copy and never issues a command.
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    setDiscovering(true);
    setDiscoveryNote("");
    call<string>("smartcast_discover")
      .then(payload => {
        if (cancelled || !mounted.current) return;
        const found = parseDiscoveredTvs(payload);
        setDiscovered(found);
        if (found.length === 0) setDiscoveryNote("No Vizio TVs were found on this network. Enter the IP address manually.");
      })
      .catch(() => {
        if (!cancelled && mounted.current) setDiscoveryNote("Could not search for TVs automatically. Enter the IP address manually.");
      })
      .finally(() => {
        if (!cancelled && mounted.current) setDiscovering(false);
      });
    return () => { cancelled = true; };
  }, [native]);

  async function run(operation: string, input: Record<string, unknown> = {}) {
    const output = JSON.parse(await call<string>("smartcast_run", { operation, input: JSON.stringify(input) })) as VizioControllerOutput;
    if (output.kind !== "complete" && output.kind !== "error") throw new Error("Native controller returned an unfinished operation");
    return output;
  }

  function accepted(output: VizioControllerOutput) {
    if (output.kind === "error") {
      if (mounted.current) setError(output.error?.message || "The TV could not complete this request.");
      return false;
    }
    return true;
  }

  async function perform(action: () => Promise<void>) {
    if (!native || active.current) return;
    active.current = true;
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch {
      if (mounted.current) setError("The native TV controller is unavailable. Use a VIPTV desktop app with SmartCast support and try again.");
    }
    finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function connectTo(address: string) {
    await perform(async () => {
      // This is a vault lookup identifier, not a credential; nothing persists in the renderer.
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address.toLowerCase()));
      const credentialId = `tv-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
      await call("smartcast_configure", { host: address, deviceId: "viptv-desktop", deviceName: "VIPTV desktop", credentialId });
      if (!mounted.current) return;
      const check = await run("pingAuth");
      if (!mounted.current) return;
      if (check.kind === "complete") { setConnected(true); setMessage("Connected to your TV."); return; }
      if (check.error?.kind !== "authentication") { accepted(check); return; }
      const pairing = await run("beginPair");
      if (!mounted.current || !accepted(pairing)) return;
      const result = pairing.result;
      if (typeof result?.challengeType !== "number" || typeof result.token !== "number") {
        setError("The TV did not return a pairing challenge. Try again."); return;
      }
      setChallenge({ challengeType: result.challengeType, token: result.token });
      setMessage("Enter the PIN displayed on your TV.");
    });
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (!host.trim()) return;
    await connectTo(host.trim());
  }

  async function pair(event: FormEvent) {
    event.preventDefault();
    if (!challenge || !pin) return;
    const submitted = pin;
    setPin("");
    await perform(async () => {
      const output = await run("finishPair", { ...challenge, pin: submitted });
      if (!mounted.current || !accepted(output)) return;
      if (output.result?.paired !== true) { setError("The TV did not confirm pairing. Try again."); return; }
      setChallenge(null); setConnected(true); setMessage("Paired with your TV.");
    });
  }

  const changeTv = () => perform(async () => {
    try {
      if (challenge) {
        const output = await run("cancelPair");
        if (mounted.current) accepted(output);
      }
    } finally {
      if (mounted.current) { setChallenge(null); setConnected(false); setPin(""); setHost(""); }
    }
  });
  function close() {
    mounted.current = false;
    if (native && active.current) void call("smartcast_cancel").catch(() => undefined);
    active.current = false;
    onClose();
  }

  const launch = () => perform(async () => {
    if (!receiverUrl) return;
    const output = await run("launchConjure", { url: receiverUrl });
    if (mounted.current && accepted(output)) setMessage("The TV accepted the launch request. Continue in VIPTV on your TV.");
  });
  const key = (key: VizioRemoteKey) => perform(async () => {
    const output = await run("key", { key });
    if (mounted.current) accepted(output);
  });
  const forget = () => perform(async () => {
    await call("smartcast_forget");
    if (mounted.current) { setConnected(false); setChallenge(null); setPin(""); setMessage("Saved TV pairing removed from this app."); }
  });

  // With nothing discovered, the address form is the way in (DeskCastManual): no toggle then.
  const choosing = native && !connected && !challenge;
  const formShown = choosing && (manual || (!discovering && discovered.length === 0));
  const toggleShown = choosing && (discovering || discovered.length > 0);
  // The field takes focus when the form appears (the placeholder shows the expected shape).
  useEffect(() => {
    if ((formShown || challenge) && !busy) field.current?.focus({ preventScroll: true });
  }, [formShown, !!challenge, busy]);

  const closeButton = (
    <button type="button" className={buttonClass({ block: true })} disabled={busy} onClick={close}>Close</button>
  );
  const errorLine = error ? <InlineError>{error}</InlineError> : null;
  const status = busy
    ? <StatusLine>Contacting your TV…</StatusLine>
    : message && !challenge
      ? <div className="vx-status vx-cast__message" role="status">{message}</div>
      : null;

  const body = !native ? (
    <>
      <DialogText>TV pairing is available in a VIPTV desktop app with SmartCast support. Open that app on the same network as your Vizio TV, then choose Watch on TV.</DialogText>
      <DialogText>This browser cannot pair with or control your TV. Your current playback stays here.</DialogText>
      <div className="vx-dialog__actions">{closeButton}</div>
    </>
  ) : (
    <>
      <DialogText>Connect to a Vizio SmartCast TV on the same network.</DialogText>
      {choosing && discovering && <StatusLine>Searching for TVs…</StatusLine>}
      {choosing && discovered.length > 0 && (
        <ul className="vx-cast__tvs" aria-label="Discovered TVs">
          {discovered.map(tv => (
            <li key={tv.host}>
              <button type="button" className="vx-cast__tv" disabled={busy} onClick={() => { setHost(tv.host); void connectTo(tv.host); }}>
                <span className="vx-cast__tv-icon" aria-hidden="true"><Monitor strokeWidth={2} /></span>
                <span className="vx-cast__tv-name">{tv.name}</span>
                <ChevronRight className="vx-cast__tv-chevron" aria-hidden="true" strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {choosing && discoveryNote && <DialogText>{discoveryNote}</DialogText>}
      {challenge && message && <DialogText>{message}</DialogText>}
      {formShown && (
        <form className="vx-cast__form" onSubmit={connect} aria-label="Connect to a TV">
          <TextField
            ref={field}
            label="TV IP address"
            id="cast-tv-address"
            value={host}
            onChange={event => setHost(event.target.value)}
            placeholder="192.168.1.50"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={busy}
            maxLength={253}
          />
          {status}
          {errorLine}
          <div className="vx-dialog__actions">
            <button type="submit" className={buttonClass({ kind: "primary", block: true })} disabled={busy}>Connect</button>
            {toggleShown && (
              <button type="button" className={buttonClass({ block: true })} aria-expanded={manual} onClick={() => setManual(value => !value)}>Enter IP address manually</button>
            )}
            {closeButton}
          </div>
        </form>
      )}
      {choosing && !formShown && (
        <>
          {status}
          {errorLine}
          <div className="vx-dialog__actions">
            <button type="button" className={buttonClass({ block: true })} aria-expanded={manual} onClick={() => setManual(value => !value)}>Enter IP address manually</button>
            {closeButton}
          </div>
        </>
      )}
      {challenge && (
        <form className="vx-cast__form" onSubmit={pair} aria-label="Pair with your TV">
          <TextField
            ref={field}
            label="PIN shown on your TV"
            id="cast-tv-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={event => setPin(event.target.value)}
            maxLength={32}
            required
            disabled={busy}
          />
          {status}
          {errorLine}
          <div className="vx-dialog__actions">
            <button type="submit" className={buttonClass({ kind: "primary", block: true })} disabled={busy}>Pair TV</button>
            <button type="button" className={buttonClass({ kind: "quiet", block: true })} onClick={changeTv} disabled={busy}>Change TV</button>
            {closeButton}
          </div>
        </form>
      )}
      {connected && (
        <>
          {status}
          <div className="vx-cast__launch">
            <button type="button" className={buttonClass({ kind: "primary", block: true, icon: true })} onClick={launch} disabled={busy || !receiverUrl}>
              <ButtonContent icon={<ExternalLink aria-hidden="true" strokeWidth={2.2} />}>Open VIPTV on TV</ButtonContent>
            </button>
            <p className="vx-cast__note">
              {receiverUrl
                ? "Opens the VIPTV receiver. Choose your profile and content on the TV; this does not transfer the current video."
                : "A TV receiver has not been configured for this app. Pairing and remote controls are available; launching VIPTV is unavailable."}
            </p>
          </div>
          {errorLine}
          <div className="vx-cast__remote">
            <div className="vx-cast__pad" role="group" aria-label="TV remote">
              {REMOTE_PAD.map(([code, label, icon]) => (
                <button
                  type="button"
                  key={code}
                  className={`vx-cast__pad-key vx-cast__pad-key--${code.toLowerCase()}`}
                  aria-label={icon ? label : undefined}
                  disabled={busy}
                  onClick={() => key(code)}
                >
                  {icon ?? label}
                </button>
              ))}
            </div>
            <div className="vx-cast__keys">
              {REMOTE_KEYS.map(([code, label, icon]) => (
                <button type="button" key={code} className={buttonClass({ size: "small", icon: true, className: "vx-cast__key" })} disabled={busy} onClick={() => key(code)}>
                  <ButtonContent icon={icon}>{label}</ButtonContent>
                </button>
              ))}
            </div>
          </div>
          <div className="vx-dialog__actions">
            <div className="vx-cast__pair-actions">
              <button type="button" className={buttonClass({ kind: "destructive" })} disabled={busy} onClick={forget}>Forget TV</button>
              <button type="button" className={buttonClass()} onClick={changeTv} disabled={busy}>Change TV</button>
            </div>
            {closeButton}
          </div>
        </>
      )}
    </>
  );

  return (
    <DialogBackdrop onCancel={close} scope="cast" className="vx-cast-layer">
      <Dialog title="Watch on TV" onClose={close} className={`vx-cast${connected ? " vx-cast--remote" : ""}`}>
        <div className="vx-cast__body" aria-busy={busy}>{body}</div>
      </Dialog>
    </DialogBackdrop>
  );
}
