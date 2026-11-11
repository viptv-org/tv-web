import type { Accessor } from "solid-js";
import { segment } from "./api";
import type { Management } from "./types";
import type { DialogActions, ScopedRequest, TextPrompt } from "./feature-ports";

/** Profile edits only; switching retains the root playback/scope transaction. */
export function createProfileManagement(options: {
  current: Accessor<Management | undefined>;
  request: ScopedRequest;
  refresh: () => Promise<void>;
  dialogs: DialogActions;
  prompt: TextPrompt;
}) {
  const {current: management, request: call, refresh: refreshProfiles, prompt: edit} = options;
  const {open: openOverlay, close: closeOverlay, dismiss: dismissOverlay} = options.dialogs;
  const available = (value?: {availability: string}) => value?.availability === "Available";
  function manageProfile(index: number) {
    const current = management()?.profiles[index];
    if (!current) return;
    const capabilities = management()?.capabilities;
    if (
      !available(capabilities?.rename) &&
      management()?.parent.pin_configured
    ) {
      edit(
        "Parent PIN",
        async (pin) => {
          await call("/api/parent/unlock", "POST", { pin });
          await refreshProfiles();
          manageProfile(index);
        },
        "",
        true,
      );
      return;
    }
    openOverlay({
      kind: "choices",
      title: "Edit profile",
      profile: current,
      items: [
        ...(available(capabilities?.rename)
          ? [
              {
                id: "rename",
                label: "Name",
                value: current.name,
                run: () =>
                  edit(
                    "Profile name",
                    async (name) => {
                      await call(
                        `/api/profiles/${segment(current.id)}`,
                        "PATCH",
                        { name },
                      );
                      await refreshProfiles();
                      dismissOverlay();
                    },
                    current.name,
                  ),
              },
            ]
          : []),
        ...(available(capabilities?.avatar)
          ? [
              {
                id: "avatar",
                label: "Change avatar",
                run: () =>
                  openOverlay(
                    {
                      kind: "choices",
                      title: "Choose an avatar",
                      items: (management()?.avatar_ids ?? []).map((id) => ({
                        id,
                        label:
                          id === "initial-pink"
                            ? "Pink initial"
                            : id === "initial-blue"
                              ? "Blue initial"
                              : id,
                        run: async () => {
                          await call(
                            `/api/profiles/${segment(current.id)}`,
                            "PATCH",
                            { avatar_id: id },
                          );
                          await refreshProfiles();
                          dismissOverlay();
                        },
                      })),
                    },
                    true,
                  ),
              },
            ]
          : []),
        ...(current.can_delete && available(capabilities?.delete)
          ? [
              {
                id: "delete",
                label: "Delete profile",
                run: () =>
                  openOverlay(
                    {
                      kind: "confirm",
                      title: `Delete ${current.name}?`,
                      items: [
                        {
                          id: "cancel",
                          label: "Cancel",
                          run: dismissOverlay,
                        },
                        {
                          id: "delete",
                          label: "Delete profile",
                          run: async () => {
                            await call(
                              `/api/profiles/${segment(current.id)}`,
                              "DELETE",
                            );
                            await refreshProfiles();
                            closeOverlay();
                          },
                        },
                      ],
                    },
                    true,
                  ),
              },
            ]
          : []),
      ],
    });
  }
  return manageProfile;
}
