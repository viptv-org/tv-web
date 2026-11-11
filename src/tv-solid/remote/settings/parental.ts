import type { Accessor } from "solid-js";
import { segment } from "../api";
import type { Item } from "../app-types";
import type { Management } from "../types";
import { ACCOUNT_SESSION_REQUIRED, ACCOUNT_SESSION_REQUIRED_ROW } from "../refusals";
import type { HouseholdSettings } from "./ports";
export function createParentSettings(options: HouseholdSettings & {
    profiles: Accessor<Management | undefined>;
    refreshProfiles: () => Promise<void>;
}) {
    const { request: call, mayWrite: mayWriteHousehold, prompt: edit, notify, profiles: management, refreshProfiles } = options;
    const { open: openOverlay, close: closeOverlay } = options.dialogs;
    async function parentPolicy(id: string, name: string) {
        const path = `/api/profiles/${segment(id)}/kids`;
        const policy = await call<{
            enabled: boolean;
            max_age: number;
        }>(path);
        openOverlay({
            kind: "choices",
            title: name,
            items: [
                {
                    id: "enabled",
                    label: "Kids profile",
                    value: policy.enabled ? "On" : "Off",
                    run: async () => {
                        await call(path, "PUT", {
                            enabled: !policy.enabled,
                            max_age: policy.max_age,
                        });
                        closeOverlay();
                        await refreshProfiles();
                        await options.reload();
                    },
                },
                {
                    id: "age",
                    label: "Maximum age",
                    value: String(policy.max_age),
                    run: () => edit("Maximum age", async (value) => {
                        await call(path, "PUT", {
                            enabled: policy.enabled,
                            max_age: Number(value),
                        });
                        closeOverlay();
                        await parentPolicy(id, name);
                    }, String(policy.max_age)),
                },
            ],
        });
    }
    return async (signal: AbortSignal): Promise<Item[]> => {
        const write = await mayWriteHousehold();
        const status = await call<{
            pin_configured: boolean;
            unlocked: boolean;
        }>("/api/parent/status", "GET", undefined, signal);
        const rows: Item[] = [];
        // Unlocking is a device-session write the server allows; setting or
        // changing the PIN is an account-owner write it refuses.
        if (!status.pin_configured && !write)
            rows.push({
                id: "unlock",
                label: "Set parent PIN",
                value: "On the web",
                description: ACCOUNT_SESSION_REQUIRED_ROW,
                run: () => notify(ACCOUNT_SESSION_REQUIRED),
            });
        else if (!status.pin_configured || !status.unlocked)
            rows.push({
                id: "unlock",
                label: status.pin_configured
                    ? "Unlock parent controls"
                    : "Set parent PIN",
                run: () => edit(status.pin_configured ? "Parent PIN" : "Set parent PIN", async (pin) => {
                    await call(status.pin_configured
                        ? "/api/parent/unlock"
                        : "/api/parent/pin", status.pin_configured ? "POST" : "PUT", { pin });
                    closeOverlay();
                    await refreshProfiles();
                    await options.reload();
                }, "", true),
            });
        if (status.pin_configured && !write)
            rows.push({
                id: "pin",
                label: "Change parent PIN",
                value: "On the web",
                description: ACCOUNT_SESSION_REQUIRED_ROW,
                run: () => notify(ACCOUNT_SESSION_REQUIRED),
            });
        if (status.pin_configured && write)
            rows.push({
                id: "pin",
                label: "Change parent PIN",
                run: () => edit("Current parent PIN", async (current_pin) => {
                    edit("New parent PIN", async (pin) => {
                        await call("/api/parent/pin", "PUT", {
                            current_pin,
                            pin,
                        });
                        closeOverlay();
                        await options.reload();
                    }, "", true);
                }, "", true),
            });
        // A kids limit is read and written through the account-session guard,
        // so a paired TV cannot even show the current value.
        if (status.unlocked && write)
            for (const profile of management()?.profiles ?? [])
                rows.push({
                    id: profile.id,
                    label: profile.name,
                    description: "Manage this profile’s age limit",
                    run: () => parentPolicy(profile.id, profile.name),
                });
        return rows;
    };
}
