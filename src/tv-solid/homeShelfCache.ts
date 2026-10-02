import type { Catalog, TvApi } from "../api";
import { browseRequest, firstHomeCatalog, homeRowsFor, type HomeRow } from "../ui/app/homeRows";
import { catalogHomeCards, queueHomeCards, type HomeShelfView, type HomeView } from "./homeModel";

/** Geometry shared by painting and demand loading; one extra row ahead. */
export function homeRowWindow(scrollY: number, count: number) {
  const first = Math.max(0, Math.ceil((scrollY + 54 - 1038) / 364));
  const last = Math.min(count - 1, Math.floor((scrollY + 984 - 700) / 364) + 1);
  return { first, last, retainFirst: Math.max(0, first - 1) };
}

function catalogShelves(catalogs:readonly Catalog[]):HomeShelfView[] {
    const first = firstHomeCatalog(catalogs);
    const catalogRows: HomeRow[] = first
      ? [{name:first.name,catalog:first,items:[],loaded:false},...homeRowsFor(catalogs,first,false)]
      : homeRowsFor(catalogs,undefined,false);
  return catalogRows.filter(row=>browseRequest(row.catalog)).map(row=>({key:`catalog:${row.catalog.addonId??""}:${row.catalog.type}:${row.catalog.id}`,title:row.name,kind:"catalog" as const,catalog:row.catalog,cards:[],loaded:false}));
}

/** Only descriptors survive eviction. Payloads and in-flight requests belong
 * to the current demand window, not to the size of the addon collection. */
