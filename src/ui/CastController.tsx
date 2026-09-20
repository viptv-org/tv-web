import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VizioControllerOutput, VizioRemoteKey } from "../../vendor/core/typescript/wire";
import "./CastController.css";

export interface CastControllerProps {
  /** Public receiver deployed by the host; never the local Tauri window origin. */
  receiverUrl?: string;
  onClose(): void;
}

type Challenge = { challengeType: number; token: number };
type DiscoveredTv = { name: string; host: string };

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

/** The containing modal owns focus trapping and restoration to its opener. */
export function CastController({ receiverUrl, onClose }: CastControllerProps) {
  const native = "__TAURI_INTERNALS__" in window;
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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (native && active.current) void invoke("smartcast_cancel").catch(() => undefined);
    };
  }, [native]);

  // Native mode searches the local network once per open; browser mode keeps
  // its handoff copy and never issues a command.
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    setDiscovering(true);
    setDiscoveryNote("");
    invoke<string>("smartcast_discover")
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
    const output = JSON.parse(await invoke<string>("smartcast_run", { operation, input: JSON.stringify(input) })) as VizioControllerOutput;
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
      await invoke("smartcast_configure", { host: address, deviceId: "viptv-desktop", deviceName: "VIPTV desktop", credentialId });
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
    await connectTo(host.trim());
  }

  async function pair(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
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
    if (native && active.current) void invoke("smartcast_cancel").catch(() => undefined);
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
    await invoke("smartcast_forget");
    if (mounted.current) { setConnected(false); setChallenge(null); setPin(""); setMessage("Saved TV pairing removed from this app."); }
  });

  return <section className="cast-controller" aria-label="Watch on TV" aria-busy={busy}>
    <h2>Watch on TV</h2>
    {!native ? <>
      <p>TV pairing is available in a VIPTV desktop app with SmartCast support. Open that app on the same network as your Vizio TV, then choose Watch on TV.</p>
      <p>This browser cannot pair with or control your TV. Your current playback stays here.</p>
    </> : <>
      <p>Connect to a Vizio SmartCast TV on the same network.</p>
      {!connected && !challenge && <>
        {discovering && <p role="status">Searching for TVs…</p>}
        {discovered.length > 0 && <ul className="cast-controller-tvs" aria-label="Discovered TVs">
          {discovered.map(tv => <li key={tv.host}><button type="button" disabled={busy} onClick={() => { setHost(tv.host); void connectTo(tv.host); }}>{tv.name}</button></li>)}
        </ul>}
        {discoveryNote && <p role="status">{discoveryNote}</p>}
        <button type="button" className="cast-controller-manual" aria-expanded={manual} onClick={() => setManual(value => !value)}>Enter IP address manually</button>
        {manual && <form onSubmit={connect}>
          <label htmlFor="cast-tv-address">TV IP address</label>
          <div className="cast-controller-fields">
            <input id="cast-tv-address" value={host} onChange={event => setHost(event.target.value)} placeholder="192.168.1.50" autoComplete="off" spellCheck={false} required disabled={busy} maxLength={253} />
            <button type="submit" disabled={busy || !host.trim()}>Connect</button>
          </div>
        </form>}
      </>}
      {challenge && <form onSubmit={pair}>
        <label htmlFor="cast-tv-pin">PIN shown on your TV</label>
        <div className="cast-controller-fields">
          <input id="cast-tv-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={event => setPin(event.target.value)} maxLength={32} required disabled={busy} />
          <button type="submit" disabled={busy || !pin}>Pair TV</button>
        </div>
      </form>}
      {connected && <>
        <button type="button" onClick={launch} disabled={busy || !receiverUrl}>Open VIPTV on TV</button>
        {!receiverUrl && <p>A TV receiver has not been configured for this app. Pairing and remote controls are available; launching VIPTV is unavailable.</p>}
        {receiverUrl && <p>Opens the VIPTV receiver. Choose your profile and content on the TV; this does not transfer the current video.</p>}
        <div className="cast-controller-pad" aria-label="TV remote">
          {([ ["UP", "Up"], ["LEFT", "Left"], ["OK", "OK"], ["RIGHT", "Right"], ["DOWN", "Down"] ] as const).map(([code, label]) => <button type="button" key={code} className={`cast-key-${code.toLowerCase()}`} disabled={busy} onClick={() => key(code)}>{label}</button>)}
        </div>
        <div className="cast-controller-actions">
          {([ ["BACK", "Back on TV"], ["PLAY", "Play"], ["PAUSE", "Pause"], ["VOL_DOWN", "Volume down"], ["VOL_UP", "Volume up"] ] as const).map(([code, label]) => <button type="button" key={code} disabled={busy} onClick={() => key(code)}>{label}</button>)}
          <button type="button" disabled={busy} onClick={forget}>Forget TV</button>
        </div>
      </>}
      {(challenge || connected) && <button type="button" onClick={changeTv} disabled={busy}>Change TV</button>}
      {busy && <p role="status">Contacting your TV…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </>}
    <button type="button" onClick={close}>Close</button>
  </section>;
}
