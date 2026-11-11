/** @jsxImportSource @solidtv/solid */
import { Show, type Accessor } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { MediaTile as Tile } from "./MediaTile";
import { Label, palette } from "./visuals";
import { cardKey, type Card } from "./types";
import type { Screen } from "./app-types";

interface GridWindow { start: Accessor<number>; count: Accessor<number>; columns: Accessor<number>; offset: Accessor<number> }
interface GridFocus { active: Accessor<boolean>; index: Accessor<number> }
interface GridSearch { channels: Accessor<boolean>; pending: Accessor<boolean>; retry: Accessor<boolean>; query: Accessor<string> }
import { uniqueCards } from "./card-collection";

export function CatalogGrid(props: { screen: Screen; cards: readonly Card[]; window: GridWindow; focus: GridFocus; search: GridSearch; loading: boolean }) {
  return <>
    <TvView
      x={props.screen === "search" ? 700 : 96}
      y={
        props.screen === "search"
          ? 196
          : props.screen === "library"
            ? 236
            : 244
      }
      w={props.screen === "search" ? 1124 : 1720}
      h={
        props.screen === "search"
          ? props.search.channels()
            ? 406
            : 800
          : 844
      }
      clipping={true}
    >
      <Show
        when={
          props.screen === "search" &&
          props.search.pending() &&
          !props.cards.length
        }
      >
        <Label
          y={100}
          size={28}
          color={palette.muted}
          content="Searching…"
        />
      </Show>
      <KeyedFor
        each={uniqueCards(props.cards).slice(
          props.window.start(),
          props.window.start() + props.window.count(),
        )}
        keyOf={cardKey}
      >
        {(card, i) => (
          <Tile
            card={card()}
            x={
              (i() % props.window.columns()) *
              (props.screen === "search" ? 228 : 248)
            }
            y={
              Math.floor(i() / props.window.columns()) *
                (props.screen === "search"
                  ? 388
                  : props.screen === "library"
                    ? 446
                    : 460) - props.window.offset()
            }
            w={props.screen === "search" ? 212 : 232}
            h={props.screen === "search" ? 318 : 348}
            focused={
              props.focus.active() && i() + props.window.start() === props.focus.index()
            }
            poster
            focusedCaptions={props.screen === "search"}
          />
        )}
      </KeyedFor>
      <Show
        when={
          !props.loading &&
          !props.cards.length &&
          !(
            props.screen === "search" &&
            (props.search.retry() || props.search.pending())
          )
        }
      >
        <Label
          y={100}
          size={32}
          font="Onest600"
          content={
            props.screen === "search" && !props.search.query()
              ? "Find something to watch"
              : props.screen === "library"
                ? "Your list is empty"
                : "Nothing matches"
          }
        />
        <Label
          y={160}
          size={26}
          color={palette.muted}
          content={
            props.screen === "library"
              ? "Add a title to find it here."
              : "Try a different search or filter."
          }
        />
      </Show>
    </TvView>
  </>;
}
