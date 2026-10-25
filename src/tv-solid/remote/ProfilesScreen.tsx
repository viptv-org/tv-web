/** @jsxImportSource @solidtv/solid */
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { avatar, icon, Label, outline, palette } from "./visuals";
import type { Profile } from "./types";

type Item = Pick<Profile, "id" | "name" | "avatar_id" | "locked">;
function ProfileTile(props: {
  profile: Item;
  x: number;
  delay: number;
  focused: boolean;
}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [entered, setEntered] = createSignal(reduced);
  onMount(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntered(true));
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  const nameWidth = createMemo(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `28px ${props.focused ? "Onest700" : "Onest500"}`;
    return Math.min(
      props.profile.locked ? 168 : 200,
      context.measureText(props.profile.name).width,
    );
  });
  const nameX = () => 100 - (nameWidth() + (props.profile.locked ? 32 : 0)) / 2;
  return (
    <TvView
      x={props.x}
      y={entered() ? 380 : 396}
      alpha={entered() ? 1 : 0}
      transition={
        reduced
          ? undefined
          : {
              y: {
                duration: 450,
                delay: props.delay,
                timingFunction: "cubic-bezier(.2,0,0,1)",
              },
              alpha: {
                duration: 450,
                delay: props.delay,
                timingFunction: "cubic-bezier(.2,0,0,1)",
              },
            }
      }
    >
      <TvView
        w={200}
        h={200}
        rounded={28}
        clipping
        color={
          props.profile.id === "add"
            ? "rgba(255,255,255,.08)"
            : props.profile.avatar_id === "initial-pink"
              ? "#C24E6B"
              : props.profile.avatar_id === "initial-blue"
                ? "#3E6B8A"
                : "#0E0E10"
        }
      >
        <Show
          when={avatar(props.profile.avatar_id)}
          fallback={
            <Show
              when={props.profile.id !== "add"}
              fallback={
                <TvView
                  x={68}
                  y={68}
                  w={64}
                  h={64}
                  src={icon("plus", false, 2, palette.muted)}
                />
              }
            >
              <Label
                w={200}
                centerY={100}
                align="center"
                size={90}
                font="Onest700"
                content={
                  Array.from(props.profile.name.trim())[0]?.toUpperCase() ?? ""
                }
              />
            </Show>
          }
        >
          {(src) => (
            <TvView w={200} h={200} rounded={28} src={src()} fit="cover" />
          )}
        </Show>
      </TvView>
      <Show when={props.profile.id === "add"}>
        <TvView
          w={200}
          h={200}
          src={outline(200, 200, 28, 2, "#FFFFFF", 0.18)}
        />
      </Show>
      <Show when={props.focused}>
        <TvView w={200} h={200} src={outline(200, 200, 28, 4, "#FFFFFF")} />
        <TvView
          x={4}
          y={4}
          w={192}
          h={192}
          src={outline(192, 192, 24, 1, "#000000", 0.35)}
        />
      </Show>
      <Show when={props.profile.locked}>
        <TvView
          x={nameX()}
          y={226}
          w={24}
          h={24}
          src={icon(
            "profile-lock",
            false,
            2.2,
            props.focused ? palette.text : palette.muted,
          )}
        />
      </Show>
      <Label
        x={nameX() + (props.profile.locked ? 32 : 0)}
        y={220}
        size={28}
        font={props.focused ? "Onest700" : "Onest500"}
        color={props.focused ? palette.text : palette.muted}
        maxwidth={props.profile.locked ? 168 : 200}
        maxlines={1}
        content={props.profile.name}
      />
    </TvView>
  );
}
export function ProfilesScreen(props: {
  profiles: Profile[];
  create: boolean;
  manage: boolean;
  index: number;
  zone: string;
}) {
  const items = createMemo<Item[]>(() => [
    ...props.profiles,
    ...(props.create
      ? [{ id: "add", name: "Add profile", locked: false }]
      : []),
  ]);
  const start = () => Math.floor(props.index / 5) * 5;
  const visible = () => items().slice(start(), start() + 5);
  const manageWidth = createMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = "26px Onest700";
    return ctx.measureText("Manage profiles").width + 40;
  });
  return (
    <>
      <Label
        y={220}
        w={1920}
        align="center"
        size={56}
        font="Onest700"
        letterspacing={-1.12}
        content="Who’s watching?"
      />
      <Show when={!items().length}>
        <Label
          y={460}
          w={1920}
          align="center"
          size={28}
          color={palette.muted}
          content="No profiles available"
        />
        <TvView
          x={810}
          y={780}
          w={300}
          h={72}
          rounded={12}
          color={palette.text}
        >
          <Label
            w={300}
            centerY={36}
            align="center"
            size={26}
            font="Onest700"
            color="#111113"
            content="Retry"
          />
        </TvView>
      </Show>
      <KeyedFor each={visible()} keyOf={(profile) => profile.id}>
        {(profile, i) => (
          <ProfileTile
            profile={profile()}
            x={960 - (visible().length * 256 - 56) / 2 + i() * 256}
            delay={i() * 60}
            focused={props.zone === "profiles" && props.index - start() === i()}
          />
        )}
      </KeyedFor>
      <Show when={props.manage}>
        <TvView
          x={810}
          y={780}
          w={300}
          h={72}
          rounded={12}
          color={
            props.zone === "profile-manage"
              ? palette.text
              : "rgba(255,255,255,.16)"
          }
        >
          <TvView
            x={(300 - manageWidth()) / 2}
            y={22}
            w={28}
            h={28}
            src={icon("edit", props.zone === "profile-manage", 2.2)}
          />
          <Label
            x={(300 - manageWidth()) / 2 + 40}
            centerY={36}
            size={26}
            font="Onest700"
            color={props.zone === "profile-manage" ? "#111113" : palette.text}
            content="Manage profiles"
          />
        </TvView>
      </Show>
    </>
  );
}
