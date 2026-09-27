/** @jsxImportSource @solidtv/solid */
import { createEffect, createSignal } from "solid-js";
import { TvView, TvText } from "./runtime";
/** Contained IPTV artwork with a local fallback; never crop a station logo. */
export function ChannelLogo(props:{src:string; label:string; w:number; h:number; color:string; x?:number; y?:number}) {
  const [failed,setFailed]=createSignal(false);
  createEffect(()=>{props.src;setFailed(false);});
  return <TvView x={props.x??0} y={props.y??0} w={props.w} h={props.h}>
    <TvView show={!!props.src&&!failed()} w={props.w} h={props.h} fit="contain" src={props.src} onError={()=>setFailed(true)}/>
    <TvText show={!props.src||failed()} maxwidth={props.w} centerY={props.h/2} align="center" size={Math.min(32,props.h*.3)} font="Onest700" color={props.color} content={props.label}/>
  </TvView>;
}
