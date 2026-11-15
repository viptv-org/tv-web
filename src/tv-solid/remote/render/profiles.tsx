/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { ProfilesScreen } from "../ProfilesScreen";
import type { Screen } from "../app-types";

type ProfilesProps = Parameters<typeof ProfilesScreen>[0];

/** Who is watching. One row of tiles plus whatever the profile editor adds. */
export function ProfilesView(props: { screen: Screen; profiles: ProfilesProps }) {
  return (
    <Show when={props.screen === "profiles"}>
      <ProfilesScreen
        profiles={props.profiles.profiles}
        create={props.profiles.create}
        manage={props.profiles.manage}
        index={props.profiles.index}
        zone={props.profiles.zone}
        loading={props.profiles.loading}
      />
    </Show>
  );
}
