/** @jsxImportSource @solidtv/solid */
import { For, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import type { MediaItem } from '../api';
import { artworkUrl, presentation } from '../core/presentations';
import { upNextLabel } from '../ui/app/upNext';
import { tokens, type TokenName } from '../theme/viptv-tokens.generated';
import { EntryButton, EntryLegend, entryButtonWidth, restoreEntryFocus } from './EntryButton';
import { canvasFont } from './fonts';
import { TvText, TvView } from './runtime';

const px = (key: TokenName) => parseFloat(String(tokens[key]));
const screenWidth = 1920, screenHeight = 1080;
let measure: CanvasRenderingContext2D | null;
/** Match wrapping height while keeping the label itself in the native text renderer. */
function lineCount(text: string, width: number, font: string, size: number) {
  if (!text) return 0;
  measure ??= document.createElement('canvas').getContext('2d')!;
  measure.font = `${size}px ${canvasFont(font,size)}`;
  let count=0;
  for (const paragraph of text.split('\n')) {
    let line=''; count++;
    for(const word of paragraph.split(/\s+/)) {
      const next=line ? `${line} ${word}` : word;
      if(line && measure.measureText(next).width > width) {count++;line=word;} else line=next;
    }
  }
  return count;
}
function nativeOverlay() {
  const opener=activeElement(), nodes=new Map<string,ElementNode>();
  let root:ElementNode|undefined;
  onCleanup(()=>restoreEntryFocus(root,opener));
  return {
    root:(node:ElementNode)=>{root=node;},
    register:(id:string,node:ElementNode)=>nodes.set(id,node),
    focus:(id:string)=>(nodes.get(id)??root)?.setFocus(),
  };
}

export interface UpNextOverlayProps {
  item?: MediaItem;
  current?: MediaItem;
  left: number;
  total: number;
  onPlay: () => void;
  onCancel: () => void;
}
/** Presentation only: the player controller owns countdown and next-session lifecycle. */
export function UpNextOverlay(props: UpNextOverlayProps) {
  const focus=nativeOverlay();
  onMount(()=>focus.focus('up-next-play'));
  const width=px('size.player.up-next-tv'), padding=px('space.6'), border=px('size.border.strong');
  const inset=padding+border, innerWidth=width-inset*2;
  const imageWidth=px('size.player.still-tv-width'), imageHeight=px('size.player.still-tv-height');
  const textX=inset+imageWidth+px('space.5'), textWidth=innerWidth-imageWidth-px('space.5');
  const eyebrow=tokens['type.tv.eyebrow'], titleType=tokens['type.tv.row'], meta=tokens['type.tv.meta'];
  const eyebrowSize=parseFloat(eyebrow.fontSize), titleSize=parseFloat(titleType.fontSize), metaSize=parseFloat(meta.fontSize);
  const textGap=px('space.1.5'), gap=px('space.4.5');
  const title=createMemo(()=>upNextLabel(props.item,props.current));
  const titleHeight=createMemo(()=>lineCount(title(),textWidth,'Onest600',titleSize)*titleSize*1.3);
  const countY=createMemo(()=>inset+eyebrowSize*eyebrow.lineHeight+textGap+(title() ? titleHeight()+textGap : 0));
  const rowHeight=createMemo(()=>Math.max(imageHeight,countY()-inset+metaSize*meta.lineHeight));
  const progressY=createMemo(()=>inset+rowHeight()+gap), progressHeight=px('size.progress.tv');
  const actionsY=createMemo(()=>progressY()+progressHeight+gap);
  const height=createMemo(()=>actionsY()+px('size.button.tv')+inset);
  const outline=createMemo(()=>{
    const radius=px('radius.player-card-tv'), half=border/2;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height()}"><rect x="${half}" y="${half}" width="${width-border}" height="${height()-border}" rx="${radius-half}" fill="none" stroke="${tokens['color.line.chip']}" stroke-width="${border}"/></svg>`;
    return 'data:image/svg+xml,'+encodeURIComponent(svg);
  });
  const still=createMemo(()=>{
    const next=props.item;
    const art=next ? presentation(next).episodeImage ?? next.background ?? next.poster : undefined;
    return art ? artworkUrl(art,480,268) : undefined;
  });
  const elapsed=()=>props.total>0 ? Math.min(1,Math.max(0,(props.total-props.left)/props.total)) : 0;
  const playWidth=entryButtonWidth('Play now',true)+px('space.1');
  const move=(direction:string)=>focus.focus(direction==='Left'||direction==='Up' ? 'up-next-play' : 'up-next-cancel');
  return <TvView nodeRef={focus.root} w={screenWidth} h={screenHeight}
    onBack={()=>{props.onCancel();return true;}} onKeyPress={(event:KeyboardEvent)=>{if(['Escape','BrowserBack','GoBack'].includes(event.key)||[10009,461].includes(event.keyCode))props.onCancel();return true;}}>
    <TvView x={screenWidth-px('layout.tv.safe-x')-width} y={px('size.player.overlay-top-tv')} w={width} h={height()} rounded={px('radius.player-card-tv')} color={tokens['color.player.up-next']}>
      <TvView w={width} h={height()} src={outline()} />
      <TvView x={inset} y={inset} w={imageWidth} h={imageHeight} rounded={px('radius.lg')} color={tokens['color.surface.2']} />
      <TvView show={!!still()} x={inset} y={inset} w={imageWidth} h={imageHeight} rounded={px('radius.lg')} src={still()} fit="cover" />
      <TvText x={textX} y={inset} maxwidth={textWidth} size={eyebrowSize} font="Onest700" cssLineBox lineheight={eyebrow.lineHeight} letterspacing={parseFloat(eyebrow.letterSpacing)*eyebrowSize} color={tokens['color.text.secondary']} content="NEXT EPISODE" />
      <TvText show={!!title()} x={textX} y={inset+eyebrowSize*eyebrow.lineHeight+textGap} maxwidth={textWidth} size={titleSize} font="Onest600" cssLineBox lineheight={1.3} color={tokens['color.text.primary']} content={title()} />
      <TvText x={textX} y={countY()} size={metaSize} font="Onest" cssLineBox lineheight={meta.lineHeight} color={tokens['color.text.tertiary']} content={`Starts in ${Math.max(0,Math.ceil(props.left))}`} />
      <TvView x={inset} y={progressY()} w={innerWidth} h={progressHeight} rounded={progressHeight} color={tokens['color.line.strong']}>
        <TvView w={innerWidth*elapsed()} h={progressHeight} rounded={progressHeight} color={tokens['color.accent.default']} />
      </TvView>
      <EntryButton id="up-next-play" x={inset} y={actionsY()} w={playWidth} icon="play" label="Play now" register={focus.register} onMove={move} onActivate={props.onPlay} />
      <EntryButton id="up-next-cancel" x={inset+playWidth+px('space.3.5')} y={actionsY()} w={entryButtonWidth('Cancel')} label="Cancel" register={focus.register} onMove={move} onActivate={props.onCancel} />
    </TvView>
    <EntryLegend items={[{key:'OK',label:'Play now'},{key:'BACK',label:'Cancel'}]} />
  </TvView>;
}

