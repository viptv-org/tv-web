import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Settle playback cleanup before the native host exits. */
export function useNativeShutdown(controller: { current?: { stop(): Promise<void> } }) {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let retired = false;
    let stopping: Promise<void> | undefined;
    const unlisten = listen("app-shutdown-requested", () => {
      if (retired || stopping) return;
      stopping = Promise.resolve()
        .then(() => controller.current?.stop())
        // The host still needs to retire decoders if lease release fails.
        .catch(() => undefined)
        .then(() => invoke("app_shutdown_ready"))
        .then(() => undefined, () => undefined);
    }).catch(() => () => {});
    return () => {
      retired = true;
      void unlisten.then(off => off());
    };
  }, [controller]);
}
