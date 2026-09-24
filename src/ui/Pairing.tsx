import { useEffect } from "react";
import { Clock, RefreshCw } from "lucide-react";
import type { DevicePairing } from "../api";
import { TvButton, focusElement } from "./remote";
import { buttonClass } from "./primitives/Button";
import { KeyLegend } from "./primitives/Keys";

/**
 * TV sign-in with a pairing code (TvPairing, TvPairingLoading, TvPairingExpired):
 * address + code on the left, QR on the right. Expiry is a persistent state: the
 * code is struck through, "This code expired." shows, Try again takes focus and
 * the QR dims (decisions.md 3).
 */
export function TvPairing({ pair, qr, expired, onRetry, onUseWithoutAccount }: {
  pair?: DevicePairing;
  qr: string;
  expired: boolean;
  onRetry: () => void;
  onUseWithoutAccount?: () => void;
}) {
  useEffect(() => {
    if (expired) focusElement("retry");
  }, [expired]);
  const address = pair?.verificationUri.replace(/^https?:\/\//i, "");
  const code = pair?.userCode ?? "••••••";
  return (
    <section className="vx-pairing" aria-labelledby="pairing-title">
      <span className="vx-pairing__brand">
        <span className="vx-pairing__mark" aria-hidden="true">V</span>
        <span className="vx-pairing__wordmark">VIPTV</span>
      </span>
      <div className="vx-pairing__body">
        <div className="vx-pairing__main">
          <h1 id="pairing-title" className="vx-pairing__title">Sign in to VIPTV</h1>
          <p className="vx-pairing__intro">Visit this address, then enter the code shown below.</p>
          <span className={`vx-pairing__address${pair ? "" : " vx-pairing__address--pending"}`}>
            {address ?? "Connecting…"}
          </span>
          <span
            className={`vx-pairing__code${pair ? "" : " vx-pairing__code--pending"}${expired ? " vx-pairing__code--expired" : ""}`}
            aria-label={`Code ${code}`}
          >
            {code}
          </span>
          {expired && (
            <span className="vx-pairing__status" role="status">
              <Clock aria-hidden="true" />
              This code expired.
            </span>
          )}
          <div className="vx-pairing__actions">
            <TvButton id="retry" className={buttonClass({ icon: true })} onActivate={onRetry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </TvButton>
            {onUseWithoutAccount && (
              <TvButton id="local-mode" className={buttonClass({})} onActivate={onUseWithoutAccount}>
                Use without an account
              </TvButton>
            )}
          </div>
        </div>
        <div className="vx-pairing__qr-slot">
          {qr ? (
            <span className={`vx-pairing__qr${expired ? " vx-pairing__qr--expired" : ""}`} role="img" aria-label="Scan to link your TV">
              <img src={qr} alt="" />
            </span>
          ) : (
            <span className="vx-pairing__qr vx-pairing__qr--pending" aria-hidden="true" />
          )}
        </div>
      </div>
      <KeyLegend corner items={[{ key: "OK", label: "Select" }, { key: "◀ ▶", label: "Move" }]} />
    </section>
  );
}
