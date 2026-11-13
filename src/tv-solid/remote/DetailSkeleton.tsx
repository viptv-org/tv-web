/** @jsxImportSource @solidtv/solid */
import { For, createSignal, onCleanup } from "solid-js";
import { TvView } from "../runtime";
import { tokens } from "../../theme/viptv-tokens.generated";
import { reducedMotion } from "./motion";
import { detailEpisodeLayout } from "./hero-layout";

export function DetailSkeleton(props: { series?: boolean }) {
  const [alpha, setAlpha] = createSignal(.5);
  if (!reducedMotion()) {
    const timer = setInterval(() => setAlpha(value => value === .5 ? .85 : .5), 1100);
    onCleanup(() => clearInterval(timer));
  }
  return <TvView x={96} alpha={alpha()} transition={reducedMotion() ? undefined : {alpha: {duration: 1000, easing: "ease-in-out"}}}>
    <TvView y={props.series ? 250 : 220} w={640} h={props.series ? 134 : 190} color={tokens["color.surface.3"]} />
    <TvView y={props.series ? 410 : 432} w={380} h={24} color={tokens["color.surface.2"]} />
    <For each={[0,1,2]}>{line => <TvView y={(props.series ? 460 : 482) + line * 38} w={line === 2 ? 560 : 800} h={22} color={tokens["color.surface.2"]} />}</For>
    <TvView y={props.series ? 648 : 668} w={260} h={72} color={tokens["color.surface.3"]} />
    <TvView x={280} y={props.series ? 648 : 668} w={72} h={72} color={tokens["color.surface.2"]} />
    <TvView y={props.series ? 816 : 836} w={260} h={30} color={tokens["color.surface.2"]} />
    <For each={[0,1,2,3,4,5,6]}>{index => <TvView x={index * (props.series ? detailEpisodeLayout.step : 248)} y={888} w={props.series ? detailEpisodeLayout.width : 232} h={props.series ? detailEpisodeLayout.height : 348} color={tokens["color.surface.1"]} />}</For>
  </TvView>;
}
