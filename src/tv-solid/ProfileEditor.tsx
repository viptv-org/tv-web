/** @jsxImportSource @solidtv/solid */
import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { activeElement, type ElementNode } from '@solidtv/solid';
import type { TvApi, TvProfile } from '../api';
import catalog from '../ui/avatars.json';
import { TvText, TvView } from './runtime';
import { tokens } from '../theme/viptv-tokens.generated';
import { EntryButton, EntryLegend, entryButtonWidth, restoreEntryFocus } from './EntryButton';
import { TextEntry } from './TextEntry';

const worlds = catalog.categories.filter(category => !('available' in category) || category.available !== false);
const pageCount = Math.ceil(catalog.perCategory / 18);
const avatarSrc = (style: string, choice: number) => `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`;
export function ProfileEditor(props: { api: TvApi; profile?: TvProfile; primary: boolean; onDone: () => Promise<void>; onCancel: () => void }) {
  const [name,setName] = createSignal(props.profile?.name ?? '');
  const [style,setStyle] = createSignal(typeof props.profile?.raw.avatar_style === 'string' ? props.profile.raw.avatar_style : 'critters');
  const [choice,setChoice] = createSignal(typeof props.profile?.raw.avatar_choice === 'number' ? props.profile.raw.avatar_choice : 1);
  const [preview,setPreview] = createSignal(style()), [page,setPage] = createSignal(0), [worldStart,setWorldStart] = createSignal(0);
  const [mode,setMode] = createSignal<'form'|'name'|'avatar'|'pin'|'delete'>('form');
  const [error,setError] = createSignal(''), [missing,setMissing] = createSignal(false), [busy,setBusy] = createSignal(false);
  let pending: 'save'|'delete' = 'save', returnId = 'profile-name', scope: ReturnType<TvApi['createScope']> | undefined, alive = true;
  let root: ElementNode | undefined;
  const opener = activeElement(), nodes = new Map<string,ElementNode>();
  const focus = (id: string) => nodes.get(id)?.setFocus();
  const register = (id: string,node: ElementNode) => nodes.set(id,node);
  const deletable = () => !!props.profile && !props.primary;
  onCleanup(() => { alive = false; scope?.abort(); restoreEntryFocus(root, opener); });
  createEffect(() => { const current = mode(); queueMicrotask(() => { if (!alive) return; if(current === 'form') focus(returnId); else if(current==='avatar') focus(`world-${worlds.findIndex(w=>w.style===preview())}`); else if(current==='delete') focus('delete-cancel'); }); });
  const cancel = () => { scope?.abort(); scope = undefined; if(mode()==='form') props.onCancel(); else setMode('form'); };
  const save = async (remove = false) => {
    if(!alive || busy()) return;
    if(!remove && !name().trim()) { setMissing(true); focus('profile-name'); return; }
    if(remove && !deletable()) return;
    setBusy(true); setError('');
    try {
      if(remove) await props.api.deleteProfile(props.profile!.id);
      else {
        const value = {name:name().trim(), avatar_style:style(),avatar_choice:choice()};
        if(props.profile) await props.api.updateProfile(props.profile.id, {...value,...(!props.profile.setupComplete ? {setup_complete:true} : {})});
        else await props.api.createProfile(value);
      }
      if(alive) await props.onDone();
    } catch(e) {
      if(!alive) return;
      if((e as {status?:number}).status===403) { pending = remove ? 'delete' : 'save'; returnId = remove ? 'profile-delete' : 'profile-save'; setMode('pin'); }
      else setError(e instanceof Error ? e.message : 'Could not save your profile. Please try again.');
    } finally { if(alive) setBusy(false); }
  };
  const formMove = (id:string, direction:string) => {
    const actions = ['profile-save','profile-cancel',...(deletable() ? ['profile-delete'] : [])];
    if(id==='profile-avatar') return focus(direction==='Right' ? 'profile-name' : id);
    if(id==='profile-name') return focus(direction==='Left' ? 'profile-avatar' : direction==='Down' ? 'profile-save' : id);
    if(direction==='Up') return focus('profile-name');
    const index = actions.indexOf(id), step = direction==='Left' ? -1 : direction==='Right' ? 1 : 0;
    focus(index===0 && step===-1 ? 'profile-avatar' : actions[Math.max(0,Math.min(actions.length-1,index+step))]);
  };
  const pickWorld = (index: number) => { const next = worlds[Math.max(0,Math.min(worlds.length-1,index))]; if(next.style!==preview()) {setPreview(next.style);setPage(0);} };
  const worldFocus = (index:number) => { const next = Math.max(0,Math.min(worlds.length-1,index)); if(next<worldStart()) setWorldStart(next); if(next>=worldStart()+7) setWorldStart(next-6); queueMicrotask(()=>focus(`world-${next}`)); };
  const turnPage = (step:number) => { setPage((page()+step+pageCount)%pageCount); queueMicrotask(()=>focus('avatar-0')); };
  const gridMove = (index:number,direction:string) => {
    const count = Math.min(18,catalog.perCategory-page()*18);
    if(direction==='Up' && index<6) return worldFocus(worlds.findIndex(w=>w.style===preview()));
    if(direction==='Down' && index>=count-6) return focus('avatar-next');
    if(direction==='Left' && index%6===0 || direction==='Right' && index%6===5) return;
    focus(`avatar-${Math.max(0,Math.min(count-1,index+({Left:-1,Right:1,Up:-6,Down:6}[direction]??0)))}`);
  };
  const saveLabel = () => busy() ? 'Saving profile…' : props.profile ? 'Save' : 'Create profile';
  const cancelX = () => 562 + entryButtonWidth(saveLabel()) + 18;
  const deleteX = () => cancelX() + entryButtonWidth('Cancel') + 18;
  return <TvView nodeRef={(node: ElementNode) => { root = node; }} w={1920} h={1080} color={tokens["color.bg"]} onBack={()=>{cancel();return true;}} onKeyPress={(event:KeyboardEvent)=>{if(['Escape','BrowserBack','GoBack'].includes(event.key)||[10009,461].includes(event.keyCode)) cancel(); return true;}}>
    <Show when={mode()!=='avatar'}>
      <TvText x={192} y={120} size={56} font="Bricolage700" letterspacing={-1.12} cssLineBox lineheight={1.2} content={props.profile ? 'Edit profile' : 'Add a profile'} />
      <TvText x={192} y={205} size={26} color={tokens["color.text.secondary"]} content="A space for their favorites, shows, and discoveries." />
      <EntryButton id="profile-avatar" x={192} y={317} w={260} h={260} radius={52} src={avatarSrc(style(),choice())} register={register} onMove={d=>formMove('profile-avatar',d)} onActivate={()=>{returnId='profile-avatar';setPreview(style());setPage(Math.floor((choice()-1)/18)); const i=worlds.findIndex(w=>w.style===style()); setWorldStart(Math.max(0,Math.min(worlds.length-7,i)));setMode('avatar');}} />
      <TvText x={192} y={597} w={260} maxwidth={260} align="center" size={24} font="Onest600" cssLineBox lineheight={1.3} color={tokens["color.text.secondary"]} content="Change avatar" />
      <TvText x={562} y={317} size={18} font="Onest700" letterspacing={18*parseFloat(tokens["type.tv.eyebrow"].letterSpacing)} content="PROFILE NAME" color={tokens["color.text.secondary"]} />
      <EntryButton id="profile-name" x={562} y={355} w={860} h={88} radius={22} size={34} align="left" label={name() || 'Enter profile name'} register={register} onMove={d=>formMove('profile-name',d)} onActivate={()=>{returnId='profile-name';setMode('name');}} />
      <TvText x={562} y={459} size={22} content={missing()&&!name().trim() ? 'Enter a name to continue.' : 'Select to type with your remote or a connected keyboard.'} color={missing()&&!name().trim() ? tokens["color.status.danger-tv"] : tokens["color.text.tertiary"]} />
      <EntryButton id="profile-save" x={562} y={548} w={entryButtonWidth(saveLabel())} label={saveLabel()} register={register} onMove={d=>formMove('profile-save',d)} onActivate={()=>void save()} />
      <EntryButton id="profile-cancel" x={cancelX()} y={548} w={entryButtonWidth("Cancel")} label="Cancel" register={register} onMove={d=>formMove('profile-cancel',d)} onActivate={cancel} />
      <Show when={deletable()}><EntryButton id="profile-delete" x={deleteX()} y={548} w={entryButtonWidth("Delete profile", true)} icon="trash" label="Delete profile" danger register={register} onMove={d=>formMove('profile-delete',d)} onActivate={()=>{returnId='profile-delete';setMode('delete');}} /></Show>
      <TvText x={562} y={652} size={24} color={tokens["color.status.danger-tv"]} maxwidth={860} content={error()} />
    </Show>
    <Show when={mode()==='avatar'}>
      <TvText x={192} y={54} size={56} font="Bricolage700" letterspacing={-1.12} cssLineBox lineheight={1.2} content="Find your favorite" />
      <TvText x={192} y={138} size={24} color={tokens["color.text.secondary"]} content={`${worlds.length*catalog.perCategory} avatars. Pick a world, then pick your character.`} />
      <For each={worlds}>{(world,index)=><TvView show={index()>=worldStart() && index()<worldStart()+7}>
        <EntryButton id={`world-${index()}`} x={192+(index()-worldStart())*225} y={198} w={213} h={56} radius={28} size={22} label={world.name} selected={world.style===preview()} register={register} onFocus={()=>pickWorld(index())} onActivate={()=>focus('avatar-0')} onMove={direction=>{if(direction==='Left')worldFocus(index()-1);else if(direction==='Right')worldFocus(index()+1);else if(direction==='Down')focus('avatar-0');}} />
      </TvView>}</For>
      <For each={Array.from({length:18},(_,i)=>i)}>{i=><TvView show={page()*18+i<catalog.perCategory}>
        <EntryButton id={`avatar-${i}`} x={192+(i%6)*176} y={292+Math.floor(i/6)*176} w={150} h={150} radius={30} src={avatarSrc(preview(),page()*18+i+1)} selected={style()===preview() && choice()===page()*18+i+1} register={register} onMove={d=>gridMove(i,d)} onActivate={()=>{setStyle(preview());setChoice(page()*18+i+1);setMode('form');}} />
      </TvView>}</For>
      <TvText x={192} y={842} size={24} content={`${worlds.find(w=>w.style===preview())?.name} · ${page()+1} / ${pageCount}`} color={tokens["color.text.secondary"]} />
      <For each={['previous','next']}>{(id,index)=><EntryButton id={`avatar-${id}`} x={562+index()*244} y={820} w={220} label={id==='next' ? 'Next →' : '← Previous'} register={register} onActivate={()=>turnPage(id==='next' ? 1 : -1)} onMove={direction=>focus(direction==='Up' ? 'avatar-12' : direction==='Left' ? 'avatar-previous' : 'avatar-next')} />}</For>
    </Show>
    <Show when={mode()==='form' || mode()==='avatar'}><EntryLegend items={mode()==='avatar' ? [{key:'OK',label:'Choose'},{key:'▲ ▼',label:'Worlds / grid'},{key:'BACK',label:'Cancel'}] : [{key:'OK',label:'Select'},{key:'BACK',label:'Cancel'}]} /></Show>
    <Show when={mode()==='name'}><TextEntry title="Profile name" initialValue={name()} maxLength={64} showCount hint="Select to type with your remote or a connected keyboard." onCancel={cancel} onSubmit={async value=>{setName(value);setMissing(false);setMode('form');}} /></Show>
    <Show when={mode()==='pin'}><TextEntry title="Enter parent PIN" secret onCancel={cancel} onSubmit={async pin=>{
      scope?.abort(); const request = props.api.createScope(); scope = request;
      try { await props.api.unlockParent(pin,{signal:request.signal}); } catch(e) {if(request.signal.aborted)return;throw (e as {status?:number}).status===403 ? new Error('Incorrect PIN. Try again.') : e;}
      if(request.signal.aborted||!alive)return; setMode('form'); await save(pending==='delete');
    }} /></Show>
    <Show when={mode()==='delete'}>
      <TvView w={1920} h={1080} color={tokens["color.scrim.tv-panel"]}><TvView x={1100} w={820} h={1080} color={tokens["color.surface.1"]} />
        <TvText x={1164} y={64} size={44} font="Bricolage700" content="Delete profile" />
        <TvText x={1164} y={145} size={26} maxwidth={660} maxlines={5} content={`Delete ${props.profile?.name}? This permanently removes this profile's watch history, favorites and preferences.`} />
        <TvText x={1164} y={340} size={24} maxwidth={660} color={tokens["color.status.danger-tv"]} content={error()} />
        <EntryButton id="delete-cancel" x={1164} y={430} w={660} label="Cancel" register={register} onActivate={cancel} onMove={()=>focus('delete-confirm')} />
        <EntryButton id="delete-confirm" x={1164} y={524} w={660} label={busy() ? 'Deleting…' : 'Delete profile'} danger register={register} onActivate={()=>void save(true)} onMove={()=>focus('delete-cancel')} />
        <EntryLegend items={[{key:'OK',label:'Select'},{key:'BACK',label:'Cancel'}]} />
      </TvView>
    </Show>
  </TvView>;
}
