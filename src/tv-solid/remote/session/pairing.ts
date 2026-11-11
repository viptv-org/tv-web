import { RemoteError, delay, type RemoteTvApi } from "../api";
import type { Bootstrap, Pairing } from "../types";

export function createPairingFlow(options: {
  api: Pick<RemoteTvApi, "pair" | "claim" | "bootstrap">;
  begin: () => AbortSignal; retry: (work: () => Promise<void>) => void;
  issued: (value: Pairing) => void; deadline: (value: number) => void; qr: (value: string) => void; ready: () => void;
  complete: (value: Bootstrap) => void; fail: (error: unknown) => void;
}) {
  const {fail} = options;
  async function beginPairing() {
    const signal = options.begin();
    options.retry(beginPairing);
    try {
      const value = await options.api.pair(signal);
      options.issued(value);
      const expires = performance.now() + value.expires_in * 1000;
      options.deadline(expires);
      // Pairing is the only QR consumer in the TV entry, so the 70 KiB
      // encoder is fetched by the screen that draws one, not by every boot.
      const { default: QRCode } = await import("qrcode");
      const codeImage = await QRCode.toDataURL(
        value.verification_uri_complete ?? value.verification_uri,
        { width: 300, margin: 2 },
      );
      if (signal.aborted) return;
      options.qr(codeImage);
      options.ready();
      let interval = value.interval;
      while (performance.now() < expires) {
        await delay(interval * 1000, signal);
        try {
          await options.api.claim(value.device_code, signal);
          const authenticated = await options.api.bootstrap(signal);
          options.complete(authenticated);
          return;
        } catch (e) {
          if (
            e instanceof RemoteError &&
            (e.code === "authorization_pending" || e.status === 429)
          ) {
            if (e.status === 429) interval = Math.min(60, interval + 5);
            continue;
          }
          throw e;
        }
      }
      throw new Error("This code has expired. Get a new code.");
    } catch (e) {
      fail(e);
    }
  }
  return beginPairing;
}
