import type { Accessor } from "solid-js";
import type { Item } from "../app-types";
import type { Preferences } from "../types";
import type { ScopedRequest } from "../feature-ports";
export function createProfilePreferenceRows(options: {
    current: Accessor<Preferences | undefined>;
    adopt: (value: Preferences) => void;
    request: ScopedRequest;
    path: Accessor<string>;
    reload: () => Promise<void>;
    choose: (field: string, label: string, values: [
        string,
        string | number | boolean | null
    ][]) => Promise<void>;
}) {
    const { current: preferences, adopt: setPreferences, request: call, choose: preferenceChoice } = options;
    return (pref: Preferences, tab: number): Item[] => {
        return (pref.controls ?? [])
            .filter((control) => control.group === (tab === 2 ? "playback" : "subtitles") &&
            control.choices)
            .map((control) => {
            const choices = control.choices!;
            const isToggle = choices.length === 2 &&
                choices.every((choice) => typeof choice.value === "boolean");
            if (isToggle) {
                const on = pref.preferences[control.id] === true;
                const flip = async () => {
                    const previous = preferences()!;
                    const receipt = await call<Preferences>(options.path(), "PUT", {
                        revision: previous.revision,
                        preferences: {
                            ...previous.preferences,
                            [control.id]: !on,
                        },
                    });
                    setPreferences(receipt);
                    await options.reload();
                };
                return {
                    id: control.id,
                    label: control.label,
                    description: control.description,
                    toggle: on,
                    value: "",
                    run: flip,
                };
            }
            return {
                id: control.id,
                label: control.label,
                description: control.description,
                value: choices.find((choice) => choice.value === pref.preferences[control.id])?.label ?? String(pref.preferences[control.id] ?? ""),
                chevron: true,
                run: () => preferenceChoice(control.id, control.label, choices.map((choice) => [choice.label, choice.value])),
            };
        });
    };
}
