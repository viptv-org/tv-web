/** @jsxImportSource @solidtv/solid */
import { For } from "solid-js";
import { TvView } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { railIcon, type RailIcon } from "./railIcons";
const items: {icon:RailIcon;y:number}[]=[{icon:"search",y:202},{icon:"home",y:280},{icon:"discover",y:358},{icon:"live",y:436},{icon:"list",y:514},{icon:"settings",y:976}];
/** One geometry shared by every browsing screen and the expanded rail. */
export function CollapsedRail(props:{avatar:string;current:string}) {
 const current=()=>props.current==="library"?"list":props.current;
 return <TvView w={144} h={1080}>
   <TvView x={44} y={54} w={56} h={56} rounded={28} color={tokens["color.surface.2"]}/>
   <TvView x={44} y={54} w={56} h={56} rounded={28} fit="cover" src={props.avatar} show={!!props.avatar}/>
   <For each={items}>{item=><TvView>
     <TvView x={40} y={item.y-18} w={64} h={64} rounded={32} color={tokens["color.surface.2"]} show={current()===item.icon}/>
     <TvView x={58} y={item.y} w={28} h={28} src={railIcon(item.icon,current()===item.icon)}/>
   </TvView>}</For>
 </TvView>;
}
