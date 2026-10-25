/** @jsxImportSource @solidtv/solid */
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { TvView } from "../runtime";
import { avatar, Label, palette } from "./visuals";
import type { Bootstrap } from "./types";

/** Tv3SignedIn: a presentation-only acknowledgement of the accepted bootstrap. */
export function SignedIn(props: {
  bootstrap: Bootstrap;
  onComplete: () => void;
}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [entered, setEntered] = createSignal(reduced);
  const profile = () =>
    props.bootstrap.profile_management.profiles.find(
      (profile) => profile.id === props.bootstrap.identity.profile_id,
    );
  const account = () => props.bootstrap.identity.account;
  const motion = (delay: number) =>
    reduced
      ? undefined
      : {
          y: { duration: 500, delay, timingFunction: "cubic-bezier(.2,0,0,1)" },
          alpha: {
            duration: 500,
            delay,
            timingFunction: "cubic-bezier(.2,0,0,1)",
          },
        };
  onMount(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntered(true));
    });
    const timer = setTimeout(props.onComplete, 2500);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    });
  });
  return (
    <>
      <TvView
        y={entered() ? 300 : 316}
        alpha={entered() ? 1 : 0}
        transition={motion(0)}
      >
        <TvView x={876} w={168} h={168} rounded={84} color="#0E0E10">
          <Show when={avatar(profile()?.avatar_id)}>
            {(src) => (
              <TvView w={168} h={168} rounded={84} src={src()} fit="cover" />
            )}
          </Show>
          <Show when={!avatar(profile()?.avatar_id)}>
            <Label
              w={168}
              centerY={84}
              align="center"
              size={72}
              font="Onest700"
              content={(profile()?.name ?? account()?.name ?? "V").slice(0, 1)}
            />
          </Show>
        </TvView>
      </TvView>
      <TvView
        y={entered() ? 510 : 526}
        alpha={entered() ? 1 : 0}
        transition={motion(100)}
      >
        <Label
          w={1920}
          align="center"
          size={56}
          font="Onest700"
          letterspacing={-1.12}
          content={
            account()?.name
              ? `Welcome back, ${account()!.name}`
              : "Welcome back"
          }
        />
      </TvView>
      <Show when={account()?.username}>
        <TvView
          y={entered() ? 590 : 606}
          alpha={entered() ? 1 : 0}
          transition={motion(180)}
        >
          <Label
            w={1920}
            align="center"
            size={26}
            lineheight={1.45}
            color={palette.muted}
            content={`Signed in as ${account()!.username}`}
          />
        </TvView>
      </Show>
      <TvView
        x={860}
        y={700}
        w={200}
        h={4}
        rounded={2}
        color="rgba(255,255,255,.12)"
      >
        <TvView
          w={entered() ? 200 : 0}
          h={4}
          rounded={2}
          color={palette.text}
          transition={
            reduced
              ? undefined
              : { w: { duration: 2500, timingFunction: "linear" } }
          }
        />
      </TvView>
    </>
  );
}
