/** @jsxImportSource @solidtv/solid */
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { TvView } from "../runtime";

/** The app's loading forms, not a generic placeholder.
 *
 * Browse and Library are seven-column poster grids; Home is a logo, metadata
 * and description over a landscape shelf; Detail is the hero plus a poster
 * recommendation row. Rendering three landscape blocks on any of those pages
 * made the loading frame look like a different screen. */
export function PageSkeleton(props: {
  screen: string;
  loading: boolean;
  hasContent: boolean;
}) {
  const [pulse, setPulse] = createSignal(0.06);
  createEffect(() => {
    if (!props.loading || props.hasContent) return;
    const timer = setInterval(
      () => setPulse((value) => (value > 0.09 ? 0.055 : 0.1)),
      900,
    );
    onCleanup(() => clearInterval(timer));
  });
  const fill = () => `rgba(255,255,255,${pulse()})`;
  const block = (
    x: number,
    y: number,
    w: number,
    h: number,
    rounded = 6,
  ) => <TvView x={x} y={y} w={w} h={h} color={fill()} />;
  const posters = (y: number, count = 14) => (
    <For each={Array.from({ length: count })}>
      {(_, index) =>
        block(
          96 + (index() % 7) * 248,
          y + Math.floor(index() / 7) * 384,
          232,
          348,
          10,
        )
      }
    </For>
  );
  return (
    <Show when={props.loading && !props.hasContent}>
      <Switch fallback={null}>
        <Match when={props.screen === "home"}>
          {block(96, 300, 360, 150, 12)}
          {block(96, 494, 520, 30)}
          {block(96, 548, 760, 26)}
          {block(96, 586, 600, 26)}
          {block(96, 648, 220, 72, 12)}
          {block(336, 648, 72, 72, 36)}
          {block(428, 648, 72, 72, 36)}
          {block(96, 828, 300, 32)}
          <For each={[0, 1, 2, 3, 4]}>
            {(index) =>
              block(96 + index * 442.4, 876, 422.4, 237.6, 10)
            }
          </For>
        </Match>
        <Match
          when={["movie", "series", "anime", "library"].includes(props.screen)}
        >
          {props.screen === "library" ? (
            <>
              {block(96, 140, 220, 64, 32)}
              {block(328, 140, 280, 64, 32)}
              {block(620, 140, 138, 64, 32)}
            </>
          ) : (
            <>
              {block(96, 140, 360, 64, 32)}
              {block(468, 140, 220, 64, 32)}
            </>
          )}
          {posters(props.screen === "library" ? 236 : 244)}
        </Match>
        <Match when={props.screen === "detail"}>
          {block(96, 300, 360, 150, 12)}
          {block(96, 494, 520, 30)}
          {block(96, 548, 760, 26)}
          {block(96, 586, 600, 26)}
          {block(96, 668, 260, 72, 12)}
          {block(280, 668, 72, 72, 36)}
          {block(96, 854, 300, 32)}
          <For each={[0, 1, 2, 3, 4, 5, 6]}>
            {(index) => block(96 + index * 248, 880, 232, 348, 10)}
          </For>
        </Match>
        <Match when={props.screen === "profiles"}>
          {block(760, 220, 400, 56)}
          {block(736, 380, 200, 200, 28)}
          {block(984, 380, 200, 200, 28)}
          {block(810, 780, 300, 72, 12)}
        </Match>
      </Switch>
    </Show>
  );
}
