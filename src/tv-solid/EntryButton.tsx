/** @jsxImportSource @solidtv/solid */
import { For, createMemo, createSignal, onCleanup } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import { suppressKeyUntilRelease, releaseKeySuppression } from '@solidtv/solid/primitives';
import { TvText, TvView } from './runtime';
import { tokens } from '../theme/viptv-tokens.generated';
import { vectorIcon, type VectorIcon } from './vectorIcons';
import { canvasFont } from './fonts';

const focusDebug = new URLSearchParams(location.search).get('focusdebug') === '1';
type FocusWindow = Window & { __viptvEntryFocus?: { id: string; at: number } };
// The 700ms hold is the shared remote contract; there is no design hold token.
const HOLD_MS = 700;
const FOCUS_RING = parseFloat(tokens['focus.tv-shadow'].split(' ')[3]);

const buttonWidths = new Map<string, number>();
let buttonMeasure: CanvasRenderingContext2D | null;
/** CSS TV buttons: measured 26/700 label + 34px side padding, 28px icon + 12px gap. */
export function entryButtonWidth(label: string, icon = false) {
  let width = buttonWidths.get(label);
  if (width === undefined) {
    buttonMeasure ??= document.createElement('canvas').getContext('2d')!;
    buttonMeasure.font = `26px ${canvasFont('Onest700', 26)}`;
    width = buttonMeasure.measureText(label).width;
    buttonWidths.set(label, width);
  }
  return width + 68 + (icon ? 40 : 0);
}

/*
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
// Lucide Space/Delete paths use the same ISC license as vectorIcons.ts.
const keyboardGlyphCache = new Map<string,string>();
function keyboardGlyph(name: 'space'|'delete', color: string) {
  const key=name+color, cached=keyboardGlyphCache.get(key);
  if(cached)return cached;
  const paths=name==='space' ? ['M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1'] : ['M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z','m12 9 6 6','m18 9-6 6'];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
  const source='data:image/svg+xml,'+encodeURIComponent(svg);keyboardGlyphCache.set(key,source);return source;
}

/** Native focus leaf. Activation happens on key release, and a lost focus cancels it. */
export function EntryButton(props: { id: string; x: number; y: number; w: number; h?: number; label?: string; keyGlyph?: 'space'|'delete'; keyGlyphSize?: number; labelWeight?: 600|700; icon?: VectorIcon; src?: string; selected?: boolean; danger?: boolean; radius?: number; size?: number; background?: string; align?: 'left' | 'center'; keyboard?: boolean; register: (id: string, node: ElementNode) => void; onActivate: () => void; onHold?: () => void; onFocus?: () => void; onMove: (direction: string) => void }) {
  const [focused, setFocused] = createSignal(false);
  let press: KeyboardEvent | undefined;
  let focusMark: {id:string;at:number} | undefined;
  const clearFocusMark = () => {
    if (focusDebug && (window as FocusWindow).__viptvEntryFocus === focusMark)
      delete (window as FocusWindow).__viptvEntryFocus;
  };
  let armed = false, held = false, timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { armed = false; clearTimeout(timer); if (press) { const event = press; press = undefined; releaseKeySuppression(event); } };
  window.addEventListener('blur', cancel);
  onCleanup(() => { cancel(); window.removeEventListener('blur', cancel); clearFocusMark(); });
  const scale = () => focused() ? tokens[props.src ? 'focus.tv-scale-tile' : props.keyboard ? 'focus.tv-scale-key' : props.align === 'left' ? 'focus.tv-scale-row' : 'focus.tv-scale-button'] : 1;
  return <TvView scale={scale()} x={props.x} y={props.y} w={props.w} h={props.h ?? 72} rounded={props.radius ?? 36}
    nodeRef={(node: ElementNode) => props.register(props.id, node)}
    onFocusChanged={(focus: boolean) => { setFocused(focus); if (focus) { if (focusDebug) { focusMark = { id: props.id, at: performance.now() }; (window as FocusWindow).__viptvEntryFocus = focusMark; } props.onFocus?.(); } else { clearFocusMark(); cancel(); } }}
    onEnter={(event: KeyboardEvent) => { if (!armed) { armed = true; held = false; press = event;
      suppressKeyUntilRelease(event, () => { const activate = armed && !held; armed = false; press = undefined; clearTimeout(timer); if (activate) props.onActivate(); });
      if (props.onHold) timer = setTimeout(() => { held = true; props.onHold?.(); }, HOLD_MS);
    } return true; }}
    onLeft={() => { props.onMove('Left'); return true; }} onRight={() => { props.onMove('Right'); return true; }}
    onUp={() => { props.onMove('Up'); return true; }} onDown={() => { props.onMove('Down'); return true; }}>
    <TvView show={focused()} x={-FOCUS_RING} y={-FOCUS_RING} w={props.w + FOCUS_RING * 2} h={(props.h ?? 72) + FOCUS_RING * 2} rounded={(props.radius ?? 36) + FOCUS_RING} color={tokens["color.fill.white"]} />
    <TvView w={props.w} h={props.h ?? 72} rounded={props.radius ?? 36} color={focused() ? tokens["color.text.primary"] : props.background ?? tokens[props.keyboard || props.align === "left" ? "color.fill.tv-field" : "color.fill.tv-unfocused"]} />
    <TvView show={!!props.src} x={focused() ? 3 : 0} y={focused() ? 3 : 0} w={props.w - (focused() ? 6 : 0)} h={(props.h ?? 72) - (focused() ? 6 : 0)} rounded={props.radius ?? 30} src={props.src} fit="cover" />
    <TvText show={!!props.label} x={props.align === "left" ? 30 : props.icon ? 74 : 12} y={((props.h ?? 72) - (props.size ?? 26)) / 2} w={props.w - (props.icon ? 108 : 24)} maxwidth={props.w - (props.align === "left" ? 90 : props.icon ? 108 : 24)} maxlines={1} align={props.icon ? "left" : props.align ?? "center"} cssLineBox lineheight={1.2} size={props.size ?? 26} font={props.labelWeight === 700 ? "Onest700" : props.keyboard || props.align === "left" ? "Onest600" : "Onest700"} color={focused() ? tokens["color.on.light"] : props.danger ? tokens["color.status.danger-tv"] : tokens["color.text.primary"]} content={props.label ?? ''} />
    <TvView show={!!props.keyGlyph} x={(props.w-(props.keyGlyphSize??28))/2} y={((props.h??72)-(props.keyGlyphSize??28))/2} w={props.keyGlyphSize??28} h={props.keyGlyphSize??28} src={keyboardGlyph(props.keyGlyph??"space",focused()?tokens["color.on.light"]:tokens["color.text.primary"])} />
    <TvView show={!!props.icon} x={34} y={((props.h ?? 72)-28)/2} w={28} h={28} src={vectorIcon(props.icon ?? "trash", focused() ? tokens["color.on.light"] : props.danger ? tokens["color.status.danger-tv"] : tokens["color.text.primary"])} />
    <TvView show={props.id === "profile-name"} x={props.w - 58} y={((props.h ?? 72)-28)/2} w={28} h={28} src={vectorIcon("pencil",focused()?tokens["color.on.light"]:tokens["color.text.secondary"])} />
    <TvText show={!!props.selected} x={props.w - 36} y={8} size={28} content="✓" color={tokens["color.text.primary"]} />
  </TvView>;
}

