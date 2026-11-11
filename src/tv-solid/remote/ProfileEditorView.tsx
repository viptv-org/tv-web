/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { avatar, Button, Label, palette } from "./visuals";
import type { Profile } from "./types";
import type { Item } from "./app-types";

export function ProfileEditorView(props: { profile: Profile; items: readonly Item[]; selected: number }) {
  return (
    <TvView w={1920} h={1080} color={palette.bg}>
      <Label
        x={96}
        y={96}
        size={56}
        font="Onest700"
        content="Edit profile"
      />
      <TvView
        x={156}
        y={220}
        w={280}
        h={280}
        color={palette.surface}
      >
        <Show
          when={avatar(props.profile.avatar_id)}
          fallback={
            <Label
              w={280}
              centerY={140}
              align="center"
              size={96}
              font="Onest700"
              content={props.profile.name.slice(0, 1)}
            />
          }
        >
          <TvView
            w={280}
            h={280}
            src={avatar(props.profile.avatar_id)}
            fit="cover"
          />
        </Show>
      </TvView>
      <Show
        when={props.items.some(
          (item) => item.id === "avatar",
        )}
      >
        <Button
          x={156}
          y={524}
          w={280}
          label="Change avatar"
          focused={props.items[props.selected]?.id === "avatar"}
        />
      </Show>
      <For
        each={props.items.filter(
          (item) => item.id !== "avatar",
        )}
      >
        {(item, index) => (
          <TvView
            x={640}
            y={
              item.id === "delete" ? 784 : 220 + index() * 108
            }
            w={1184}
            h={item.id === "delete" ? 80 : 96}
            color={
              props.items[props.selected]?.id === item.id
                ? palette.text
                : "#1B1B1D"
            }
          >
            <Label
              x={28}
              centerY={item.id === "delete" ? 40 : 48}
              size={28}
              font="Onest600"
              content={item.label}
              color={
                item.id === "delete"
                  ? "#FF8A7E"
                  : props.items[props.selected]?.id === item.id
                    ? "#111113"
                    : palette.text
              }
            />
            <Label
              x={720}
              centerY={48}
              w={430}
              maxlines={1}
              align="right"
              size={26}
              content={
                item.id === "rename"
                  ? props.profile.name + "  ›"
                  : ""
              }
              color={
                props.items[props.selected]?.id === item.id
                  ? "#444444"
                  : palette.muted
              }
            />
          </TvView>
        )}
      </For>
    </TvView>
  );
}