export class HomeShelfCache {
  private rows: HomeShelfView[];
  private wanted = new Set<string>();
  private retained = new Set<string>();
  private pending = new Map<string, AbortController>();
  private active = true;
  private disposed = false;
  private pumping = false;
  private changed = new Set<() => void>();
  constructor(private api: TvApi, catalogs: readonly Catalog[], private profile: HomeView,
    private publish: (rows: HomeShelfView[]) => void) {
    this.rows = [
      ...(profile.queueItems.length ? [{key:"continue",title:"Continue watching",kind:"queue" as const,cards:[],loaded:false}] : []),
      {key:"recent-live",title:"Recently watched live TV",kind:"live",cards:[],loaded:false},
      ...catalogShelves(catalogs),
      ...(profile.favoriteItems.length ? [{key:"my-list",title:"My List",kind:"favorites" as const,cards:[],loaded:false}] : []),
    ];
  }
  setCatalogs(catalogs:readonly Catalog[], revalidate = false) {
    const old = new Map(this.rows.filter(row=>row.kind==="catalog").map(row=>[row.key,row]));
    const next = catalogShelves(catalogs).map(row=>{
      const previous=old.get(row.key);
      if(!previous)return row;
      if(JSON.stringify(previous.catalog)!==JSON.stringify(row.catalog)) {
        this.pending.get(row.key)?.abort();
        return row;
      }
      if(revalidate)this.pending.get(row.key)?.abort();
      return {...previous,title:row.title,catalog:row.catalog,loaded:revalidate?false:previous.loaded,error:revalidate?undefined:previous.error};
    });
    const keys=new Set(next.map(row=>row.key));
    for(const [key,controller] of this.pending)if(key.startsWith("catalog:")&&!keys.has(key))controller.abort();
    this.rows=[...this.rows.filter(row=>row.kind!=="catalog"&&row.kind!=="favorites"),...next,...this.rows.filter(row=>row.kind==="favorites")];
    this.emit();this.pump();
  }
  snapshot() { return [...this.rows]; }
  private emit() { if(!this.disposed)this.publish(this.snapshot());for(const notify of this.changed)notify(); }
  /** A revision is ready only after currently demanded catalog rows settle. */
  waitForDemandedCatalogs(signal: AbortSignal): Promise<void> {
    const keys=[...this.wanted].filter(key=>key.startsWith("catalog:")&&this.rows.some(row=>row.key===key));
    return new Promise((resolve,reject)=>{
      const done=()=>{this.changed.delete(check);signal.removeEventListener("abort",abort);};
      const abort=()=>{done();reject(new DOMException("Cancelled","AbortError"));};
      const check=()=>{
        if(signal.aborted||this.disposed){abort();return;}
        const rows=keys.map(key=>this.rows.find(row=>row.key===key)).filter((row):row is HomeShelfView=>!!row);
        if(rows.some(row=>row.error)){done();reject(new Error("Catalog content refresh incomplete"));return;}
        if(rows.every(row=>row.loaded)){done();resolve();}
      };
      this.changed.add(check);signal.addEventListener("abort",abort,{once:true});check();
    });
  }
  updateProfile(profile: HomeView) {
    this.profile=profile;
    for(const [key,title,kind,items] of [["continue","Continue watching","queue",profile.queueItems],["my-list","My List","favorites",profile.favoriteItems]] as const) {
      if(!items.length){this.rows=this.rows.filter(row=>row.key!==key);continue;}
      if(items.length&&!this.rows.some(row=>row.key===key)) {
        const row:HomeShelfView={key,title,kind,cards:[],loaded:false};
        if(kind==="queue")this.rows.unshift(row);else this.rows.push(row);
      }
      this.rows=this.rows.map(row=>row.key===key&&this.retained.has(key)
        ? {...row,cards:kind==="queue"?queueHomeCards(items):catalogHomeCards(items),loaded:true} : row);
    }
    this.emit();
  }
  setWindow(wanted: readonly string[], retained: readonly string[]) {
    if(this.disposed)return;
    this.active=true;this.wanted=new Set(wanted);this.retained=new Set(retained);
    for(const [key,controller] of this.pending)if(!this.wanted.has(key))controller.abort();
    let changed=false;
    this.rows=this.rows.map(row=>{
      if(!this.retained.has(row.key)&&row.cards.length){changed=true;return {...row,cards:[],loaded:false};}
      return row;
    });
    if(changed)this.emit();
    this.pump();
  }
  pause() { this.active=false;for(const controller of this.pending.values())controller.abort(); }
  dispose() { this.disposed=true;this.pause();this.rows=[];for(const notify of this.changed)notify(); }
  retry(key:string) {
    this.rows=this.rows.map(row=>row.key===key?{...row,error:undefined,loaded:false}:row);
    this.wanted.add(key);this.retained.add(key);this.pump();
  }
  private pump() {
    if(this.pumping||!this.active||this.disposed)return;
    this.pumping=true;
    try {
      for(const key of this.wanted) {
        if(this.pending.size>=2)break;
        const row=this.rows.find(row=>row.key===key);
        if(!row||row.loaded||row.error||this.pending.has(key))continue;
        const controller=new AbortController();this.pending.set(key,controller);
        this.rows=this.rows.map(value=>value.key===key?{...value,loading:true}:value);
        void this.load(row,controller).finally(()=>{
          if(this.pending.get(key)===controller)this.pending.delete(key);
          this.rows=this.rows.map(value=>value.key===key?{...value,loading:false}:value);
          this.emit();this.pump();
        });
      }
      this.emit();
    } finally { this.pumping=false; }
  }
  private async load(row:HomeShelfView,controller:AbortController) {
    try {
      const signal=controller.signal;
      const items=row.kind==="queue"?this.profile.queueItems:row.kind==="favorites"?this.profile.favoriteItems:
        row.kind==="live"?(await this.api.liveV2({collection:"recent",limit:20},{signal})).items:
        (await this.api.discover(browseRequest(row.catalog!)!,{signal})).items;
      if(signal.aborted||this.disposed||!this.retained.has(row.key))return;
      const cards=row.kind==="queue"?queueHomeCards(items):catalogHomeCards(items);
      this.rows=this.rows.map(value=>value.key===row.key?{...value,cards,loaded:true,error:undefined}:value);
    } catch(error) {
      if(controller.signal.aborted||this.disposed)return;
      this.rows=this.rows.map(value=>value.key===row.key?{...value,error:error instanceof Error?error.message:"Unable to load titles"}:value);
    }
  }
}

/** Slot identity survives placeholder -> metadata updates without losing focus. */
export function homeVisibleCards(shelf:HomeShelfView, first:number) {
  if(shelf.cards.length)return shelf.cards.slice(first,first+6).map((card,index)=>({card,index:first+index}));
  return [{index:0,card:{id:`pending:${shelf.key}`,title:shelf.error?"Couldn't load titles":shelf.loading?"Loading titles…":"Titles not loaded",subtitle:shelf.error?"Select to retry":shelf.loading?"":"Select to load",image:"",progress:0}}];
}
