/** @jsxImportSource @solidtv/solid */
import { For, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import { TvText, TvView } from './runtime';
import { canvasFont } from './fonts';
import { tokens } from '../theme/viptv-tokens.generated';
import { EntryButton, EntryLegend, restoreEntryFocus } from './EntryButton';

export interface TextEntryProps {
  title: string; initialValue?: string; secret?: boolean; onSubmit: (value: string, signal?: AbortSignal) => Promise<void>; onCancel: () => void;
  maxLength?: number; showCount?: boolean; hint?: string; mono?: boolean; description?: string;
}
export function TextEntry(props: TextEntryProps) {
  const [value, setValue] = createSignal(props.initialValue ?? ''), [error, setError] = createSignal(''), [pending, setPending] = createSignal(false), [lower, setLower] = createSignal(true);
  const nodes = new Map<string, ElementNode>(), opener = activeElement();
  let alive = true, root: ElementNode | undefined;
  let submission: AbortController | undefined;
  const cancel = () => { submission?.abort(); props.onCancel(); };
  const limit = props.maxLength ?? (props.secret ? 8 : 2048);
  const update = (next: string) => { if (pending()) return; setValue((props.secret ? next.replace(/\D/g, '') : next).slice(0, limit)); setError(''); };
  const append = (text: string) => update(value() + text);
  const remove = () => update(value().slice(0, -1));
  const focus = (id: string) => nodes.get(id)?.setFocus();
  onMount(() => focus('key-0'));
  onCleanup(() => { alive = false; submission?.abort(); restoreEntryFocus(root, opener); });
  const save = async () => {
    if (!alive || pending()) return;
    if (props.secret && !/^\d{4,8}$/.test(value())) { setError('Enter a 4–8 digit parent PIN'); return; }
    setPending(true); setError('');
    const request = new AbortController(); submission = request;
    try { await props.onSubmit(value(), request.signal); } catch (e) { if (alive && !request.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to save'); } finally { if (alive && !request.signal.aborted) setPending(false); }
  };
  const back = (event: KeyboardEvent) => { if (!props.secret && value() && event.key !== 'Escape') remove(); else cancel(); return true; };
  const key = (event: KeyboardEvent) => {
    if (['Escape', 'BrowserBack', 'GoBack'].includes(event.key) || [10009,461].includes(event.keyCode)) return back(event);
    if (event.key === 'MediaFastForward' || event.keyCode === 417) { void save(); return true; }
    if (['Backspace','Delete'].includes(event.key)) { remove(); return true; }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && (!props.secret || /^\d$/.test(event.key))) { append(event.key); return true; }
    return true; // modal input never reaches the screen below it
  };
  const letters = 'abcdefghijklmnopqrstuvwxyz1234567890:/.-_@';
  const count = props.secret ? 11 : 45;
  const cols = props.secret ? 3 : 6;
  const move = (index: number, direction: string) => {
    if (direction === 'Down' && Math.floor(index / cols) >= Math.floor((count - 1) / cols)) return focus('save');
    // The last text row has spans 1/3/2, so navigate by its visual columns.
    if (!props.secret && direction === 'Down' && index >= 36 && index < 42) return focus(`key-${index === 36 ? 42 : index < 40 ? 43 : 44}`);
    if (!props.secret && direction === 'Up' && index >= 42) return focus(`key-${index === 42 ? 36 : index === 43 ? 38 : 40}`);
    let next = index + ({Left:-1,Right:1,Up:-cols,Down:cols}[direction] ?? 0);
    if (direction === 'Left' && index % cols === 0 || direction === 'Right' && index % cols === cols - 1) next = index;
    focus(`key-${Math.max(0,Math.min(count - 1,next))}`);
  };
  const textMeasure=document.createElement('canvas').getContext('2d')!;
  const caretX=createMemo(()=>{
    textMeasure.font=`38px ${canvasFont('Onest600',38)}`;
    return 30+Math.min(926,textMeasure.measureText(value()||props.title).width)+parseFloat(tokens['space.0.5']);
  });
  const keyX = props.secret ? 1164 : 1184, keyY = props.secret ? 300 : 94, width = props.secret ? 480 : 640;
  const h = props.secret ? 80 : 64, gap = props.secret ? 12 : 10, unit = (width - (cols - 1) * gap) / cols;
  return <TvView nodeRef={(node: ElementNode) => { root = node; }} w={1920} h={1080} color={props.secret ? tokens["color.scrim.tv-panel"] : tokens["color.bg"]} onBack={back} onKeyPress={key}>
    <TvView show={!!props.secret} x={1100} w={820} h={1080} color={tokens["color.surface.1"]} />
    <TvText x={props.secret ? 1164 : 96} y={props.secret ? 64 : 94} size={44} font="Bricolage700" maxwidth={props.secret ? 660 : 980} content={props.title} />
    <TvText show={!!props.secret} x={1164} y={140} size={24} content={props.description ?? 'Use your remote or a connected keyboard.'} />
    <TvView show={!props.secret} x={96} y={170} w={992} h={96} rounded={22} color={tokens["color.fill.tv-field"]}>
      <TvText x={30} y={27} size={38} font="Onest600" maxwidth={932} maxlines={1} content={value() || props.title} color={value() ? tokens["color.text.primary"] : tokens["color.text.tertiary"]} />
      <TvView x={caretX()} y={29} w={parseFloat(tokens["size.caret.tv-width"])} h={38} color={tokens["color.accent.default"]} />
    </TvView>
    <For each={props.secret ? Array.from({length:8}, (_,i)=>i) : []}>{i => <TvView show={i < Math.max(6,value().length + 1)} x={1164+i*80} y={202} w={68} h={80} rounded={18} color={error() ? tokens["color.status.danger-tv"] : tokens["color.line.hairline"]}>
      <TvView x={2} y={2} w={64} h={76} rounded={16} color={tokens["color.surface.1"]} />
      <TvView x={2} y={2} w={64} h={76} rounded={16} color={tokens["color.fill.tv-field"]} />
      <TvView show={i < value().length} x={25} y={31} w={18} h={18} rounded={9} color={tokens["color.text.primary"]} />
      <TvView show={!error() && i === value().length && value().length < limit} x={33} y={22} w={2} h={36} color={tokens["color.accent.default"]} />
    </TvView>}</For>
    <TvText x={props.secret ? 1164 : 96} y={props.secret ? 770 : 292} size={22} maxwidth={props.secret ? 660 : 980} content={error() || props.hint || ''} color={error() ? tokens["color.status.danger-tv"] : tokens["color.text.tertiary"]} />
    <TvText show={!!props.showCount && !props.secret} x={96} y={292} w={992} maxwidth={992} align="right" size={20} content={`${value().length} / ${limit}`} color={tokens["color.text.tertiary"]} />
    <For each={Array.from({length:count}, (_,i)=>i)}>{i => {
      const action = i >= 42, span = i === 43 ? 3 : i === 44 ? 2 : 1;
      const column = i === 44 ? 4 : i % cols;
      const label = () => props.secret ? i === 9 ? '⌫' : i === 10 ? '0' : String(i+1) : i === 42 ? 'Aa' : i === 43 ? 'Space' : i === 44 ? '⌫' : lower() ? letters[i] : letters[i].toUpperCase();
      const glyph = props.secret ? i===9 ? 'delete' : undefined : i===43 ? 'space' : i===44 ? 'delete' : undefined;
      return <EntryButton keyboard id={`key-${i}`} x={keyX+column*(unit+gap)} y={keyY+Math.floor(i/cols)*(h+gap)} w={unit*span+gap*(span-1)} h={h} radius={props.secret ? 18 : 14} label={glyph ? undefined : label()} keyGlyph={glyph} keyGlyphSize={props.secret ? 32 : 28} labelWeight={action ? 700 : 600} size={props.secret ? 34 : action ? 24 : 28}
        register={(id,node)=>nodes.set(id,node)} onMove={direction=>move(i,direction)} onActivate={()=>{ if (props.secret && i===9 || !props.secret && i===44) remove(); else if (!props.secret && i===42) setLower(!lower()); else append(!props.secret && i===43 ? ' ' : label()); }} onHold={props.secret && i===9 || !props.secret && i===44 ? ()=>update('') : undefined} />;
    }}</For>
    <For each={['save','cancel']}>{(id,index)=><EntryButton id={id} x={keyX+index()*(width+14)/2} y={keyY+Math.ceil(count/cols)*(h+gap)+6} w={(width-14)/2} label={id==='save' ? pending() ? 'Saving…' : 'Done' : 'Cancel'} register={(id,node)=>nodes.set(id,node)} onActivate={()=>{ if(id==='save') void save(); else cancel(); }} onMove={direction=>focus(direction==='Up' ? `key-${count-1}` : direction==='Left' ? 'save' : direction==='Right' ? 'cancel' : id)} />}</For>
    <EntryLegend items={props.secret ? [{key:'OK',label:'Select'},{key:'BACK',label:'Cancel'}] : [{key:'OK',label:'Type'},{key:'BACK',label:'Delete'},{key:'▶▶',label:'Done'}]} />
  </TvView>;
}
