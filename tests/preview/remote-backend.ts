import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Card,Bootstrap,Preferences} from '../../src/tv-solid/remote/types';
export const referenceRoot=resolve('../design/viptv-design-system/reference');
function isSeriesRequest(path:string,url:URL){return path.includes('/series/')||url.searchParams.get('card')==='series';}
export async function installRemoteBackend(page:Page,origin:string,options:{
    session?: boolean;
    empty?: boolean;
    fail?: boolean;
    delayHome?: boolean;
    addons?: number;
    best?: boolean;
    captionTracks?: boolean;
    channelSearch?: boolean;
    delayLibrary?: boolean;
    emptySources?: boolean;
    expireOnPreference?: boolean;
    failReplacementOnce?: boolean;
    holdNextPage?: boolean;
    liveChannels?: number;
    liveGroups?: number;
    media?: boolean;
    mediaSearch?: boolean;
    misleadingLiveCursor?: boolean;
    navigation?: string[];
    navigationByProfile?: Record<string, string[]>;
    omitNavigation?: boolean;
    pageDelayMillis?: number;
    pairingApproved?: boolean;
    pairingProfile?: boolean;
    playbackActions?: Record<string, unknown>;
    refuseRenewal?: boolean;
    rejectActivationOnce?: boolean;
    rejectLibraryFilterOnce?: boolean;
    replacementPosition?: number;
    seasonPages?: boolean;
    searchChannelCount?: number;
    finding?: boolean;
    slowRelease?: boolean;
    stallRenewal?: boolean;
    rejectAddon?: boolean;
  }={}){
 const requests:{method:string;path:string;body:any}[]=[];
 const art=(name:string)=>`${origin}/fixture/${name}`;
 const card:Card={identity:{kind:'movie',id:'tt-oak-street',ids:[]},provider_id:'stremio',title:'The End of Oak Street',description:'The Platt family bands together to navigate their new surroundings after a cosmic event transports their…',poster:art('a5729872fdf6d97950dabed6371ef4d6.jpg'),landscape:art('a5729872fdf6d97950dabed6371ef4d6.jpg'),logo:art('274e704ffc2eeb3e73918396e294edb0.png'),badges:[],view:{saved:false,metadata_parts:['Movie','2026','Action, Adventure','1h 40m'],hero_metadata_parts:['2026','Action, Adventure','1h 40m'],compact_metadata_parts:['2026','1h 40m'],badges:[{label:'4K',role:'capability'},{label:'HDR',role:'capability'},{label:'5.1',role:'capability'},{label:'PG-13',role:'certification'}],tile_badge:null,progress:null,preview:{background:null,caption:'',progress:null,action:'details' as const}},metadata:{year:2026,runtime_minutes:100,genres:['Action','Adventure'],certification:'PG-13'}};
 const cardTitles=['Monster','One Piece','Obsession','Naruto','Five Nights at Freddy’s','The Last of Us','Arcane','Severance','Andor','The Bear','Shogun','Fallout'];
 const cardImages=['d1f119013660d10c200395924d2e01f1.jpg','22d40e71d7251ce37731f9c92046225e.jpg','3da010bb588e70c5323088b2c66658fe.jpg','4fb620620d8744ec661c36af04563200.jpg','4ecebe14f02c5841c69a2da6d6cb5389.jpg','0009e1ac6db9b5c0570faa7b78ec8292.jpg','0390bbf6dc6f0ecf3112d8cd02b8df71.jpg','07043870a1a3a4de9a3140758d5ac6b8.jpg','138b3e7eec5324db705f886653b91819.jpg','147a5b3e7ac27398c379c7e4c8be8f43.jpg','16264432fcbd259fc7111f7086159713.jpg','1b8e776fadffacda0429eae19567c9d9.jpg'];
 const seriesCard:Card={...card,identity:{kind:'series',id:'fixture-series',ids:[]},title:'Monster',subtitle:'S1 E2 · 38m left',progress:.38,view:{...card.view!,preview:{background:null,caption:'Resume S1 E2',progress:.38,action:'details' as const}}};
 const cards:Card[]=cardImages.map((image,i)=>({...card,identity:{...card.identity,id:`movie-${i}`},title:cardTitles[i],landscape:art(image),poster:art(image),logo:null,badges:i===1?['New episode']:[]}));
 cards[0]=seriesCard as typeof card;
 let profile:string|null='1',library:Card[]=[],revision=0,liveRevision=0;
 // Incremental source discovery: events accumulate, waiters long-poll until a
 // new event arrives or discovery completes.
 const discoveryEvents:{streams:any[]}[]=[];
 let discoveryDone=false;
 const discoveryWaiters:(()=>void)[]=[];
 const notifyDiscovery=()=>{const w=discoveryWaiters.splice(0);for(const fn of w)fn();};
 const management={profiles:[{id:'1',name:'vynxc',avatar_id:'vynxc',locked:false,selection_requires_parent:false,can_delete:false},{id:'2',name:'Zayne',avatar_id:'zayne',locked:false,selection_requires_parent:false,can_delete:true}],avatar_ids:['vynxc','zayne','initial-pink','initial-blue'],capabilities:Object.fromEntries(['create','rename','delete','avatar'].map(key=>[key,{availability:'Available'}])),parent:{pin_configured:true,unlocked:true,restricted:false}};
 const preferences:Preferences={revision:0,controls:[
  {id:"next_episode_button",group:"playback",label:"Next episode button",description:"Shows during the credits. Nothing ever plays on its own.",choices:[{label:"On",value:true},{label:"Off",value:false}]},
  {id:"skip_intros",group:"playback",label:"Skip intros and recaps",description:"Skips them when the show marks where they are",choices:[{label:"On",value:true},{label:"Off",value:false}]},
  {id:"source_selection",group:"playback",label:"Default source",description:"How Play chooses between sources",choices:[{label:"Best match",value:"best"},{label:"Ask every time",value:"ask"}]},
  {id:"max_quality_height",group:"playback",label:"Preferred quality",description:"Best match aims for this, then falls back",choices:[{label:"Auto",value:null},{label:"4K",value:2160},{label:"1080p",value:1080},{label:"720p",value:720},{label:"480p",value:480}]},
  {id:"hdr_preference",group:"playback",label:"HDR and Dolby Vision",choices:[{label:"No preference",value:"any"},{label:"Prefer HDR",value:"prefer"},{label:"Avoid HDR",value:"avoid"}]},
  {id:"match_frame_rate",group:"playback",label:"Match frame rate",description:"Switches the TV to the video’s frame rate for smoother motion",choices:[{label:"On",value:true},{label:"Off",value:false}]},
  {id:"subtitle_mode",group:"playback",label:"Start with subtitles",choices:[{label:"On",value:"always"},{label:"Off",value:"never"}]},
  {id:"preferred_audio_language",group:"subtitles",label:"Audio language",choices:[{label:"Original / system default",value:null},{label:"English",value:"en"}]},
  {id:"preferred_subtitle_language",group:"subtitles",label:"Subtitle language",choices:[{label:"Original / system default",value:null},{label:"English",value:"en"}]},
  {id:"subtitle_font_scale",group:"subtitles",label:"Subtitle size",choices:[{label:"Small",value:0.8},{label:"Medium",value:1},{label:"Large",value:1.25}]},
  {id:"subtitle_background_color",group:"subtitles",label:"Subtitle background",choices:[{label:"None",value:"#00000000"},{label:"Dark",value:"#000000CC"},{label:"Black",value:"#000000"}]},
  {id:"subtitle_text_color",group:"subtitles",label:"Subtitle colour",choices:[{label:"White",value:"#FFFFFF"},{label:"Yellow",value:"#F5C542"}]},
  {id:"accent_color",group:"display",label:"Accent colour",description:"Progress bars, marks and toggles",kind:"swatches",choices:[{label:"Amber",value:"#F5C542"},{label:"Coral",value:"#FF8B5C"},{label:"Mint",value:"#62D9BC"},{label:"Sky",value:"#A3BCFF"}]},
  {id:"show_ratings",group:"display",label:"Show ratings on cards",description:"★ 7.8 under focused titles",choices:[{label:"On",value:true},{label:"Off",value:false}]},
  {id:"text_size",group:"display",label:"Text size",choices:[{label:"Small",value:"small"},{label:"Default",value:"default"},{label:"Large",value:"large"}]},
  {id:"reduce_motion",group:"display",label:"Reduce motion",description:"Slides become cuts. Follows the TV’s setting unless you change it",choices:[{label:"Follow TV",value:"follow"},{label:"On",value:"on"},{label:"Off",value:"off"}]},
  {id:"screen_saver_minutes",group:"display",label:"Screen saver",description:"Dims to slow-moving art when nothing is playing",choices:[{label:"Off",value:0},{label:"After 2 minutes",value:2},{label:"After 5 minutes",value:5},{label:"After 10 minutes",value:10}]},
  {id:"screen_inset",group:"display",label:"Fit to screen",description:"Use if the edges of the picture are cut off",kind:"calibration",min:0,max:20,step:1}
 ],preferences:{source_selection:'ask',max_quality_height:null,preferred_audio_language:null,preferred_subtitle_language:null,subtitle_mode:'never',subtitles_enabled:false,subtitle_font_scale:1,subtitle_text_color:'#ffffff',subtitle_background_color:'#000000',hdr_preference:'any',next_episode_button:true,skip_intros:false,match_frame_rate:true},display:{accent_color:'#F5C542',show_ratings:true,text_size:'default',reduce_motion:'follow',screen_saver_minutes:5,screen_inset:0}};
 const home={hero:card,featured:[card,...cards.slice(0,4)],rows:[{id:'continue',title:'Continue Watching',state:'Ready' as const,cards:options.empty?[]:cards},{id:'popular',title:'Popular movies',state:'Ready' as const,cards}],complete:true,revision:0};
  let navigationIds = options.navigation ?? ["search", "home", "movie", "series", "live", "library", "profiles"];
  const navigationLabels: Record<string, string> = { search:"Search", home:"Home", movie:"Movies", series:"Series", live:"Live", library:"My List", profiles:"Profile" };
 const bootstrap=():Bootstrap=>({contract_version:3,navigation: options.omitNavigation ? undefined : (options.navigationByProfile?.[profile ?? ""] ?? navigationIds).map(id => ({id,label:navigationLabels[id] ?? id,...(id === "search" ? {media_search:options.mediaSearch !== false,channel_search:options.channelSearch === true} : {})})),identity:{profile_id:profile},profile_management:management,home,preferences,library:{cards:library,complete:true},integrations:[],revisions:{library:revision}});
 await page.addInitScript(({origin,session})=>{if(session)localStorage.setItem(`viptv-device:${origin}`,JSON.stringify({accessToken:'fixture-access',refreshToken:'fixture-refresh'}));},{origin,session:options.session!==false});
  const addonStates = new Map<string, boolean>();
  for (let i = 1; i <= (options.addons ?? 0); i++) addonStates.set(`addon:${i}`, true);
  const libraryQueries: Record<string, string>[] = [];
  let rejectedLibraryFilter = false;
  let releasePages!: () => void;
  const pageGate = new Promise<void>(resolve=>{releasePages=resolve;});
 await page.route('**/fixture/*',async route=>{const file=new URL(route.request().url()).pathname.split('/').pop()!;if(!/^[a-f0-9]+\.(png|jpg|webp)$/.test(file))return route.abort();await route.fulfill({body:readFileSync(resolve(referenceRoot,'assets',file)),contentType:file.endsWith('png')?'image/png':'image/jpeg'});});
  let activationRejected = false;
  const catalogCards:Card[]=cardImages.map((image,i)=>({...card,identity:{...card.identity,id:`catalog-${i}`},title:`Catalog ${i}`,landscape:art(image),poster:art(image),logo:null,badges:[]}));
 let catalogView = catalogCards;
  let sourceEpisode = false, leaseEpisode = false, leaseLive = false, leaseCount = 0, leasePosition = 0;
  let replacementFailed = false;
 await page.route('**/media/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop()!;
  const file=name==='index.m3u8'?'index.m3u8':/^segment\d+\.ts$/.test(name)?name.replace(/\.ts$/,'.bin'):null;
  if(!file)return route.abort();
  await route.fulfill({body:readFileSync(resolve('tests/fixtures/hls',file)),contentType:file==='index.m3u8'?'application/vnd.apple.mpegurl':'video/mp2t'});
 });
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;const body=request.postDataJSON();requests.push({method:request.method(),path,body});
  const send=(value:unknown,status=200)=>route.fulfill({status,json:value});
  if(options.fail)return send({error:'unavailable'},503);
  if(path==='/api/bootstrap')return send(bootstrap());
  if(path==='/api/auth/profile'){profile=String(body.profile_id);return send({});}
  if(path==='/api/auth/logout')return send({});
  if(path==='/api/auth/device/code')return send({device_code:'fixture-code',user_code:'ABCD-EFGH',verification_uri:`${origin}/device`,verification_uri_complete:`${origin}/device?code=ABCD-EFGH`,expires_in:300,interval:1});
  if(path==='/api/auth/device/token'){
      if(!options.pairingApproved)return send({error:'authorization_pending'},400);
      profile=options.pairingProfile===false?null:'1';
      return send({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:1800,account_id:1,session_id:'fixture-session',profile_id:profile});
    }
  if(path==='/api/profiles')return send(management);
  if(path.endsWith('/revisions'))return send({library:revision});
  if(path.endsWith('/home'))return send(home);
  if (path === "/api/auth/device/refresh" && options.expireOnPreference) return send({error:"unauthorized"},401);
  if(path.endsWith('/preferences')){if(request.method()==='PUT'){if(options.expireOnPreference)return send({error:"unauthorized"},401);preferences.revision++;if(body.preferences)preferences.preferences=body.preferences;if(body.display)preferences.display=body.display;}return send(preferences);}
  if(path.endsWith('/library')){
      if (request.method() === "PUT") { library.push(body.card); revision++; return send({ saved: true }); }
      libraryQueries.push(Object.fromEntries(url.searchParams));
      if (options.rejectLibraryFilterOnce && url.searchParams.get("sort") === "name_asc" && !rejectedLibraryFilter) {
        rejectedLibraryFilter = true;
        return send({ error: "Library unavailable" }, 503);
      }
      const defaults = { source: "favorites", sort: "date_added", type: "all", show: "all", offset: 0, limit: 100, genre: null, status: null, rated: null, added: null, episodes_left_max: null };
      const values = { ...defaults, ...Object.fromEntries(url.searchParams) };
      return send({ cards: library, complete: true, query: values, default_query: defaults,
        controls: [
          { id: "type", label: "Type", kind: "SingleChoice", required: false, choices: [{ value: "all", label: "All" }, { value: "movie", label: "Movies" }, { value: "series", label: "Series" }] },
          { id: "sort", label: "Sort by", kind: "SingleChoice", required: false, choices: [{ value: "last_watched", label: "Last watched" }, { value: "date_added", label: "Date added" }, { value: "name_asc", label: "Name A–Z" }] },
          { id: "show", label: "Show", kind: "SingleChoice", required: false, choices: [{ value: "all", label: "All titles" }, { value: "not_watched", label: "Not watched" }] },
        ],
      });
    }
  if(path==='/api/discovery-controls')return send({catalogs:[{id:'popular',name:'Popular',type:url.searchParams.get('type'),controls:[{id:'genre',label:'Genres',kind:'SingleChoice',choices:[{value:'action',label:'Action'}],required:false}]}],controls:[],discovery:{availability:'Available'},search:{availability:'Available'}});
  if(path==='/api/discover')return send({cards:options.empty?[]:catalogView,complete:true});
  if(path.startsWith('/api/meta/')){
      if(options.seasonPages && isSeriesRequest(path, url)){
        const offset=Number(url.searchParams.get('offset')??0);
        const seasons=[{season:1,episode_count:2,offset:0},{season:2,episode_count:2,offset:2}];
        const seasonNum=offset===0?1:2;
        const episodes:Card[]=[0,1].map(e=>({...seriesCard,identity:{kind:'series',id:`episode-s${seasonNum}e${e+1}`,ids:[],episode:{order:`s${seasonNum}e${e+1}`,season:seasonNum,episode:e+1}},title:`Episode ${e+1}`,subtitle:`S${seasonNum} E${e+1}`,parent_identity:seriesCard.identity}));
        return send({item:seriesCard,episodes,recommendations:cards,seasons,next_cursor:null});
      }
      return send({item:card,episodes:[],recommendations:cards,seasons:[],next_cursor:null});
    }
  if(path.endsWith('/viewing-action')){
      const played=body.card;
      const resolved=played.identity.kind==='series'?{...played,identity:{kind:'series',id:'episode-1',ids:[],episode:{order:'s1e1',season:1,episode:1}},subtitle:'S1 E1',parent_identity:played.identity}:played;
      return send({card:resolved,label:played.progress?'Resume':'Play',resume:!!played.progress,source_selection:'ask'});
    }
  if(path==='/api/streams'){sourceEpisode=body.type==="series";return send({id:'job-1'});}
    if(/\/live\/[^/]+\/sources$/.test(path))return send({streams:[{id:"live-stream-0",name:"Live source A"},{id:"live-stream-1",name:"Live source B"}],live:true,action:{card:{identity:{kind:"live",id:path.split('/').at(-2)!,ids:[]},provider_id:"m3u:1",title:"Server live channel",badges:[],poster:null,landscape:null,logo:null},label:"Watch live",resume:false,source_selection:options.best?"best":"ask"}});
  const streams=Array.from({length:8},(_,i)=>({id:`stream-${i}`,name:i%2?'[Provider 2]':'LordStreams',detail:'WEB-DL · HEVC · 5.1 · 18.4 GB',quality_height:i<2?2160:i<5?1080:720}));
  if(path==='/api/streams/job-1'){
      const after=Number(url.searchParams.get('after')??0);
      if(options.finding&&!discoveryEvents.length)discoveryEvents.push({streams});
      if(!options.finding)return send({events:discoveryEvents.length?discoveryEvents.slice(after):[{streams}],done:true});
      // finding: long-poll until new events arrive or discovery completes
      const deadline=Date.now()+9000;
      for(;;){
        if(discoveryEvents.length>after||discoveryDone)return send({events:discoveryEvents.slice(after),done:discoveryDone});
        if(Date.now()>deadline)return send({events:[],done:discoveryDone});
        await new Promise<void>(resolve=>{discoveryWaiters.push(resolve);setTimeout(resolve,300);});
      }
    }
  if(path.endsWith("/source-ranking") && body.ids?.some((id: string) => id.startsWith("live-stream-")))
      return send({streams:[{id:"live-stream-0",name:"Live source A"},{id:"live-stream-1",name:"Live source B"}],best_match_id:"live-stream-1",quality_filters:[],total:2});
  if(path.endsWith('/source-ranking')){
      const heightFilter=typeof body.quality_height==='number'?body.quality_height:null;
      const wanted:string[]=Array.isArray(body.ids)?body.ids:[];
      const allSources:any[]=[...streams,...discoveryEvents.flatMap(e=>e.streams)];
      const pool:any[]=wanted.length?wanted.map(id=>allSources.find(s=>s.id===id)).filter(Boolean):streams;
      const matching=(heightFilter==null?pool:pool.filter(s=>s.quality_height===heightFilter)).slice().sort((a,b)=>((b.best?1:0)-(a.best?1:0))||((b.quality_height??0)-(a.quality_height??0)));
      const counts=new Map<number,number>();
      for(const s of pool)counts.set(s.quality_height,(counts.get(s.quality_height)??0)+1);
      const quality_filters=[...counts.entries()].sort((a,b)=>b[0]-a[0]).map(([height,count])=>({height,label:height>=2160?'4K':`${height}p`,count}));
      return send({streams:matching,best_match_id:matching[0]?.id??null,quality_filters,total:matching.length});
    }
  if(path.endsWith('/live/channels')){
      const searching = url.searchParams.has("search");
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Number(url.searchParams.get("limit") ?? 40),
        pageSize = Number(url.searchParams.get("page_size") ?? limit);
      if (offset > 0 && options.pageDelayMillis) await new Promise(resolve=>setTimeout(resolve,options.pageDelayMillis));
      if (offset > 0 && options.holdNextPage) await pageGate;
      const all = Array.from({length: searching ? options.searchChannelCount ?? 3 : options.liveChannels ?? cards.length}, (_,i) => ({id:`channel-${i}`,connection_id:"m3u:1",card:{...cards[i % cards.length],identity:{kind:"live",id:`channel-${i}`,ids:[]},provider_id:"m3u:1",title:(liveRevision>0?`Updated channel ${i}`:(searching?`Fixture channel ${i}`:cards[i % cards.length].title)),...(liveRevision>0||searching ? {landscape:null,poster:null,logo:null} : {})}}));
      return send({
        channels: all.slice(offset, offset + limit),
        snapshot_id: `fixture-live-${liveRevision}-${profile}-${url.searchParams.get("group_id") ?? "all"}-${url.searchParams.get("search") ?? ""}`,
        paging: {
          origin:String(offset),limit,page_size:pageSize,
          previous: offset > 0 && all.length ? {cursor:String(Math.max(0,offset-pageSize)),limit:Math.min(offset,pageSize),page_size:pageSize} : null,
          next: offset+limit < all.length ? {cursor:String(offset+limit),limit:pageSize,page_size:pageSize} : null,
        },
        groups: Array.from({length: options.liveGroups ?? 0}, (_, i) => ({id:`group-${i + 1}`,label:`Group ${i + 1}`})),
        complete: offset+limit >= all.length,
        next_cursor: options.misleadingLiveCursor ? "4294967295" : offset + limit < all.length ? String(offset+limit) : null,
        availability: "Available",
      });
    }
  if (path === "/api/playback" && options.media) {
      if (body.replace_source && options.failReplacementOnce && !replacementFailed) {
        replacementFailed = true;
        return send({error_code:"gateway_capacity",error:"Playback capacity is currently full."},503);
      }
      leaseCount++;
      leaseLive = body.stream_id.startsWith("live-stream-");
      leaseEpisode = !leaseLive && sourceEpisode;
      leasePosition = leaseLive ? 0 : body.replace_source ? (options.replacementPosition ?? body.replace_source.observed_position) : (body.position ?? 0);
      const leaseId = leaseCount <= 1 ? "fixture-playback" : `fixture-playback-${leaseCount}`;
      return send({
        id: leaseId,
        status: "ready",
        actions: {pause:!leaseLive,seek:!leaseLive,restart:!leaseLive,change_source:true,episodes:leaseEpisode,next_episode:leaseEpisode,tracks:options.captionTracks ?? false,subtitle_style:options.captionTracks ?? false,report_progress:!leaseLive,...options.playbackActions},
        // A stalled-renewal lease expires quickly so the test watches the
        // expiry timer fire without waiting; a healthy lease stays valid.
        expires_at: Math.floor(Date.now()/1000) + (options.stallRenewal ? 3 : 3600),
        renew_after_seconds: 1,
        delivery: {
          kind: "gateway",
          url: `${origin}/media/${leaseId}/index.m3u8`,
          format: "hls",
          position: leasePosition,
          timeline_offset_seconds: 0,
          duration: 5,
          live: leaseLive,
          ...(options.captionTracks ? {subtitles_supported:true,subtitle_tracks:[{input_index:2,title:"English",language:"en",selected:true,selectable:true,supported:true}],subtitle_appearance:{font_scale:1,text_color:"#FFFFFF",background_color:"#00000000"}} : {}),
        },
      });
    }
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/heartbeat$/.test(path)){
      if(options.stallRenewal)return; // a stalled heartbeat never resolves
      return options.refuseRenewal ? send({error:"unauthorized"},401) : send({status:"ready",expires_at:Math.floor(Date.now()/1000)+3600,renew_after_seconds:1});
    }
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/first-frame$/.test(path))
      return send({status:"ok"});
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/(progress|stop)$/.test(path))
      return send({status:"ok"});
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?$/.test(path)) {
      if (request.method()==='DELETE') return send({status:"released"});
      return send({id:path.split('/').pop(),status:"ready"});
    }
  if(path.endsWith('/guide'))return send({programs:[{id:'program',title:'Now playing',start_millis:0,end_millis:9999999999999}]});
  if (path.endsWith("/addon-activation")) {
      if (request.method() === "PUT") {
        if (options.rejectActivationOnce && !activationRejected) {
          activationRejected = true;
          return send({error:"Profile configuration changed. Try again."},409);
        }
        if (typeof body.connection_id === "string") addonStates.set(body.connection_id, body.enabled === true);
        return send({configuration:{}});
      }
      return send({addons:[...addonStates.entries()].map(([connection_id,enabled])=>({connection_id,enabled}))});
    }
  if(path==='/api/addons')return send({items:Array.from({length:options.addons??0},(_,i)=>({id:i+1,name:`Add-on ${i+1}`,enabled:true})),next_cursor:null});
  if(path.endsWith('/source-integrations'))return send({revision:0,schemas:[],connections:[]});
  if(path==='/api/parent/status')return send({pin_configured:true,unlocked:true});
  return send({error:`Unhandled fixture ${request.method()} ${path}`},404);
 });
 return {
  requests,
  addonEnabled: (id: string) => addonStates.get(id),
  card,
  cards,
  bootstrap,
  reviseCatalog: (indices: number[]) => { catalogView = indices.map(index => catalogCards[index]); revision++; },
  reviseLive: () => { liveRevision++; revision++; },
  completeDiscovery: () => { discoveryDone=true; notifyDiscovery(); },
  addBestSource: () => { discoveryEvents.push({streams:[{id:'stream-best',name:'LordStreams',detail:'WEB-DL · AV1 · 5.1 · 9.2 GB',quality_height:2160,best:true}]}); notifyDiscovery(); },
  setNavigation: (ids: string[]) => { navigationIds = ids; revision++; },
  setProfile: (id: string | null) => { profile = id; revision++; },
  libraryQueries,
  releasePages,
};
}
