/** @jsxImportSource @solidtv/solid */
import { Show, type JSX } from "solid-js";
import { ModalLayerContext, TvView } from "../runtime";

export function OverlayViewport(props: { order: number; shade?: string; shadeWidth?: number; children: JSX.Element }) {
  return <ModalLayerContext.Provider value={true}>
    <TvView w={1920} h={1080} zIndex={props.order}>
      <Show when={props.shade}>
        {/* A nonzero scrim quad flushes deferred screen text before the modal. */}
        <TvView w={props.shadeWidth ?? 1920} h={1080} zIndex={-1} color={props.shade} />
      </Show>
      {props.children}
    </TvView>
  </ModalLayerContext.Provider>;
}
