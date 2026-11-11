import type { DialogActions, TextPrompt } from "../feature-ports";
export type SettingsRequest = <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal) => Promise<T>;
export interface HouseholdSettings {
    request: SettingsRequest;
    path: (path: string) => string;
    mayWrite: () => Promise<boolean>;
    dialogs: DialogActions;
    prompt: TextPrompt;
    notify: (message: string) => void;
    reload: () => Promise<void>;
}
