import type { DevicePlayback } from "../device-playback";
import type { Item } from "../app-types";
export function createDevicePreferenceRows(options: {
    device: DevicePlayback;
    scope: () => string;
    reload: () => Promise<void>;
}) {
    const { device: devicePlayback, scope: deviceScope } = options;
    return async () => {
        await devicePlayback.ready;
        const local = (id: string, label: string, description: string, on: boolean, save: () => Promise<void>): Item => ({
            id, label, description, toggle: on, value: "", run: async () => { await save(); await options.reload(); },
        });
        return (items: Item[]) => {
            const index = items.findIndex(item => item.id === "next_episode_button") + 1;
            return [...items.slice(0, index),
                local("device-autoplay", "Autoplay next episode", "Plays the next episode after a 10-second countdown. Applies to this device.", devicePlayback.autoplay, () => devicePlayback.setAutoplay(!devicePlayback.autoplay)),
                ...items.slice(index),
                local("device-source-across", "Use source choice across shows", "Try your last source choice for new shows and movies on this device.", devicePlayback.across(deviceScope()), () => devicePlayback.setAcross(deviceScope(), !devicePlayback.across(deviceScope()))),
            ];
        };
    };
}
