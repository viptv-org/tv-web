/** @jsxImportSource @solidtv/solid */
import { createMemo, For, Show } from "solid-js";
import { TvView } from "../runtime";
import { avatar, icon, Label, outline, palette, topBarGradient } from "./visuals";
import { imageSource } from "./image-source";
import { sdfTextMetrics } from "./text-measure";
import type { NavigationItem } from "./navigation-model";
import type { Profile } from "./types";
import type { Screen } from "./app-types";

export function TopNavigation(props: { items: readonly NavigationItem[]; screen: Screen; selected?: number; profile?: Profile; fontReady: boolean }) {
  const profileAvatar = createMemo(() => props.profile?.avatar_url ?? avatar(props.profile?.avatar_id));
  const layout = createMemo(() => {
    props.fontReady;
    let x = 300;
    return props.items.map((nav) => {
      if (nav.id === "profiles") return { x: 1768, w: 56, text: 0 };
      if (nav.id === "search") {
        const box = { x, w: 56, text: 0 };
        x += 56 + 8;
        return box;
      }
      const context = sdfTextMetrics("26px Onest500");
      context.font = `26px ${props.screen === nav.id ? "Onest700" : "Onest500"}`;
      const text = Math.ceil(context.measureText(nav.label).width);
      const box = { x, w: text + 36, text };
      x += box.w + 8;
      return box;
    });
  });
  return <>
    <TvView w={1920} h={132} src={topBarGradient()} fit="cover" />
    <TvView
      x={96}
      y={44}
      w={44}
      h={44}
      color={palette.accent}
    >
      <Label
        w={44}
        centerY={22}
        align="center"
        size={28}
        font="Bricolage800"
        content="V"
        color="#15130F"
      />
    </TvView>
    <Label
      x={152}
      centerY={66}
      font="Bricolage800"
      size={32}
      letterspacing={-0.96}
      content="VIPTV"
    />
    <For each={props.items}>
      {(nav, index) => (
        <TvView
          x={layout()[index()].x}
          y={38}
          w={layout()[index()].w}
          h={56}
          color={
            props.selected === index() &&
            nav.id !== "search" &&
            nav.id !== "profiles"
              ? "#212124"
              : "rgba(0,0,0,0)"
          }
        >
          <Show
            when={
              props.selected === index() &&
              nav.id !== "profiles"
            }
          >
            <TvView
              w={layout()[index()].w}
              h={56}
              src={outline(
                layout()[index()].w,
                56,
                nav.id === "search" || nav.id === "profiles"
                  ? 28
                  : 8,
                3,
                "#F4F2EE",
              )}
            />
          </Show>
          <Show when={nav.id === "search"}>
            <TvView
              x={13}
              y={13}
              w={30}
              h={30}
              src={icon(
                "search",
                false,
                2.2,
                palette.text,
              )}
            />
          </Show>
          <Show when={nav.id === "profiles"}>
            <TvView
              x={-2}
              y={-2}
              w={60}
              h={60}
              color="#212124"
            />
            <TvView
              w={56}
              h={56}
              color="#212124"
            >
              <Show when={profileAvatar()} fallback={<Label
                w={56}
                centerY={28}
                align="center"
                size={26}
                font="Onest700"
                content={
                  (
                    props.profile?.name ?? "?"
                  )
                    .slice(0, 1)
                    .toUpperCase()
                }
              />}>
                {(src) => (
                  <TvView
                    w={56}
                    h={56}
                    src={imageSource(src())}
                    fit="cover"
                  />
                )}
              </Show>
            </TvView>
          </Show>
          <Show
            when={
              props.selected === index() &&
              nav.id === "profiles"
            }
          >
            <TvView
              w={56}
              h={56}
              src={outline(56, 56, 28, 3, "#F4F2EE")}
            />
          </Show>
          <Show when={nav.id !== "search" && nav.id !== "profiles"}>
            <Label
              x={18}
              centerY={28}
              size={26}
              font={props.screen === nav.id ? "Onest700" : "Onest500"}
              maxwidth={layout()[index()].text}
              maxlines={1}
              content={nav.label}
              color={
                props.screen === nav.id ||
                (props.selected === index())
                  ? palette.text
                  : palette.body
              }
            />
            <TvView
              show={props.screen === nav.id}
              x={18}
              y={49}
              w={layout()[index()].text}
              h={3}
              color={palette.text}
            />
          </Show>
        </TvView>
      )}
    </For>

  </>;
}
