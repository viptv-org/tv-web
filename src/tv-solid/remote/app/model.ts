import { createEffect, createMemo, createSignal } from "solid-js";
import { availableNavigation } from "../navigation-model";
import { RowFocus } from "../row-focus";
import { applyDisplayPreferences, defaultDisplayPreferences } from "../display";
import {
  cardKey, type Bootstrap, type Card, type Home, type LibraryPage, type Management, type Preferences,
} from "../types";

/**
 * The screens' own data: which profile's Home, management and navigation are
 * loaded, what the library list holds, and the preferences that drive display.
 *
 * This is deliberately not the shell (`state.ts`): nothing here is about the app
 * being alive. It is the *content* the app is showing, and it is what a profile
 * change replaces wholesale.
 */
export function createAppModel() {
  const homeRowFocus = new RowFocus<Card>(cardKey);
  const contentFocus = new RowFocus<Card>(cardKey);
  const [home, setHome] = createSignal<Home>();
  const [management, setManagement] = createSignal<Management>();
  const [navigation, setNavigation] = createSignal<Bootstrap["navigation"]>();
  const [library, setLibrary] = createSignal<LibraryPage>();
  const [preferencesSignal, setPreferencesSignal] = createSignal<Preferences>();

  // A shelf that leaves Home takes its remembered column with it, so a row that
  // comes back cannot restore a position from a different row.
  createEffect(() => homeRowFocus.retain(home()?.rows ?? []));

  /** Server preference snapshots drive the display settings immediately;
   * clearing the profile restores the designed defaults. */
  const setPreferences = (value: Preferences | undefined) => {
    setPreferencesSignal(value);
    applyDisplayPreferences(value?.display ?? defaultDisplayPreferences);
  };
  const preferences = preferencesSignal;

  const navs = createMemo(() => availableNavigation(navigation()));
  const navIndex = (id: string) => Math.max(0, navs().findIndex(item => item.id === id));
  const canManageProfiles = () =>
    !!management()?.profiles.length &&
    ["rename", "avatar", "delete"].some(key => management()?.capabilities[key]?.availability === "Available");
  /** Which search surfaces the account actually has, from its navigation entry. */
  const searchCapabilities = createMemo(() => {
    const entry = navs().find(item => item.id === "search");
    return {
      media: !!entry && entry.media_search !== false,
      channels: entry?.channel_search === true,
    };
  });

  return {
    home, setHome, management, setManagement, navigation, setNavigation, library, setLibrary,
    preferences, setPreferences, navs, navIndex, canManageProfiles, searchCapabilities,
    homeRowFocus, contentFocus,
  };
}

export type AppModel = ReturnType<typeof createAppModel>;