/** Restore only focus owned by the closing overlay, never a newer screen's focus. */
export function restoreEntryFocus(root: ElementNode | undefined, opener: ElementNode | undefined) {
  const closingFocus = activeElement();
  let owned = false;
  for (let node = closingFocus; node; node = node.parent) {
    if (node === root) { owned = true; break; }
  }
  if (!owned || !opener) return;
  queueMicrotask(() => {
    const current = activeElement();
    if (current && current !== closingFocus) return;
    if (!opener.parent) return;
    for (let node: ElementNode | undefined = opener; node; node = node.parent) {
      if (node.destroyed || node.alpha === 0) return;
    }
    opener.setFocus();
  });
}


const legendOutlineCache = new Map<number, string>();
function legendOutline(width: number) {
  const cached = legendOutlineCache.get(width);
  if (cached) return cached;
  const height = parseFloat(tokens['size.keycap.tv-height']);
  const border = parseFloat(tokens['size.keycap.tv-border']);
  const radius = parseFloat(tokens['size.keycap.tv-radius']);
  const half = border / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${half}" y="${half}" width="${width-border}" height="${height-border}" rx="${radius-half}" fill="none" stroke="${tokens['color.line.keycap-tv']}" stroke-width="${border}"/></svg>`;
  const source = 'data:image/svg+xml,' + encodeURIComponent(svg);
  legendOutlineCache.set(width, source);
  return source;
}

/** Decorative native TV key hints, measured and anchored to the CSS safe area. */
export function EntryLegend(props: { items: {key: string; label: string}[] }) {
  const height = parseFloat(tokens['size.keycap.tv-height']);
  const keySize = parseFloat(tokens['type.tv.keycap'].fontSize);
  const labelSize = parseFloat(tokens['type.tv.caption'].fontSize);
  const gap = parseFloat(tokens['space.3']), itemGap = parseFloat(tokens['space.9']);
  const measure = (text: string, font: string, size: number) => {
    buttonMeasure ??= document.createElement('canvas').getContext('2d')!;
    buttonMeasure.font = `${size}px ${canvasFont(font,size)}`;
    return buttonMeasure.measureText(text).width;
  };
  const layout = createMemo(() => {
    let x = 0;
    const items = props.items.map(item => {
      const keyWidth = Math.max(parseFloat(tokens['size.keycap.tv-min-width']), measure(item.key,'Onest700',keySize) + 24);
      const labelWidth = measure(item.label,'Onest',labelSize);
      const position = x;
      x += keyWidth + gap + labelWidth + itemGap;
      return {...item,x:position,keyWidth,labelWidth};
    });
    return {items,width:Math.max(0,x-itemGap)};
  });
  return <TvView x={1920-parseFloat(tokens['layout.tv.safe-x'])-layout().width} y={1080-parseFloat(tokens['layout.tv.safe-y'])-height} w={layout().width} h={height}>
    <For each={layout().items}>{item => <TvView x={item.x} w={item.keyWidth+gap+item.labelWidth} h={height}>
      <TvView w={item.keyWidth} h={height} src={legendOutline(item.keyWidth)} />
      <TvText x={0} y={(height-keySize)/2} w={item.keyWidth} maxwidth={item.keyWidth} align="center" size={keySize} font="Onest700" cssLineBox lineheight={1} color={tokens['color.text.primary']} content={item.key} />
      <TvText x={item.keyWidth+gap} y={(height-labelSize)/2} size={labelSize} font="Onest" cssLineBox lineheight={1} color={tokens['color.text.secondary']} content={item.label} />
    </TvView>}</For>
  </TvView>;
}
