import { RemoteError } from "../api";
import type { Bootstrap } from "../types";

type Revision = Record<string, number | string>;
export function createRevisionPoller(options: {
  ready: () => boolean; playing: () => boolean; blocked: () => boolean; alive: () => boolean;
  profile: () => string | undefined; signal: () => AbortSignal;
  read: (signal: AbortSignal) => Promise<Revision>; bootstrap: (signal: AbortSignal) => Promise<Bootstrap>;
  playback: () => Promise<void>; reset: () => void; adoptBootstrap: (value: Bootstrap) => void;
  apply: (value: Bootstrap, signal: AbortSignal, profile: string, commit: () => void) => Promise<void>;
  fail: (error: unknown) => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined, observed = "";
  const stop = () => clearTimeout(timer);
  const adopt = (value: Revision) => {observed = JSON.stringify(value);};
  function schedule() {
    stop();
    timer = setTimeout(async () => {
      try {
        if (!options.ready()) return;
        if (options.playing()) {await options.playback();return;}
        const signal = options.signal(), profile = options.profile()!;
        const revision = await options.read(signal);
        if (JSON.stringify(revision) === observed) return;
        const fresh = await options.bootstrap(signal);
        if (options.profile() !== profile) {options.reset();options.adoptBootstrap(fresh);return;}
        if (options.blocked()) return;
        await options.apply(fresh, signal, profile, () => adopt(fresh.revisions ?? revision));
      } catch (error) {
        if (error instanceof RemoteError && error.status === 401) options.fail(error);
        else if (error instanceof RemoteError && error.status === 403) {
          try {const fresh = await options.bootstrap(options.signal());options.reset();options.adoptBootstrap(fresh);}
          catch (next) {options.fail(next);}
        }
      } finally {if (options.alive()) schedule();}
    }, 15000);
  }
  return {schedule, stop, adopt};
}
