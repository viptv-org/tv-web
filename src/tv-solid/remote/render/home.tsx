/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { HomeContent } from "../HomeContent";
import type { Screen } from "../app-types";

type HomeProps = Parameters<typeof HomeContent>[0];

/** The Home screen: the featured title, its shelf and the rows under it. */
export function HomeView(props: { screen: Screen; content: HomeProps }) {
  return (
    <Show when={props.screen === "home"}>
      <HomeContent
        home={props.content.home}
        hasHero={props.content.hasHero}
        presentation={props.content.presentation}
        focus={props.content.focus}
        billboard={props.content.billboard}
        shelfTop={props.content.shelfTop}
        columnForRow={props.content.columnForRow}
        isSaved={props.content.isSaved}
      />
    </Show>
  );
}
