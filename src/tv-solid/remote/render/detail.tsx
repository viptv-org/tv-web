/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { DetailContent } from "../DetailContent";
import type { Screen } from "../app-types";

type DetailProps = Parameters<typeof DetailContent>[0];

/** One title's page: branding above, actions beside, episodes and
 * recommendations under it. The body arrives once, as a single fade. */
export function DetailView(props: { screen: Screen; content: DetailProps }) {
  return (
    <Show when={props.screen === "detail"}>
      <DetailContent {...props.content} />
    </Show>
  );
}
