/** @jsxImportSource @solidtv/solid */
import { createSignal, onCleanup } from "solid-js";
import { TvView } from "../runtime";
import { Label, palette } from "./visuals";
import { busySpinnerSource } from "./tv-artwork.generated";
import { reducedMotion } from "./motion";

export function BusySpinner(props: { x?: number; y?: number; size: number }) {
  const [angle,setAngle]=createSignal(0);
  let frame=0;
  if (!reducedMotion()) {
    const start=performance.now();
    const tick=(now:number) => {setAngle(((now-start)%1000)/1000*Math.PI*2);frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);
  }
  onCleanup(() => cancelAnimationFrame(frame));
  return <TvView x={props.x ?? 0} y={props.y ?? 0} w={props.size} h={props.size}
    src={busySpinnerSource()} color={palette.accent} rotation={angle()} />;
}

export function BusyIndicator(props: { label: string }) {
  return <TvView x={800} y={476} w={320} h={132}>
    <BusySpinner x={132} size={56} />
    <Label w={320} centerY={100} align="center" size={26} font="Onest600" maxlines={1} content={props.label} />
  </TvView>;
}
