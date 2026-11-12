import { abort, delay, RemoteError } from "./api";

function transient(error: unknown): boolean {
  return error instanceof RemoteError &&
    [502, 503, 504].includes(error.status) &&
    ["gateway_unavailable", "timeout", "request_failed", "service_unavailable"].includes(error.code);
}

export async function renewWithinLease<T>(options: {
  request: (signal: AbortSignal) => Promise<T>;
  remaining: () => number;
  current: () => boolean;
  signal: AbortSignal;
}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    abort(options.signal);
    if (!options.current()) throw new DOMException("Playback changed", "AbortError");
    if (!Number.isFinite(options.remaining()) || options.remaining() <= 0) throw new Error("Playback authorization expired.");
    try {
      const value = await options.request(options.signal);
      abort(options.signal);
      if (!options.current()) throw new DOMException("Playback changed", "AbortError");
      if (!Number.isFinite(options.remaining()) || options.remaining() <= 0) throw new Error("Playback authorization expired.");
      return value;
    } catch (error) {
      abort(options.signal);
      if (!options.current()) throw new DOMException("Playback changed", "AbortError");
      if (attempt >= 2 || !transient(error)) throw error;
      const remaining = options.remaining();
      if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Playback authorization expired.");
      await delay(Math.min(1000 * (attempt + 1), remaining), options.signal);
    }
  }
}
