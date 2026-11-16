import { createSignal, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { createPreferenceControls } from "./preference-controls";
import type { DialogActions, ScopedRequest, TextPrompt } from "./feature-ports";
import { createProfilePreferenceRows } from "./settings/profile-preferences";
import { createDevicePreferenceRows } from "./settings/device-preferences";
import { accountSettings } from "./settings/account";
import { createAddonSettings } from "./settings/addons";
import { createIntegrationSettings } from "./settings/integrations";
import { createParentSettings } from "./settings/parental";
import { createProfileManagement } from "./profile-management";
import { createSettingsNavigation } from "./navigation/settings";
import { offersHouseholdWrite } from "./refusals";
import type { Item } from "./app-types";
import type { Management, Preferences } from "./types";
import type { DevicePlayback } from "./device-playback";
import type { Screen } from "./app-types";

/** The Settings screen's state and its nine boards.
 *
 * The screen is a list of rows that each know how to run themselves, built per
 * tab from the server's own inventory. Keeping it here means the app shell only
 * has to say "settings, tab N" and hand over the dialogs and the session.
 */
export function createSettingsScene(options: {
  api: RemoteTvApi;
  call: ScopedRequest;
  run: (work: () => Promise<void>) => Promise<void>;
  fail: (error: unknown) => void;
  /** The app's "retry the last failure" hook. */
  retry: (work: () => void) => void;
  dialogs: DialogActions;
  prompt: TextPrompt;
  notify: (message: string) => void;
  screen: Accessor<Screen>;
  setScreen: (value: Screen) => void;
  loading: Setter<boolean>;
  preferences: Accessor<Preferences | undefined>;
  adoptPreferences: (value: Preferences | undefined) => void;
  accountEmail: Accessor<string>;
  management: Accessor<Management | undefined>;
  setManagement: Setter<Management | undefined>;
  canManageAccount: Accessor<boolean | undefined>;
  setCanManageAccount: Setter<boolean | undefined>;
  devicePlayback: DevicePlayback;
  deviceScope: () => string;
  scope: Accessor<AbortSignal>;
  stopPlayer: () => Promise<void>;
  resetScope: () => void;
  clearProfileView: () => void;
  calibrate: Setter<number>;
  navigation: { zone: Accessor<string>; column: Accessor<number>; setZone: Setter<string>; setColumn: Setter<number> };
  manageProfile: (index: number) => void;
}) {
  /** The boards' canonical order; sign-out lives under Account. */
  const tabs = [
    "Account",
    "Profiles",
    "Playback",
    "Subtitles & audio",
    "Add-ons",
    "Source integrations",
    "Display",
    "Parental controls",
    "About",
  ];
  /** The existing Settings section by name, so a copy change moves no code. */
  const tabIndex = (label: string) => Math.max(0, tabs.indexOf(label));
  const [tab, setTab] = createSignal(0);
  const [items, setItems] = createSignal<Item[]>([]);
  let scope: AbortController | undefined;
  const abort = () => scope?.abort();

  const { choice: preferenceChoice, displayItem } = createPreferenceControls({
    current: options.preferences, adopt: options.adoptPreferences, request: options.call,
    path: () => options.api.scoped("/preferences"), reload: () => load(tab(), options.scope()),
    dialogs: { open: options.dialogs.open, close: options.dialogs.close }, calibrate: options.calibrate,
  });
  /** Household writes (add-ons, source integrations, the parent PIN, kids
   * limits) are refused to a paired device session by the server's owner guard.
   * `/api/bootstrap` does not project that capability, so it is asked for once
   * per session; an unknown answer keeps the control and lets the refusal
   * explain itself. */
  async function mayWriteHousehold() {
    if (options.canManageAccount() === undefined)
      options.setCanManageAccount(await options.api.canManageAccount());
    return offersHouseholdWrite(options.canManageAccount());
  }
  const profilePreferenceRows = createProfilePreferenceRows({
    current: options.preferences, adopt: options.adoptPreferences, request: options.call,
    path: () => options.api.scoped("/preferences"), reload: () => load(tab(), options.scope()), choose: preferenceChoice,
  });
  const devicePreferenceRows = createDevicePreferenceRows({
    device: options.devicePlayback, scope: options.deviceScope,
    reload: () => load(tabIndex("Playback"), options.scope()),
  });
  const household = {
    request: options.call, path: (path: string) => options.api.scoped(path), mayWrite: mayWriteHousehold,
    dialogs: { open: options.dialogs.open, close: options.dialogs.close, dismiss: options.dialogs.dismiss },
    prompt: options.prompt, notify: options.notify,
  };
  const addonSettings = createAddonSettings({ ...household, reload: () => load(tabIndex("Add-ons"), options.scope()) });
  const integrationSettings = createIntegrationSettings({ ...household, reload: () => load(tabIndex("Source integrations"), options.scope()) });
  const parentSettings = createParentSettings({ ...household, profiles: options.management,
    refreshProfiles: () => refreshProfiles(), reload: () => load(tabIndex("Parental controls"), options.scope()) });

  async function load(next: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    options.retry(() => void load(next, options.scope()).catch(options.fail));
    abort();
    scope = new AbortController();
    signal = scope.signal;
    setTab(next);
    setItems([]);
    options.loading(true);
    if (next === tabIndex("Account")) {
      // Account: server identity facts plus this device's sign-out. The boards'
      // Devices row needs account-wide revocation, which the producer
      // deliberately does not offer — the row stays absent.
      setItems(accountSettings({
        email: options.accountEmail,
        dialogs: { open: options.dialogs.open, close: options.dialogs.close },
        signOut: async () => {
          await options.stopPlayer();
          await options.api.signOut();
          options.resetScope();
          options.clearProfileView();
          options.setScreen("welcome");
          options.loading(false);
        },
      }));
      options.loading(false);
      return;
    }
    if (next === tabIndex("Profiles")) {
      const value = await options.api.profiles(signal);
      options.setManagement(value);
      setItems(value.profiles.map((profile, index) => ({
        id: profile.id,
        label: profile.name,
        value: profile.id === options.api.profile ? "Watching" : "",
        run: () => options.manageProfile(index),
      })));
      options.loading(false);
      return;
    }
    const preferences = await options.api.preferences(signal);
    options.adoptPreferences(preferences);
    if (next === tabIndex("Playback") || next === tabIndex("Subtitles & audio"))
      setItems(profilePreferenceRows(preferences, next));
    if (next === tabIndex("Playback")) setItems(await devicePreferenceRows());
    if (next === tabIndex("Display"))
      setItems((preferences.controls ?? [])
        .filter(control => control.group === "display")
        .map(control => displayItem(control)));
    if (next === tabIndex("Add-ons")) setItems(await addonSettings(signal));
    if (next === tabIndex("Source integrations")) setItems(await integrationSettings(signal));
    if (next === tabIndex("Parental controls")) setItems(await parentSettings(signal));
    if (next === tabIndex("About"))
      setItems([{
        id: "about", label: "VIPTV", value: "TV app",
        description: options.api.origin, run: () => {},
      }]);
    options.loading(false);
  }

  async function refreshProfiles(): Promise<void> {
    const value = await options.api.profiles(options.scope());
    options.setManagement(value);
    if (options.screen() === "settings" && (tab() === 0 || tab() === 1))
      setItems(value.profiles.map((profile, index) => ({
        id: profile.id,
        label: profile.name,
        value: profile.id === options.api.profile ? "Watching" : "",
        run: () => options.manageProfile(index),
      })));
  }

  const management = createProfileManagement({
    current: options.management, request: options.call, refresh: () => refreshProfiles(),
    dialogs: { open: options.dialogs.open, close: options.dialogs.close, dismiss: options.dialogs.dismiss },
    prompt: options.prompt,
  });
  const navigate = createSettingsNavigation({
    focus: options.navigation, tab, tabCount: tabs.length, items,
    load: value => { void load(value, options.scope()).catch(options.fail); }, fail: options.fail,
  });
  /** A new profile: no tab, no rows, no requests. */
  function reset() {
    abort(); setTab(0); setItems([]);
  }
  return { reset, tabs, tab, setTab, items, setItems, tabIndex, load, refreshProfiles, manageProfile: management, navigate,
    mayWriteHousehold, abort, preferenceChoice, displayItem };
}
