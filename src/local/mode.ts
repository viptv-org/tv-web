/* Local-mode session state (LM-001): entering from the sign-in screen and
   exiting via Settings are boot-level mode switches, so the flag lives in
   durable storage and is only honored in local-capable builds. */
const LOCAL_MODE_KEY = "viptv.local.mode.v1";

export function readLocalMode(): boolean {
  try {
    return globalThis.localStorage.getItem(LOCAL_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enterLocalMode(): void {
  globalThis.localStorage.setItem(LOCAL_MODE_KEY, "1");
}

export function exitLocalMode(): void {
  globalThis.localStorage.removeItem(LOCAL_MODE_KEY);
}
