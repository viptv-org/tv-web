/** @jsxImportSource @solidtv/solid */
import { For, createMemo, createSignal } from 'solid-js';
import type { ElementNode } from '@solidtv/solid';
import type { CatalogFilter } from '../ui/catalogFilters';
import { tokens } from '../theme/viptv-tokens.generated';
import { EntryButton } from './EntryButton';
import { TvText, TvView } from './runtime';
import { filterTitle } from './discoveryQuery';
import { discoverySheetMotion } from './discoverySheetMotion';

export function DiscoveryFilterSheet(props: { filter: CatalogFilter; selected: readonly string[];
  cancel: () => void; apply: (values: readonly string[]) => void }) {
  const multiple = props.filter.kind === 'MultiChoice';
  const limit = Math.max(0, Math.min(64, props.filter.maximumSelections ?? (multiple ? 64 : 1)));
  const options = props.filter.options.map(value => ({ value,
    label: props.filter.choices?.find(choice => choice.value === value)?.label ?? value }));
  if (!multiple && !props.filter.required) options.unshift({ value: '', label: 'Default' });
  const choices = options.map((choice, index) => ({ ...choice, index }));
  const [draft, setDraft] = createSignal([...props.selected]), [notice, setNotice] = createSignal('');
  const initial = Math.max(0, choices.findIndex(choice => props.selected.includes(choice.value)));
  const [start, setStart] = createSignal(Math.floor(initial / 8) * 8);
  const nodes = new Map<string, ElementNode>();
  let focused = initial;
  let requestedFocus = '';
  const focus = (id: string) => { requestedFocus = id; queueMicrotask(() => {
    if (requestedFocus !== id || motion.closing()) return;
    const node = nodes.get(id); if (node && !node.destroyed) node.setFocus();
  }); };
  const motion = discoverySheetMotion(() => focus(choices.length ? `choice-${initial}` : 'cancel'));
  const close = () => motion.close(props.cancel);
  const valid = () => (!props.filter.required || draft().length > 0) && draft().length <= limit;
  const confirm = () => { if (valid()) { const values = [...draft()]; motion.close(() => props.apply(values)); } };
  const focusChoice = (index: number) => {
    focused = Math.max(0, Math.min(choices.length - 1, index));
    if (focused < start()) setStart(focused);
    else if (focused >= start() + 8) setStart(focused - 7);
    focus(`choice-${focused}`);
  };
  const toggle = (value: string) => {
    if (motion.closing()) return;
    if (!multiple) { motion.close(() => props.apply(value ? [value] : [])); return; }
    if (draft().includes(value)) setDraft(before => before.filter(entry => entry !== value));
    else if (draft().length < limit) setDraft(before => [...before, value]);
    else { setNotice(`Select at most ${limit}.`); return; }
    setNotice('');
  };
  const visible = createMemo(() => choices.slice(start(), start() + 8));
  const register = (id: string, node: ElementNode) => nodes.set(id, node);
  const footer = multiple ? ['clear', 'apply', 'cancel'] : ['cancel'];
  const moveFooter = (id: string, direction: string) => {
    if (direction === 'Up') { if (choices.length) focusChoice(focused); return; }
    const next = Math.max(0, Math.min(footer.length - 1, footer.indexOf(id) + (direction === 'Left' ? -1 : direction === 'Right' ? 1 : 0)));
    focus(footer[next]);
  };
  return <TvView zIndex={20} w={1920} h={1080} nodeRef={motion.root} onBack={() => { close(); return true; }}>
    <TvView w={1920} h={1080} color={tokens['color.scrim.tv-panel']} />
    <TvView x={1920} w={820} h={1080} color={tokens['color.surface.1']} nodeRef={motion.panel}>
      <TvText x={64} y={64} maxwidth={692} font="Bricolage700" size={44} content={filterTitle(props.filter)} />
      <TvText x={64} y={126} maxwidth={692} size={22} color={tokens['color.text.secondary']}
        content={notice() || (multiple ? `${draft().length} selected · up to ${limit}${props.filter.required ? ' · choose at least one' : ''}` : 'Choose a value')} />
      <For each={visible()}>{choice => <EntryButton id={`choice-${choice.index}`} x={64} y={190 + (choice.index - start()) * 84}
        w={692} h={64} radius={12} align="left" label={choice.label} icon={multiple ? draft().includes(choice.value) ? 'square-check' : 'square' : undefined}
        register={register} onActivate={() => toggle(choice.value)} onFocus={() => { focused = choice.index; }}
        onMove={direction => { if (direction === 'Right') focus(multiple ? 'apply' : 'cancel');
          else if (direction === 'Left') focus(footer[0]);
          else if (direction === 'Up') focusChoice(choice.index - 1); else if (direction === 'Down') {
          if (choice.index === choices.length - 1) focus(footer[0]); else focusChoice(choice.index + 1);
        } }} />}</For>
      <For each={footer}>{(id, index) => <EntryButton id={id} x={64 + index() * 236} y={944} w={multiple ? 220 : 692} h={64} radius={12}
        label={id === 'apply' ? 'Apply' : id === 'clear' ? 'Clear' : 'Cancel'} register={register}
        onMove={direction => moveFooter(id, direction)} onActivate={() => {
          if (id === 'cancel') close(); else if (id === 'clear') { if (!motion.closing()) setDraft([]); }
          else if (valid()) confirm(); else setNotice('Choose at least one option.');
        }} />}</For>
    </TvView>
  </TvView>;
}
