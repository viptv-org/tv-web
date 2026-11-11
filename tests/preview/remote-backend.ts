import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Card,Bootstrap,Preferences} from '../../src/tv-solid/remote/types';
export const referenceRoot=resolve('../design/viptv-design-system/reference');
function isSeriesRequest(path:string,url:URL){return path.includes('/series/')||url.searchParams.get('card')==='series';}
/**
 * Renderer 1.x exposed the live scene to the browser specs (isRenderable,
 * props, shaderKey, shader.uniforms). 2.0 exposes different node
 * handles and keeps no shader name, so this init script presents the 1.x
 * read-only view over the 2.0 scene. Test-only: the app bundle is untouched,
 * and every value is read from the live scene when the spec asks for it.
 */
async function installRendererCompat(page: Page): Promise<void> {

  await page.addInitScript(() => {
    const state: { raw?: any } = {};
    // Uniform name -> shader prop name, for the app shader types the specs
    // read. Everything else is absent, as a 1.x uniform the program lacks.
    const uniformProps: Record<string, string> = {
      u_startedAt: "startedAt",
      u_animate: "animate",
      u_zoom: "zoom",
      u_row: "row",
      u_progress: "progress",
      u_top: "top",
      u_radius: "radius",
    };

    const uniforms = (shader: any) => {
      const single: Record<string, { value: unknown }> = {};
      const props = shader?.props;
      if (props) {
        for (const uniform of Object.keys(uniformProps)) {
          const prop = uniformProps[uniform]!;
          if (prop in props) single[uniform] = { value: props[prop] };
        }
      }
      return { single };
    };

    // A node showing `src` builds its texture internally in 2.0, so the handle
    // and its upload state are not exposed. The app sets `src` only after the
    // image decoded (createBillboardArt, imageTexture, ...), which is the
    // readiness point the 1.x specs waited for.
    const srcTexture = (node: any) =>
      node.src ? { state: 'loaded', props: { src: node.src } } : null;

    const compatNode = (node: any, inheritedAlpha: number, renderer: any, parent: any = null): any => {
      const ownAlpha = typeof node.alpha === "number" ? node.alpha : 1;
      const worldAlpha = ownAlpha * inheritedAlpha;
      const shader = node.shader ?? null;
      const props: Record<string, unknown> = {
        w: node.width,
        h: node.height,
        x: node.x,
        y: node.y,
        color: node.color,
      };
      if (node.text !== undefined) {
        props.text = node.text;
        props.fontSize = node.fontSize;
        props.maxWidth = node.maxWidth;
        props.maxLines = node.maxLines;
        props.letterSpacing = node.letterSpacing;
        props.lineHeight = node.lineHeight;
      }
      const texture = node.texture
        ? { state: node.texture.state, props: node.texture.props }
        : srcTexture(node);
      if (texture) props.src = texture.props?.src;
      const compat: any = {
        id: node.id,
        isRenderable:
          worldAlpha > 0 &&
          (shader !== null || node.texture !== undefined || node.text !== undefined) &&
          node.width > 0 &&
          node.height > 0,
        props,
        absX: node.absX,
        absY: node.absY,
        width: node.width,
        height: node.height,
        parent,
        worldAlpha,
        viptvText: node.viptvText,
        // 1.x node time: the renderer clock the shader's u_time advances on.
        time: renderer?.elapsedTime ?? 0,
        shader: shader
          ? {
              shaderKey: (window as any).__viptvShaderName?.(shader),
              uniforms: uniforms(shader),
            }
          : null,
        texture,
        children: [],
      };
      compat.children = (node.children ?? []).map((child: any) =>
        compatNode(child, worldAlpha, renderer, compat),
      );
      // Specs mutate alpha on the node they find (the rounded-opacity case);
      // forward it to the live node so the renderer actually re-renders.
      Object.defineProperty(compat, "alpha", {
        enumerable: true,
        get: () => node.alpha,
        set: (value: number) => {
          node.alpha = value;
        },
      });
      return compat;
    };

    const compatStage = (renderer: any) => ({
      get root() {
        return compatNode(renderer.root, 1, renderer);
      },
      // 1.x's stage start: the renderer clock counts from it.
      get startTime() {
        return (window as any).__viptvRendererStart?.() ?? 0;
      },
      get renderer() {
        return { getQuadCount: () => renderer.scene?.quads ?? 0 };
      },
      registerShaderType: (name: string, type: any) =>
        renderer.registerShaderType(name, type),
      requestRender: () => renderer.requestRender(),
    });

    const compatRenderer = (renderer: any) => renderer.getCapabilities?.().renderMode === "canvas" ? renderer : ({
      get stage() {
        return compatStage(renderer);
      },
      on: renderer.on?.bind(renderer),
      once: renderer.once?.bind(renderer),
      registerShaderType: renderer.registerShaderType?.bind(renderer),
      requestRender: renderer.requestRender?.bind(renderer),
    });

    Object.defineProperty(window, "__viptvRenderer", {
      configurable: true,
      get() {
        return state.raw === undefined ? undefined : compatRenderer(state.raw);
      },
      set(value: unknown) {
        state.raw = value;
      },
    });
  });
}