export interface PlayerDialogProps {
  title: string;
  message?: string;
  choices: {id:string;label:string;current?:boolean}[];
  initialId?: string;
  onSelect: (id:string) => void;
  onCancel: () => void;
}
export function PlayerDialog(props: PlayerDialogProps) {
  const focus=nativeOverlay();
  const initial=Math.max(0,props.choices.findIndex(choice=>choice.id===props.initialId));
  const [start,setStart]=createSignal(0);
  onMount(()=>moveTo(initial));
  const width=px('layout.tv.panel-width'), left=screenWidth-width, x=left+px('layout.tv.panel-pad-left');
  const contentWidth=width-px('layout.tv.panel-pad-left')-px('layout.tv.panel-pad-right');
  const top=px('layout.tv.panel-pad-top'), gap=px('space.4.5');
  const titleType=tokens['type.tv.panel-title'], titleSize=parseFloat(titleType.fontSize);
  const titleHeight=createMemo(()=>lineCount(props.title,contentWidth,'Bricolage700',titleSize)*titleSize*titleType.lineHeight);
  const messageSize=parseFloat(tokens['type.tv.label'].fontSize), messageLine=tokens['type.tv.body'].lineHeight;
  const messageHeight=createMemo(()=>lineCount(props.message??'',contentWidth,'Onest',messageSize)*messageSize*messageLine);
  const choicesY=createMemo(()=>top+titleHeight()+gap+(props.message ? messageHeight()+gap : 0));
  const capacity=createMemo(()=>Math.max(1,Math.floor((screenHeight-px('size.button.tv')-choicesY())/(px('size.row.tv')+px('space.3.5')))));
  function moveTo(index:number) {
    const next=Math.max(0,Math.min(props.choices.length-1,index));
    if(next<start())setStart(next);else if(next>=start()+capacity())setStart(next-capacity()+1);
    queueMicrotask(()=>{if(props.choices[next])focus.focus(`player-dialog-${props.choices[next].id}`);});
  }
  const move=(index:number,direction:string)=>moveTo(index+(direction==='Up'?-1:direction==='Down'?1:0));
  return <TvView nodeRef={focus.root} w={screenWidth} h={screenHeight} color={tokens['color.scrim.tv-panel']} onBack={()=>{props.onCancel();return true;}} onKeyPress={(event:KeyboardEvent)=>{if(['Escape','BrowserBack','GoBack'].includes(event.key)||[10009,461].includes(event.keyCode))props.onCancel();return true;}}>
    <TvView x={left} w={width} h={screenHeight} color={tokens['color.surface.1']} />
    <TvText x={x} y={top} maxwidth={contentWidth} size={titleSize} font="Bricolage700" cssLineBox lineheight={titleType.lineHeight} letterspacing={parseFloat(titleType.letterSpacing)*titleSize} content={props.title} color={tokens['color.text.primary']} />
    <TvText show={!!props.message} x={x} y={top+titleHeight()+gap} maxwidth={contentWidth} size={messageSize} font="Onest" cssLineBox lineheight={messageLine} content={props.message??''} color={tokens['color.text.secondary']} />
    <For each={props.choices.slice(start(),start()+capacity())}>{(choice,index)=><EntryButton id={`player-dialog-${choice.id}`} x={x} y={choicesY()+index()*(px('size.row.tv')+px('space.3.5'))} w={contentWidth} h={px('size.row.tv')} radius={px('radius.3xl')} background={tokens['color.surface.1']} selected={choice.current} align="left" label={choice.label} register={focus.register} onMove={direction=>move(start()+index(),direction)} onActivate={()=>props.onSelect(choice.id)} />}</For>
    <EntryLegend items={[{key:'OK',label:'Select'},{key:'BACK',label:'Cancel'}]} />
  </TvView>;
}
