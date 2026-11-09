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
  const motion = () => reduced ? undefined : {
    alpha: { duration: 150, timingFunction: "cubic-bezier(.2,0,0,1)" },
  };
  onMount(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntered(true));
    });
    const timer = setTimeout(props.onComplete, 800);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    });
  });
  return (
    <>
      <TvView
        y={300}
        alpha={entered() ? 1 : 0}
        transition={motion()}
      >
        <TvView x={876} w={168} h={168} color="#0E0E10">
          <Show when={avatar(profile()?.avatar_id)}>
            {(src) => (
              <TvView w={168} h={168} src={src()} fit="cover" />
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
        y={504}
        alpha={entered() ? 1 : 0}
        transition={motion()}
      >
        <Label
          w={1920}
          align="center"
          size={48}
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
          y={598}
          alpha={entered() ? 1 : 0}
          transition={motion()}
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
        y={680}
        w={200}
        h={4}
        color="rgba(255,255,255,.12)"
      >
        <TvView
          w={entered() ? 200 : 0}
          h={4}
          color={palette.text}
          transition={
            reduced
              ? undefined
              : { w: { duration: 800, timingFunction: "linear" } }
          }
        />
      </TvView>
    </>
  );
}