export async function installRemoteBackend(page:Page,origin:string,options:{
    episodeFlow?: boolean;
    sourceAudioLanguages?: string[];
    selectedAudioLanguage?: string;
    pendingContinuation?: boolean;
    reuseMatch?: boolean;
    reusePreferred?: boolean;
    preferredDiscovery?: boolean;
    preferredLowQuality?: boolean;
    session?: boolean;
    empty?: boolean;
    fail?: boolean;
    delayHome?: boolean;
    addons?: number;
    best?: boolean;
    captionTracks?: boolean;
    captionMedia?: boolean;
    channelSearch?: boolean;
    delayLibrary?: boolean;
    emptySources?: boolean;
    expireOnPreference?: boolean;
    failReplacementOnce?: boolean;
    holdNextPage?: boolean;
    holdPreference?: boolean;
    liveChannels?: number;
    livePageLength?: number;
    liveAvailability?: "Available" | "NeedsConfiguration";
    liveGroups?: number;
    liveEmptyGroups?: string[];
    liveGuideWindows?: boolean;
    liveGuideFailures?: string[];
    holdGuides?: string[];
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
 await installRendererCompat(page);
 const requests:{method:string;path:string;body:any}[]=[];
 const art=(name:string)=>`${origin}/fixture/${name}`;
 const card:Card={identity:{kind:'movie',id:'tt-oak-street',ids:[]},provider_id:'stremio',title:'The End of Oak Street',description:'The Platt family bands together to navigate their new surroundings after a cosmic event transports their…',poster:art('a5729872fdf6d97950dabed6371ef4d6.jpg'),landscape:art('a5729872fdf6d97950dabed6371ef4d6.jpg'),logo:art('274e704ffc2eeb3e73918396e294edb0.png'),badges:[],view:{saved:false,metadata_parts:['Movie','2026','Action, Adventure','1h 40m'],hero_metadata_parts:['2026','Action, Adventure','1h 40m'],compact_metadata_parts:['2026','1h 40m'],badges:[{label:'4K',role:'capability'},{label:'HDR',role:'capability'},{label:'5.1',role:'capability'},{label:'PG-13',role:'certification'}],tile_badge:null,progress:null,preview:{background:null,caption:'',progress:null,action:'play' as const}},metadata:{year:2026,runtime_minutes:100,genres:['Action','Adventure'],certification:'PG-13'}};
 const cardTitles=['Monster','One Piece','Obsession','Naruto','Five Nights at Freddy’s','The Last of Us','Arcane','Severance','Andor','The Bear','Shogun','Fallout'];
 const cardImages=['d1f119013660d10c200395924d2e01f1.jpg','22d40e71d7251ce37731f9c92046225e.jpg','3da010bb588e70c5323088b2c66658fe.jpg','4fb620620d8744ec661c36af04563200.jpg','4ecebe14f02c5841c69a2da6d6cb5389.jpg','0009e1ac6db9b5c0570faa7b78ec8292.jpg','0390bbf6dc6f0ecf3112d8cd02b8df71.jpg','07043870a1a3a4de9a3140758d5ac6b8.jpg','138b3e7eec5324db705f886653b91819.jpg','147a5b3e7ac27398c379c7e4c8be8f43.jpg','16264432fcbd259fc7111f7086159713.jpg','1b8e776fadffacda0429eae19567c9d9.jpg'];
 const seriesCard:Card={...card,identity:{kind:'series',id:'fixture-series',ids:[]},title:'Monster',subtitle:'S1 E2 · 38m left',progress:.38,view:{...card.view!,preview:{background:null,caption:'Resume S1 E2',progress:.38,action:'details' as const}}};
 const cards:Card[]=cardImages.map((image,i)=>({...card,identity:{...card.identity,id:`movie-${i}`},title:cardTitles[i],landscape:art(image),poster:art(image),logo:null,badges:i===1?['New episode']:[],view:{...card.view!,preview:{...card.view!.preview!,action:'details' as const}}}));
 cards[0]=seriesCard as typeof card;
 let profile:string|null='1',library:Card[]=[],revision=0,liveRevision=0,configurationRevision=0,failedAdmissions=0,pendingContinuation=options.pendingContinuation ?? false;
 let liveChannelCount=options.liveChannels,liveAvailability=options.liveAvailability??'Available';
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
 if (options.episodeFlow) { preferences.preferences.skip_intros = true; preferences.preferences.remembered_source_reuse = true; }
 const home={hero:options.episodeFlow ? {...seriesCard,progress:0,subtitle:"S1 E1",view:{...seriesCard.view!,preview:{...seriesCard.view!.preview!,action:"play" as const}}} : card,featured:[options.episodeFlow ? {...seriesCard,progress:0} : card,...cards.slice(0,4)],rows:[{id:'continue',title:'Continue Watching',state:'Ready' as const,cards:options.empty?[]:cards},{id:'popular',title:'Popular movies',state:'Ready' as const,cards}],complete:true,revision:0};
  let navigationIds = options.navigation ?? ["search", "home", "movie", "series", "live", "library", "profiles"];
  const navigationLabels: Record<string, string> = { search:"Search", home:"Home", movie:"Movies", series:"Series", live:"Live", library:"My List", profiles:"Profile" };
 const bootstrap=():Bootstrap=>({contract_version:3,...(options.preferredDiscovery ? {preferred_source_discovery_supported:true} : {}),navigation: options.omitNavigation ? undefined : (options.navigationByProfile?.[profile ?? ""] ?? navigationIds).map(id => ({id,label:navigationLabels[id] ?? id,...(id === "search" ? {media_search:options.mediaSearch !== false,channel_search:options.channelSearch === true} : {})})),identity:{profile_id:profile},profile_management:management,home,preferences,library:{cards:library,complete:true},integrations:[],revisions:{library:revision,...(options.episodeFlow ? {configuration:configurationRevision} : {})}});
 await page.addInitScript(({origin,session})=>{if(session)localStorage.setItem(`viptv-device:${origin}`,JSON.stringify({accessToken:'fixture-access',refreshToken:'fixture-refresh'}));},{origin,session:options.session!==false});
  const addonStates = new Map<string, boolean>();
  for (let i = 1; i <= (options.addons ?? 0); i++) addonStates.set(`addon:${i}`, true);
  const libraryQueries: Record<string, string>[] = [];
  let rejectedLibraryFilter = false;
  let releasePages!: () => void;
  const pageGate = new Promise<void>(resolve=>{releasePages=resolve;});
  let releasePreference!: () => void;
  const preferenceGate = new Promise<void>(resolve=>{releasePreference=resolve;});
  let releaseGuides!: () => void;
  const guideGate = new Promise<void>(resolve=>{releaseGuides=resolve;});
 await page.route('**/fixture/*',async route=>{const file=new URL(route.request().url()).pathname.split('/').pop()!;if(!/^[a-f0-9]+\.(png|jpg|webp)$/.test(file))return route.abort();await route.fulfill({body:readFileSync(resolve(referenceRoot,'assets',file)),contentType:file.endsWith('png')?'image/png':'image/jpeg'});});
  let activationRejected = false;
  const catalogCards:Card[]=cardImages.map((image,i)=>({...card,identity:{...card.identity,id:`catalog-${i}`},title:`Catalog ${i}`,landscape:art(image),poster:art(image),logo:null,badges:[]}));
 let catalogView = catalogCards;
  let discoveryPhase: "preferred"|"fallback" = "fallback", excludedSupplier: string|undefined, preferredSupplier: string|undefined;
  let sourceEpisode = false, leaseEpisode = false, leaseLive = false, leaseCount = 0, leasePosition = 0;
  let admissionGate: Promise<void> | undefined;
  const leases = new Map<string, any>();
  const liveFavoriteIds = new Set<string>();
  let replacementFailed = false;
 await page.route('**/media/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop()!;
  if (options.captionMedia) {
   if (name === 'index.m3u8') return route.fulfill({ contentType:'application/vnd.apple.mpegurl', body:'#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=NO,AUTOSELECT=NO,URI="captions.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=180000,CODECS="avc1.640029,mp4a.40.2",SUBTITLES="subs"\nvideo.m3u8\n' });
   if (name === 'captions.m3u8') return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\ncaptions.vtt\n#EXT-X-ENDLIST\n'});
   if (name === 'captions.vtt') return route.fulfill({contentType:'text/vtt',body:'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nCaption pipeline check\n'});
   if (name === 'video.m3u8') return route.fulfill({contentType:'application/vnd.apple.mpegurl',body:readFileSync(resolve('tests/fixtures/hls/index.m3u8'))});
  }
  const file=name==='index.m3u8'?'index.m3u8':/^segment\d+\.ts$/.test(name)?name.replace(/\.ts$/,'.bin'):null;
  if(!file)return route.abort();
  await route.fulfill({body:readFileSync(resolve('tests/fixtures/hls',file)),contentType:file==='index.m3u8'?'application/vnd.apple.mpegurl':'video/mp2t'});
 });
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  let body:any=null,invalidLogoutJson=false;
  if(path==='/api/auth/logout'){
   try{body=JSON.parse(request.postData()??'');}catch{invalidLogoutJson=true;}
  }else body=request.postDataJSON();
  requests.push({method:request.method(),path,body});
  const send=(value:unknown,status=200)=>route.fulfill({status,json:value});
  if(options.fail)return send({error:'unavailable'},503);
  if(path==='/api/bootstrap')return send(bootstrap());
  if(path==='/api/auth/profile'){profile=String(body.profile_id);return send({});}
  if(path==='/api/auth/logout'){
   if(request.headers()['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')return send({error:'json_required'},415);
   if(invalidLogoutJson)return send({error:'invalid_json'},400);
   return send({ok:true});
  }
  if(path==='/api/auth/device/code')return send({device_code:'fixture-code',user_code:'ABCD-EFGH',verification_uri:`${origin}/device`,verification_uri_complete:`${origin}/device?code=ABCD-EFGH`,expires_in:300,interval:1});
  if(path==='/api/auth/device/token'){
      if(!options.pairingApproved)return send({error:'authorization_pending'},400);
      profile=options.pairingProfile===false?null:'1';
      return send({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:1800,account_id:1,session_id:'fixture-session',profile_id:profile});
    }
  if(path==='/api/profiles')return send(management);
  if(path.endsWith('/revisions'))return send({library:revision,...(options.episodeFlow ? {configuration:configurationRevision} : {})});
  if(path.endsWith('/home'))return send(home);
  if (path === "/api/auth/device/refresh" && options.expireOnPreference) return send({error:"unauthorized"},401);
  if(path.endsWith('/preferences')){if(request.method()==='PUT'){if(options.expireOnPreference)return send({error:"unauthorized"},401);if(options.holdPreference)await preferenceGate;preferences.revision++;if(body.preferences)preferences.preferences=body.preferences;if(body.display)preferences.display=body.display;}return send(preferences);}
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
  if(path.endsWith('/continue/next') && options.episodeFlow){
      if(pendingContinuation)return send({status:'Pending'});
      const episode=body.identity.episode?.episode ?? 1;
      return send(episode>=3 ? {status:'CaughtUp'} : {status:'Next',item:{...seriesCard,progress:0,identity:{kind:'series',id:`episode-${episode+1}`,ids:[],episode:{order:'aired',season:1,episode:episode+1}},parent_identity:seriesCard.identity,title:`Episode ${episode+1}`,subtitle:`S1 E${episode+1}`}});
  }
  if(path.endsWith('/viewing-action')){
      const played=options.episodeFlow ? {...seriesCard,...body.card,title:body.card.identity.episode ? `Episode ${body.card.identity.episode.episode}` : seriesCard.title} : body.card;
      const resolved=played.identity.kind==='series' && !played.identity.episode?{...played,identity:{kind:'series',id:'episode-1',ids:[],episode:{order:'s1e1',season:1,episode:1}},subtitle:'S1 E1',parent_identity:played.identity}:played;
      return send({card:resolved,label:played.progress?'Resume':'Play',resume:!!played.progress,source_selection:'ask'});
    }
  if(path==='/api/streams'){
    sourceEpisode=body.type==="series";
    const memory=body.remembered_source??body.cross_title_source;
    discoveryPhase=options.preferredDiscovery&&memory&&!body.exclude_preferred_source?'preferred':'fallback';
    const supplier=memory?.source_id??(memory?.provider_name==='Supplier B'?'supplier-b':'supplier-a');
    preferredSupplier=discoveryPhase==='preferred'?supplier:undefined;
    excludedSupplier=options.preferredDiscovery&&body.exclude_preferred_source?supplier:undefined;
    return send({id:'job-1'});
  }
    if(/\/live\/[^/]+\/sources$/.test(path))return send({streams:[{id:"live-stream-0",name:"Live source A"},{id:"live-stream-1",name:"Live source B"}],live:true,action:{card:{identity:{kind:"live",id:path.split('/').at(-2)!,ids:[]},provider_id:"m3u:1",title:"Server live channel",badges:[],poster:null,landscape:null,logo:null},label:"Watch live",resume:false,source_selection:options.best?"best":"ask"}});
  const streams=Array.from({length:8},(_,i)=>{const h=i<2?2160:i<5?1080:720;const name=i%2?'[Provider 2]':'LordStreams';const quality=h>=2160?'4K':`${h}p`;return {id:`stream-${i}`,source_addon_id:'addon:fixture',audio_languages:options.sourceAudioLanguages ?? ['en'],presentation:{source_id:i%2?'supplier-b':'supplier-a',provider_name:i%2?'Supplier B':'Supplier A'},name,detail:'WEB-DL · HEVC · 5.1 · 18.4 GB',quality_height:h,view:{title:name,body:'WEB-DL · HEVC · 5.1 · 18.4 GB',quality_label:quality,format_label:i===0?'HDR10 · Dolby Atmos':'HEVC',addon_label:`[Add-on ${i%2?'B':'A'}]`,provider_label:name}};});
  if(path==='/api/streams/job-1'){
      const publishDiscovery=(events:any[],done:boolean)=>send({events:events.map(event=>({...event,streams:event.streams.filter((source:any)=>(!preferredSupplier||source.presentation?.source_id===preferredSupplier)&&(!excludedSupplier||source.presentation?.source_id!==excludedSupplier)).slice(0,preferredSupplier?1:undefined)})),done,...(options.preferredDiscovery?{phase:discoveryPhase}:{})});
      const after=Number(url.searchParams.get('after')??0);
      if(options.finding&&!discoveryEvents.length)discoveryEvents.push({streams});
      if(!options.finding)return publishDiscovery(discoveryEvents.length?discoveryEvents.slice(after):[{streams}],true);
      // finding: long-poll until new events arrive or discovery completes
      const deadline=Date.now()+9000;
      for(;;){
        if(discoveryEvents.length>after||discoveryDone)return publishDiscovery(discoveryEvents.slice(after),discoveryDone);
        if(Date.now()>deadline)return publishDiscovery([],discoveryDone);
        await new Promise<void>(resolve=>{discoveryWaiters.push(resolve);setTimeout(resolve,300);});
      }
    }
  if(path.endsWith("/source-ranking") && body.ids?.some((id: string) => id.startsWith("live-stream-")))
      return send({streams:[{id:"live-stream-0",name:"Live source A",view:{title:"Live source A",body:"Server HLS · 1080p",quality_label:"1080p",format_label:"HLS"}},{id:"live-stream-1",name:"Live source B",view:{title:"Live source B",body:"Server HLS · 720p",quality_label:"720p",format_label:"HLS"}}],best_match_id:"live-stream-1",quality_filters:[],total:2});
  if(path.endsWith('/source-ranking')){
      const heightFilter=typeof body.quality_height==='number'?body.quality_height:null;
      const wanted:string[]=Array.isArray(body.ids)?body.ids:[];
      const allSources:any[]=[...streams,...discoveryEvents.flatMap(e=>e.streams)];
      const pool:any[]=(wanted.length?wanted.map(id=>allSources.find(s=>s.id===id)).filter(Boolean):streams).map(source=>options.preferredLowQuality&&discoveryPhase==='preferred'?{...source,quality_height:720,view:{...source.view,quality_label:'720p'}}:source);
      const matching=(heightFilter==null?pool:pool.filter(s=>s.quality_height===heightFilter)).slice().sort((a,b)=>((b.best?1:0)-(a.best?1:0))||((b.quality_height??0)-(a.quality_height??0)));
      if(options.preferredDiscovery&&(body.remembered_source||body.cross_title_source)&&options.reuseMatch!==false)for(const source of matching)source.reuse_audio_language='en';
      const counts=new Map<number,number>();
      for(const s of pool)counts.set(s.quality_height,(counts.get(s.quality_height)??0)+1);
      const quality_filters=[...counts.entries()].sort((a,b)=>b[0]-a[0]).map(([height,count])=>({height,label:height>=2160?'4K':`${height}p`,count}));
      return send({streams:matching,best_match_id:matching[0]?.id??null,best_match_fully_matches:true,automatic_source_ids:matching.map(s=>s.id),
        ...(options.episodeFlow ? {source_reuse_supported:true,...(options.preferredDiscovery?{source_reuse_ready:options.reuseMatch!==false}:{}),source_reuse_ids:body.remembered_source || body.cross_title_source ? options.reuseMatch === false ? [] : options.preferredDiscovery?matching.map(s=>s.id):['stream-0','stream-2','stream-4','stream-6'] : [],source_reuse_preferred:options.preferredDiscovery?discoveryPhase==='preferred':options.reusePreferred !== false,source_reuse_fully_matches:options.reuseMatch !== false&&!options.preferredLowQuality} : {}),quality_filters,total:matching.length});
    }
  if(path.endsWith('/live/channels')){
      const searching = url.searchParams.has("search");
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Number(url.searchParams.get("limit") ?? 40),
        pageSize = Number(url.searchParams.get("page_size") ?? limit),
        pageLength = Math.min(limit, options.livePageLength ?? limit);
      if (offset > 0 && options.pageDelayMillis) await new Promise(resolve=>setTimeout(resolve,options.pageDelayMillis));
      if (offset > 0 && options.holdNextPage) await pageGate;
      const all = options.liveEmptyGroups?.includes(url.searchParams.get("group_id") ?? "") ? [] : Array.from({length: searching ? options.searchChannelCount ?? 3 : liveChannelCount ?? cards.length}, (_,i) => ({id:`channel-${i}`,connection_id:"m3u:1",card:{...cards[i % cards.length],identity:{kind:"live",id:`channel-${i}`,ids:[]},provider_id:"m3u:1",title:(liveRevision>0?`Updated channel ${i}`:(searching?`Fixture channel ${i}`:cards[i % cards.length].title)),...(liveRevision>0||searching ? {landscape:null,poster:null,logo:null} : {})}}));
      return send({
        channels: all.slice(offset, offset + pageLength),
        snapshot_id: `fixture-live-${liveRevision}-${profile}-${url.searchParams.get("group_id") ?? "all"}-${url.searchParams.get("search") ?? ""}`,
        paging: {
          origin:String(offset),limit,page_size:pageSize,
          previous: offset > 0 && all.length ? {cursor:String(Math.max(0,offset-pageLength)),limit:Math.min(offset,pageSize),page_size:pageSize} : null,
          next: offset+pageLength < all.length ? {cursor:String(offset+pageLength),limit:pageSize,page_size:pageSize} : null,
        },
        groups: Array.from({length: options.liveGroups ?? 0}, (_, i) => ({id:`group-${i + 1}`,label:`Group ${i + 1}`})),
        complete: offset+pageLength >= all.length,
        next_cursor: options.misleadingLiveCursor ? "4294967295" : offset + pageLength < all.length ? String(offset+pageLength) : null,
        availability: liveAvailability,
      });
    }
  if (path === "/api/playback" && options.media) {
      const gate = admissionGate;admissionGate = undefined;
      if (gate) await gate;
      if (failedAdmissions > 0) { failedAdmissions--;return send({error_code:"unplayable",error:"Source unavailable"},502); }
      if (body.replace_source && options.failReplacementOnce && !replacementFailed) {
        replacementFailed = true;
        return send({error_code:"gateway_capacity",error:"Playback capacity is currently full."},503);
      }
      leaseCount++;
      leaseLive = body.stream_id.startsWith("live-stream-");
      leaseEpisode = !leaseLive && sourceEpisode;
      leasePosition = leaseLive ? 0 : body.replace_source ? (options.replacementPosition ?? body.replace_source.observed_position) : (body.position ?? 0);
      const leaseId = leaseCount <= 1 ? "fixture-playback" : `fixture-playback-${leaseCount}`;
      const lease = {
        id: leaseId,
        status: "ready",
        actions: {pause:!leaseLive,seek:!leaseLive,restart:!leaseLive,change_source:true,episodes:leaseEpisode,next_episode:leaseEpisode,tracks:options.captionTracks ?? false,subtitle_style:options.captionTracks ?? false,report_progress:!leaseLive,...options.playbackActions},
        // A stalled-renewal lease expires quickly so the test watches the
        // expiry timer fire without waiting; a healthy lease stays valid.
        expires_at: options.stallRenewal ? Math.ceil(Date.now()/1000) + 3 : Math.floor(Date.now()/1000) + 3600,
        renew_after_seconds: 1,
        delivery: {
          kind: "gateway",
          url: `${origin}/media/${leaseId}/index.m3u8`,
          format: "hls",
          position: leasePosition,
          timeline_offset_seconds: 0,
          duration: 5,
          live: leaseLive,
          ...(options.selectedAudioLanguage ? {audio_tracks:[{input_index:0,language:options.selectedAudioLanguage,selected:true,supported:true,selectable:true}]} : {}),
          ...(options.captionTracks ? {subtitles_supported:true,subtitle_tracks:[{input_index:2,title:"English",language:"en",selected:!options.captionMedia || body.subtitles_off !== true,selectable:true,supported:true}],subtitle_appearance:{font_scale:1,text_color:"#FFFFFF",background_color:"#00000000"}} : {}),
        },
      };
      leases.set(leaseId, lease);
      return send(lease);
    }
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/heartbeat$/.test(path)){
      if(options.stallRenewal)return; // a stalled heartbeat never resolves
      if(options.refuseRenewal)return send({error:"unauthorized"},401);
      const id=path.split('/')[3];
      const stored=leases.get(id);
      if(stored)return send({...stored,expires_at:Math.floor(Date.now()/1000)+3600});
      return send({status:"ready",expires_at:Math.floor(Date.now()/1000)+3600,renew_after_seconds:1});
    }
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/segments$/.test(path)) return send({segments: options.episodeFlow ? [{kind:'intro',start_ms:0,end_ms:2000}] : []});
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/first-frame$/.test(path))
      return send({status:"ok"});
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?\/(progress|stop)$/.test(path))
      return send({status:"ok"});
    if (/^\/api\/playback\/fixture-playback(?:-\d+)?$/.test(path)) {
      if (request.method()==='DELETE') {
        // A slow release holds the lease open long enough for a Back to land
        // while the release is still in flight.
        if (options.slowRelease) await new Promise(resolve=>setTimeout(resolve,1200));
        leases.delete(path.split('/').pop()!);
        return send({status:"released"});
      }
      const id=path.split('/').pop()!;
      const stored=leases.get(id);
      return send(stored?{...stored}:{id,status:"ready"});
    }
  const guideChannel = path.match(/\/live\/([^/]+)\/guide$/)?.[1];
  if(guideChannel){
    if(options.holdGuides?.includes(guideChannel))await guideGate;
    if(options.liveGuideFailures?.includes(guideChannel))return send({error:'Guide unavailable'},503);
    if(options.liveGuideWindows){
      const start=Math.floor(Date.now()/1800000)*1800000;
      return send({view:{current_program_id:`${guideChannel}-now`,now_millis:start+300000,window_start_millis:start,window_end_millis:start+7200000},programs:[{id:`${guideChannel}-now`,title:`${guideChannel} now`,start_millis:start,end_millis:start+1800000},{id:`${guideChannel}-next`,title:`${guideChannel} next`,start_millis:start+1800000,end_millis:start+3600000}]});
    }
    return send({programs:[{id:'program',title:'Now playing',start_millis:0,end_millis:9999999999999}]});
  }
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
  if(path==='/api/addons'){
      if(request.method()==="POST"){
        if(options.rejectAddon)return send({error:"The address did not resolve to a valid add-on.",error_code:"addon_invalid"},422);
        const id=(options.addons??0)+1;addonStates.set(`addon:${id}`,true);
        return send({id});
      }
      return send({items:Array.from({length:options.addons??0},(_,i)=>({id:i+1,name:`Add-on ${i+1}`,enabled:true})),next_cursor:null});
    }
  if(path.endsWith('/source-integrations'))return send({revision:0,schemas:[],connections:[]});
  if(path.endsWith('/live/favorites'))return send({channel_ids:[...liveFavoriteIds]});
  const favMatch=path.match(/^\/api\/profiles\/[^/]+\/live\/([^/]+)\/favorite$/);
  if(favMatch){
    const id=favMatch[1];
    if(request.method()==='PUT')liveFavoriteIds.add(id);else liveFavoriteIds.delete(id);
    return send({channel_ids:[...liveFavoriteIds]});
  }
  if(path==='/api/parent/status')return send({pin_configured:true,unlocked:true});
  return send({error:`Unhandled fixture ${request.method()} ${path}`},404);
 });
 return {
  holdNextAdmission() { let release!: () => void;admissionGate = new Promise<void>(resolve => { release = resolve; });return release; },
  completeContinuation() { pendingContinuation = false; },
  failNextAdmissions(value: number) { failedAdmissions = value; },
  setConfigurationRevision(value: number) { configurationRevision = value; },
  requests,
  addonEnabled: (id: string) => addonStates.get(id),
  card,
  cards,
  bootstrap,
  reviseCatalog: (indices: number[]) => { catalogView = indices.map(index => catalogCards[index]); revision++; },
  reviseLive: () => { liveRevision++; revision++; },
  addLiveChannels: (count: number) => { liveChannelCount=count; liveAvailability="Available"; liveRevision++; revision++; },
  completeDiscovery: () => { discoveryDone=true; notifyDiscovery(); },
  addBestSource: () => { discoveryEvents.push({streams:[{id:'stream-best',name:'LordStreams',detail:'WEB-DL · AV1 · 5.1 · 9.2 GB',quality_height:2160,best:true,view:{title:'LordStreams',body:'WEB-DL · AV1 · 5.1 · 9.2 GB',quality_label:'4K',format_label:'AV1',provider_label:'LordStreams'}}]}); notifyDiscovery(); },
  setNavigation: (ids: string[]) => { navigationIds = ids; revision++; },
  setProfile: (id: string | null) => { profile = id; revision++; },
  libraryQueries,
  releasePages,
  releasePreference,
  releaseGuides,
};
}
