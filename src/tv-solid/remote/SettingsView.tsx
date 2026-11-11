/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { icon, Label, navIcon, outline, palette } from "./visuals";

interface SettingsRowPresentation {
  label: string;
  description?: string;
  value?: string;
  toggle?: boolean;
  swatches?: string[];
  chevron?: boolean;
}

type SettingsViewProps = {
  tabs: readonly string[];
  tab: number;
  items: readonly SettingsRowPresentation[];
  zone: string;
  column: number;
  loading: boolean;
};

export function SettingsView(props: SettingsViewProps) {
  return <>
    <TvView w={560} h={1080} color={palette.surface} />
    <Label
      x={96}
      y={96}
      size={44}
      font="Onest700"
      content="Settings"
    />
    <For each={props.tabs}>
      {(tab, i) => (
        <TvView
          x={72}
          y={196 + i() * 80}
          w={440}
          h={72}
          color={
            props.tab === i() && props.zone === "settings-nav"
              ? palette.text
              : props.tab === i()
                ? "#333333"
                : "rgba(0,0,0,0)"
          }
        >
          <TvView
            x={24}
            centerY={36}
            w={28}
            h={28}
            src={navIcon(
              tab,
              props.tab === i() && props.zone === "settings-nav",
              props.tab === i(),
            )}
          />
          <Label
            x={70}
            centerY={38}
            size={26}
            font={props.tab === i() ? "Onest700" : "Onest500"}
            content={tab}
            color={
              props.tab === i() && props.zone === "settings-nav"
                ? "#111113"
                : props.tab === i()
                  ? palette.text
                  : palette.muted
            }
          />
        </TvView>
      )}
    </For>
    <Label
      x={640}
      y={96}
      size={40}
      font="Onest700"
      content={props.tabs[props.tab]}
    />
    <Show when={props.loading && !props.items.length}>
      <Label
        x={640}
        y={220}
        size={26}
        color={palette.muted}
        content="Loading settings…"
      />
    </Show>
    <For
      each={props.items.slice(
        props.zone === "settings-content" ? Math.max(0, props.column - 5) : 0,
        (props.zone === "settings-content"
          ? Math.max(0, props.column - 5)
          : 0) + 7,
      )}
    >
      {(item, i) => (
        <TvView
          x={640}
          y={220 + i() * 108}
          w={1184}
          h={96}
          color={
            props.zone === "settings-content" &&
            props.column === i() + Math.max(0, props.column - 5)
              ? palette.text
              : palette.surface
          }
        >
          <Label
            x={28}
            centerY={item.description ? 32 : 48}
            size={26}
            font="Onest600"
            maxwidth={730}
            content={item.label}
            color={
              props.zone === "settings-content" &&
              props.column === i() + Math.max(0, props.column - 5)
                ? "#111113"
                : palette.text
            }
          />
          <Label
            x={28}
            y={57}
            size={20}
            maxwidth={900}
            content={(item.description ?? "").replace(
              /^★\s*/,
              "e.g. ",
            )}
            color={
              props.zone === "settings-content" &&
              props.column === i() + Math.max(0, props.column - 5)
                ? "#4A4945"
                : palette.muted
            }
          />
          <Show when={item.toggle !== undefined}>
            <TvView
              x={1088}
              centerY={48}
              w={68}
              h={38}
              color={item.toggle ? palette.accent : "#494949"}
            >
              <TvView
                x={item.toggle ? 34 : 4}
                y={4}
                w={30}
                h={30}
                color={item.toggle ? palette.bg : palette.text}
              />
            </TvView>
          </Show>
          <Show when={item.swatches}>
            {(colors: () => string[]) => (
              <For each={colors()}>
                {(swatch, index) => (
                  <TvView
                    x={926 + index() * 62}
                    centerY={48}
                    w={44}
                    h={44}
                    color={swatch}
                  >
                    <Show
                      when={
                        swatch === item.value &&
                        props.zone === "settings-content" &&
                        props.column === i() + Math.max(0, props.column - 5)
                      }
                    >
                      <TvView
                        x={-6}
                        y={-6}
                        w={56}
                        h={56}
                        src={outline(56, 56, 28, 3, "#F4F2EE")}
                      />
                      <TvView
                        x={-3}
                        y={-3}
                        w={50}
                        h={50}
                        src={outline(50, 50, 25, 3, "#0B0B0C")}
                      />
                    </Show>
                  </TvView>
                )}
              </For>
            )}
          </Show>
          <Show when={item.toggle === undefined && !item.swatches}>
            <Label
              x={760}
              centerY={48}
              w={item.chevron ? 360 : 390}
              align="right"
              size={24}
              maxlines={1}
              content={item.value ?? (item.chevron ? "" : "›")}
              color={
                props.zone === "settings-content" &&
                props.column === i() + Math.max(0, props.column - 5)
                  ? "#111113"
                  : palette.muted
              }
            />
            <Show when={item.chevron}>
              <TvView
                x={1128}
                centerY={48}
                w={24}
                h={24}
                src={icon(
                  "chevron",
                  props.zone === "settings-content" &&
                    props.column === i() + Math.max(0, props.column - 5),
                  2.2,
                  props.zone === "settings-content" &&
                    props.column === i() + Math.max(0, props.column - 5)
                    ? "#4A4945"
                    : "#B6B4AF",
                )}
              />
            </Show>
          </Show>
        </TvView>
      )}
    </For>
  </>;
}
