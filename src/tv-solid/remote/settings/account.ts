import type { Accessor } from "solid-js";
import type { Item } from "../app-types";
import type { DialogActions } from "../feature-ports";
export function accountSettings(options: {
    email: Accessor<string>;
    dialogs: Pick<DialogActions, "open" | "close">;
    signOut: () => Promise<void>;
}): Item[] {
    const { email: accountEmail } = options;
    const { open: openOverlay, close: closeOverlay } = options.dialogs;
    return [
        {
            id: "email",
            label: "Email",
            value: accountEmail() || "—",
            run: () => { },
        },
        {
            id: "logout",
            label: "Sign out of this TV",
            run: () => openOverlay({
                kind: "confirm",
                title: "Sign out of this TV?",
                description: "Your profiles, My List and progress stay on your account.",
                items: [
                    { id: "cancel", label: "Stay signed in", run: closeOverlay },
                    {
                        id: "confirm",
                        label: "Sign out",
                        run: options.signOut,
                    },
                ],
            }),
        },
    ];
}
