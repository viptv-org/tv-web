import type { Accessor } from "solid-js";
import type { RemoteTvApi } from "./api";
import type { Detail, Home, Management, Page, Program } from "./types";
import type { Overlay } from "./app-types";

/** Entering a profile — and the prompt that entering one needs.
 *
 * A profile that needs a parent PIN, or a slot that creates one, both ask for a
 * value before anything changes; the prompt is here because it belongs to this
 * flow, not because text entry does. Selecting a profile tears the old one down
 * *before* the bootstrap request, so no screen can draw the previous profile's
 * rows while the new one is being adopted.
 */
export function createProfileEntry(options: {
  api: RemoteTvApi;
  call: <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
  signal: () => AbortSignal;
  management: Accessor<Management | undefined>;
  available: (value?: { availability: string }) => boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  closeOverlay: () => void;
  openOverlay: (value: Overlay) => void;
  /** The profile change resets the previous profile's view. */
  clear: {
    stopPlayer: () => Promise<void>;
    resetScope: () => AbortSignal;
    history: { length: number };
    setHome: (value: Home | undefined) => void;
    setPage: (value: Page) => void;
    setDetail: (value: Detail | undefined) => void;
    setPrograms: (value: Record<string, Program[]>) => void;
  };
  applyBootstrap: (value: never) => void;
}) {
  /** The app's one text prompt: everything that needs a typed value opens it. */
  function edit(title: string, submit: (value: string) => Promise<void>, initial = "", secret = false) {
    options.openOverlay({
      kind: "text",
      title,
      initial,
      secret,
      numeric: secret && title.endsWith("PIN"),
      submit,
    });
  }

  async function selectProfile(index: number): Promise<void> {
    const profile = options.management()?.profiles[index];
    if (!profile) {
      if (!options.available(options.management()?.capabilities.create)) {
        await options.run(options.refreshProfiles);
        return;
      }
      edit("Profile name", async name => {
        await options.call("/api/profiles", "POST", { name });
        await options.refreshProfiles();
        options.closeOverlay();
      });
      return;
    }
    if (profile.selection_requires_parent) {
      edit(
        "Parent PIN",
        async pin => {
          await options.call("/api/parent/unlock", "POST", { pin });
          await options.refreshProfiles();
          options.closeOverlay();
          await selectProfile(index);
        },
        "",
        true,
      );
      return;
    }
    await options.run(async () => {
      await options.clear.stopPlayer();
      options.clear.resetScope();
      options.clear.history.length = 0;
      options.clear.setHome(undefined);
      options.clear.setPage({ cards: [], complete: true });
      options.clear.setDetail(undefined);
      options.clear.setPrograms({});
      options.applyBootstrap((await options.api.selectProfile(profile.id, options.signal())) as never);
    });
  }

  return { edit, selectProfile };
}

export type ProfileEntry = ReturnType<typeof createProfileEntry>;