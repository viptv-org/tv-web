/** @jsxImportSource @solidtv/solid */
import { For, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import type { MediaItem } from '../api';
import { formatRuntime } from '../components/cards/cardText';
import { castMembers, directorNames } from '../ui/detailLinks';
import { tokens, type TokenName } from '../theme/viptv-tokens.generated';
import { EntryButton, EntryLegend, entryButtonWidth, restoreEntryFocus } from './EntryButton';
import { canvasFont } from './fonts';
import { TvText, TvView } from './runtime';

const px=(key:TokenName)=>parseFloat(String(tokens[key]));
const debug=new URLSearchParams(location.search).get('focusdebug')==='1';
type DebugWindow=Window & {__viptvEntryFocus?:{id:string;at:number};__viptvTextPanel?:{offset:number;maxOffset:number;paragraphs:number}};
let measure:CanvasRenderingContext2D|null;
function wrap(text:string,width:number,font:string,size:number):string[] {
  measure??=document.createElement('canvas').getContext('2d')!;
  measure.font=`${size}px ${canvasFont(font,size)}`;
  return text.split('\n').flatMap(paragraph=>{
    const lines:string[]=[];let line='';
    for(const word of paragraph.trim().split(/\s+/)) {
      const next=line ? `${line} ${word}` : word;
      if(measure!.measureText(next).width<=width){line=next;continue;}
      if(line){lines.push(line);line='';}
      // Filenames and URLs may contain no spaces. Iterate Unicode codepoints
      // so wrapping never drops text or splits a surrogate pair.
      for(const point of word){
        const candidate=line+point;
        if(line && measure!.measureText(candidate).width>width){lines.push(line);line=point;}
        else line=candidate;
      }
    }
    lines.push(line);return lines;
  });
}
export interface TitleInfoProps { item:MediaItem; onClose:()=>void; }
export interface NativeTextPanelProps { title:string; body:string; meta?:string; onClose:()=>void; focusPrefix?:string; }
/** The title wrapper uses the same complete synopsis/credits formatting as React. */
export function TitleInfo(props:TitleInfoProps) {
  const body=createMemo(()=>{
    const directors=directorNames(props.item),cast=castMembers(props.item);
    return [props.item.description,directors?`Director: ${directors}`:'',cast.length?`Cast: ${cast.map(member=>member.name).join(', ')}`:''].filter(Boolean).join('\n\n');
  });
  const meta=createMemo(()=>[props.item.year,formatRuntime(props.item.runtime),...props.item.genres].filter(Boolean).join(' · '));
  return <NativeTextPanel title={props.item.name} body={body()} meta={meta()} focusPrefix="title-info" onClose={props.onClose} />;
}
/** Shared native full-screen text panel for More info and complete Source details. */
export function NativeTextPanel(props:NativeTextPanelProps) {
  const prefix=props.focusPrefix??'text-panel';
  const opener=activeElement();
  let root:ElementNode|undefined, body:ElementNode|undefined, close:ElementNode|undefined;
  let focusMark:{id:string;at:number}|undefined, scrollMark:DebugWindow['__viptvTextPanel'];
  const [offset,setOffset]=createSignal(0),[focused,setFocused]=createSignal(true);
  const left=px('layout.tv.safe-x')*2, width=1920-left*2;
  const titleTop=px('layout.tv.safe-y')+30;
  // Token type roles are objects; extract sizes explicitly.
  const headingSize=parseFloat(tokens['type.tv.screen-title'].fontSize), headingLine=headingSize*1.2;
  const metaSize=parseFloat(tokens['type.tv.label'].fontSize), metaLine=metaSize*1.3;
  const rowSize=parseFloat(tokens['type.tv.row'].fontSize), rowLine=rowSize*1.5;
  const gap=px('space.5.5'), paragraphGap=px('space.6');
  const bodyWidth=width-34-60, titleLines=createMemo(()=>wrap(props.title,width,'Bricolage700',headingSize));
  const meta=()=>props.meta??'';
  const metaTop=createMemo(()=>titleTop+titleLines().length*headingLine+gap);
  const boxTop=createMemo(()=>metaTop()+(meta()?metaLine+gap:0));
  const actionY=1080-px('layout.tv.safe-y')-px('size.button.tv');
  const boxHeight=createMemo(()=>Math.max(rowLine+60,actionY-gap-boxTop()));
  const viewportHeight=createMemo(()=>boxHeight()-60);
  const paragraphs=createMemo(()=>props.body.split(/\n{2,}/).map(part=>part.trim()).filter(Boolean));
  const lines=createMemo(()=>{
    let y=0;const result:{text:string;y:number}[]=[];
    for(const paragraph of paragraphs()){
      for(const text of wrap(paragraph,bodyWidth,'Onest',rowSize)){result.push({text,y});y+=rowLine;}
      y+=paragraphGap;
    }
    return {rows:result,height:y};
  });
  const maxOffset=createMemo(()=>Math.max(0,lines().height-viewportHeight()));
  const visibleLines=createMemo(()=>lines().rows.filter(line=>line.y+rowLine>=offset()&&line.y<=offset()+viewportHeight()));
  const thumbHeight=createMemo(()=>maxOffset()>0?Math.max(viewportHeight()*0.15,viewportHeight()/lines().height*viewportHeight()):px('size.scrollbar.tv-thumb'));
  const thumbTop=()=>maxOffset()>0?offset()/maxOffset()*(viewportHeight()-thumbHeight()):0;
  const clearFocusMark=()=>{if(debug&&(window as DebugWindow).__viptvEntryFocus===focusMark)delete(window as DebugWindow).__viptvEntryFocus;};
  const scroll=(direction:number)=>{
    const room=direction>0?maxOffset()-offset():offset();
    if(room<=1){if(direction>0)close?.setFocus();return true;}
    setOffset(Math.max(0,Math.min(maxOffset(),offset()+direction*Math.min(room,Math.round(viewportHeight()*0.4)))));return true;
  };
  createEffect(()=>{if(!debug)return;scrollMark={offset:offset(),maxOffset:maxOffset(),paragraphs:paragraphs().length};(window as DebugWindow).__viptvTextPanel=scrollMark;});
  onMount(()=>body?.setFocus());
  onCleanup(()=>{clearFocusMark();if(debug&&(window as DebugWindow).__viptvTextPanel===scrollMark)delete(window as DebugWindow).__viptvTextPanel;restoreEntryFocus(root,opener);});
  const ring=parseFloat(tokens['focus.tv-shadow'].split(' ')[3]);
  return <TvView nodeRef={(node:ElementNode)=>{root=node;}} w={1920} h={1080} color={tokens['color.scrim.tv-fullscreen']} onBack={()=>{props.onClose();return true;}} onKeyPress={(event:KeyboardEvent)=>{if(['Escape','BrowserBack','GoBack'].includes(event.key)||[10009,461].includes(event.keyCode))props.onClose();return true;}}>
    <For each={titleLines()}>{(text,index)=><TvText x={left} y={titleTop+index()*headingLine} maxwidth={width} size={headingSize} font="Bricolage700" cssLineBox lineheight={1.2} letterspacing={headingSize*parseFloat(tokens['type.tv.screen-title'].letterSpacing)} content={text} color={tokens['color.text.primary']} />}</For>
    <TvText show={!!meta()} x={left} y={metaTop()} maxwidth={width} size={metaSize} cssLineBox lineheight={1.3} content={meta()} color={tokens['color.text.secondary']} />
    <TvView x={left} y={boxTop()} w={width} h={boxHeight()} nodeRef={(node:ElementNode)=>{body=node;}} onFocusChanged={(value:boolean)=>{setFocused(value);if(value&&debug){focusMark={id:`${prefix}-body`,at:performance.now()};(window as DebugWindow).__viptvEntryFocus=focusMark;}else if(!value)clearFocusMark();}} onUp={()=>scroll(-1)} onDown={()=>scroll(1)} onRight={()=>{close?.setFocus();return true;}}>
      <TvView show={focused()} x={-ring} y={-ring} w={width+ring*2} h={boxHeight()+ring*2} rounded={px('radius.3xl')+ring} color={tokens['color.fill.white']} />
      <TvView w={width} h={boxHeight()} rounded={px('radius.3xl')} color={tokens['color.surface.1']} />
      <TvView x={34} y={30} w={bodyWidth} h={viewportHeight()} clipping>
        <For each={visibleLines()}>{line=><TvText y={line.y-offset()} maxwidth={bodyWidth} maxlines={1} size={rowSize} font="Onest" cssLineBox lineheight={1.5} content={line.text} color={tokens['color.text.body']} />}</For>
      </TvView>
      <TvView x={width-px('space.4.5')-px('size.scrollbar.tv-width')} y={30+Math.round(thumbTop())} w={px('size.scrollbar.tv-width')} h={Math.round(thumbHeight())} rounded={px('size.scrollbar.tv-width')} color={tokens['color.fill.scrollbar']} />
    </TvView>
    <EntryButton id={`${prefix}-close`} x={left} y={actionY} w={entryButtonWidth('Close')} label="Close" register={(_id,node)=>{close=node;}} onActivate={props.onClose} onMove={direction=>{if(direction==='Up'||direction==='Left')body?.setFocus();}} />
    <EntryLegend items={[{key:'▲ ▼',label:'Scroll'},{key:'BACK',label:'Close'}]} />
  </TvView>;
}
