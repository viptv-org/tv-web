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
  constructor(private api: TvApi, catalogs: readonly Catalog[], private profile: HomeView,
    private publish: (rows: HomeShelfView[]) => void) {
    this.rows = [
      ...(profile.queueItems.length ? [{key:"continue",title:"Continue watching",kind:"queue" as const,cards:[],loaded:false}] : []),
      {key:"recent-live",title:"Recently watched live TV",kind:"live",cards:[],loaded:false},
      ...catalogShelves(catalogs),
      ...(profile.favoriteItems.length ? [{key:"my-list",title:"My List",kind:"favorites" as const,cards:[],loaded:false}] : []),
    ];
  }
  setCatalogs(catalogs:readonly Catalog[]) {
    this.rows=[...this.rows.filter(row=>row.kind!=="catalog"&&row.kind!=="favorites"),...catalogShelves(catalogs),...this.rows.filter(row=>row.kind==="favorites")];
    this.emit();
  }
  snapshot() { return [...this.rows]; }
  private emit() { if(!this.disposed)this.publish(this.snapshot()); }
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
  dispose() { this.disposed=true;this.pause();this.rows=[]; }
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
        row.kind==="live"?(await this.api.live({view:"us",collection:"recent",limit:20},{signal})).channels:
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
