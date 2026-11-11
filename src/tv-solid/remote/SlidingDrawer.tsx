/** @jsxImportSource @solidtv/solid */
import type { JSX } from "solid-js";
import { TvView } from "../runtime";
import { palette } from "./visuals";

export function SlidingDrawer(props: { width: number; entered: boolean; closing: boolean; children: JSX.Element }) {
  return <TvView x={props.entered && !props.closing ? 1920 - props.width : 1920}
    w={props.width} h={1080} color={palette.surface}
    transition={{x: {duration: props.closing ? 200 : 300,
      timingFunction: props.closing ? "cubic-bezier(.3,0,1,1)" : "cubic-bezier(0,0,0,1)"}}}>
    {props.children}
  </TvView>;
}
