import type { Item } from "../app-types";
import { ACCOUNT_SESSION_REQUIRED, ACCOUNT_SESSION_REQUIRED_ROW } from "../refusals";
import type { HouseholdSettings } from "./ports";
export function createAddonSettings(options: HouseholdSettings) {
    const { request: call, mayWrite: mayWriteHousehold, prompt: edit, notify } = options;
    const { open: openOverlay, close: closeOverlay, dismiss: dismissOverlay } = options.dialogs;
    return async (signal: AbortSignal): Promise<Item[]> => {
        const write = await mayWriteHousehold();
        const [inventory, states] = await Promise.all([
            call<{
                items: {
                    id: number;
                    name: string;
                    enabled: boolean;
                }[];
            }>("/api/addons?limit=200", "GET", undefined, signal),
            call<{
                addons: {
                    connection_id: string;
                    enabled: boolean;
                }[];
            }>(options.path("/addon-activation"), "GET", undefined, signal),
        ]);
        return [
            // Installing and removing add-ons is an account-owner write. A paired
            // TV can only enable an installed add-on for its own profile.
            ...(write
                ? [
                    {
                        id: "add",
                        label: "Add by address",
                        run: () => edit("Add-on address", async (address) => {
                            const installed = await call<{
                                id: number;
                            }>("/api/addons", "POST", { manifest_url: address });
                            await call(options.path("/addon-activation"), "PUT", {
                                connection_id: `addon:${installed.id}`,
                                enabled: true,
                            });
                            closeOverlay();
                            await options.reload();
                        }),
                    },
                ]
                : [
                    {
                        id: "add",
                        label: "Add or remove add-ons",
                        value: "On the web",
                        description: ACCOUNT_SESSION_REQUIRED_ROW,
                        run: () => notify(ACCOUNT_SESSION_REQUIRED),
                    },
                ]),
            ...inventory.items.map((addon) => {
                const state = states.addons.find((item) => item.connection_id === `addon:${addon.id}`);
                return {
                    id: String(addon.id),
                    label: addon.name,
                    value: state
                        ? state.enabled
                            ? "Enabled"
                            : "Disabled"
                        : "Disabled for account",
                    run: () => !write && !state
                        ? notify(ACCOUNT_SESSION_REQUIRED)
                        : openOverlay({
                            kind: "choices",
                            title: addon.name,
                            items: [
                                ...(state
                                    ? [
                                        {
                                            id: "enabled",
                                            label: state.enabled
                                                ? "Disable for this profile"
                                                : "Enable for this profile",
                                            run: async () => {
                                                await call(options.path("/addon-activation"), "PUT", {
                                                    connection_id: state.connection_id,
                                                    enabled: !state.enabled,
                                                });
                                                closeOverlay();
                                                await options.reload();
                                            },
                                        },
                                    ]
                                    : []),
                                ...(write
                                    ? [
                                        {
                                            id: "remove",
                                            label: "Remove add-on",
                                            run: () => openOverlay({
                                                kind: "confirm",
                                                title: `Remove ${addon.name}?`,
                                                items: [
                                                    {
                                                        id: "cancel",
                                                        label: "Cancel",
                                                        run: dismissOverlay,
                                                    },
                                                    {
                                                        id: "remove",
                                                        label: "Remove",
                                                        run: async () => {
                                                            await call(`/api/addons/${addon.id}`, "DELETE");
                                                            closeOverlay();
                                                            await options.reload();
                                                        },
                                                    },
                                                ],
                                            }, true),
                                        },
                                    ]
                                    : []),
                            ],
                        }),
                };
            }),
        ];
    };
}
