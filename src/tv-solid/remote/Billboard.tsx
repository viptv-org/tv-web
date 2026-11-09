/** @jsxImportSource @solidtv/solid */
import { createMemo, Show } from "solid-js";
import { getRenderer } from "@solidtv/solid";
import type { RendererMain, ShaderNode } from "@solidtv/renderer";
import { TvView } from "../runtime";
import { registerTvShader } from "../shaders";
import { rendererStart } from "../renderer-clock";
import { palette } from "./visuals";
import { heroProgressShader } from "./billboard-shaders";
const registered = new WeakSet<RendererMain>();
function setup() {
  const renderer=getRenderer() as RendererMain;
  if (!registered.has(renderer)) {
    registerTvShader(renderer,"tvHeroProgress",heroProgressShader);
    registered.add(renderer);
  }
  return {renderer};
}
export function HeroProgress(props: { started: number; running: boolean }) {
  const { renderer } = setup();
  const shader = createMemo(() => {
    if (!props.running) return undefined;
    return renderer.createShader("tvHeroProgress", {
      startedAt: props.started - rendererStart(renderer),
    }) as ShaderNode;
  });
  return (
    <Show
      when={props.running}
      fallback={<TvView w={48} h={4} color={palette.text} />}
    >
      <TvView w={48} h={4} color="#FFFFFF" shader={shader()} />
    </Show>
  );
}
