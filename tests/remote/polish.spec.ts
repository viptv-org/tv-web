import {test,expect,type Page} from "@playwright/test";
import {installRemoteBackend,referenceRoot} from "../preview/remote-backend";

const state=(page:Page)=>page.locator("html");
const texts=(page:Page)=>page.evaluate(()=>{
  const result:string[]=[];
  function walk(node:any){if(node.isRenderable&&node.viptvText)result.push(node.viptvText);node.children?.forEach(walk);}
  walk((window as any).__viptvRenderer.stage.root);return result;
});
const backdrops=(page:Page)=>page.evaluate(()=>{
  const src:string[]=[];function walk(n:any){if(n.isRenderable&&((n.props.w===1440&&n.props.h===810)||(n.props.w===1920&&n.props.h===1080))&&typeof n.texture?.props?.src==='string'&&n.texture.props.src.includes('/fixture/'))src.push(n.texture.props.src);n.children?.forEach(walk);}
  walk((window as any).__viptvRenderer.stage.root);return src;
});

test("hero waits for both replacement images while retaining its current synopsis",async({page,baseURL})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);
  const home=fixture.bootstrap().home!, first={...fixture.card,description:"First coherent synopsis"};
  const next={...fixture.cards[2],description:"Second coherent synopsis",logo:`${baseURL}/held-logo.png`,landscape:`${baseURL}/held-background.jpg`};
  home.hero=first;home.featured=[first,next];
  let releaseLogo!:()=>void,releaseBackground!:()=>void;
  const logo=new Promise<void>(resolve=>{releaseLogo=resolve;}),background=new Promise<void>(resolve=>{releaseBackground=resolve;});
  let logoRequested=false,backgroundRequested=false;
  await page.route("**/held-logo.png",async route=>{logoRequested=true;await logo;await route.fulfill({path:referenceRoot+"/assets/274e704ffc2eeb3e73918396e294edb0.png",contentType:"image/png"});});
  await page.route("**/held-background.jpg",async route=>{backgroundRequested=true;await background;await route.fulfill({path:referenceRoot+"/assets/3da010bb588e70c5323088b2c66658fe.jpg",contentType:"image/jpeg"});});
  await page.goto("/tv/?focusdebug=1");await expect(state(page)).toHaveAttribute("data-tv-ready","true");
  await expect.poll(()=>texts(page)).toContain("First coherent synopsis");
  await expect.poll(()=>backdrops(page)).toContain(first.landscape);
  await page.clock.fastForward(9100);
  await expect.poll(()=>logoRequested&&backgroundRequested).toBe(true);
  expect(await texts(page)).toContain("First coherent synopsis");
  releaseBackground();await page.clock.runFor(100);
  expect(await texts(page)).not.toContain("Second coherent synopsis");
  releaseLogo();
  await expect.poll(async()=>{await page.clock.runFor(32);return texts(page);}).toContain("Second coherent synopsis");
  expect(await texts(page)).not.toContain("First coherent synopsis");
});

test("blank refreshes retain a known synopsis without crossing a title boundary",async({page,baseURL})=>{
  await page.clock.install();const fixture=await installRemoteBackend(page,baseURL!);
  const home=fixture.bootstrap().home!;home.featured=[fixture.card];home.hero=fixture.card;
  fixture.card.description="A stable public synopsis";
  await page.goto("/tv/?focusdebug=1");await expect(state(page)).toHaveAttribute("data-tv-ready","true");
  await expect.poll(()=>texts(page)).toContain("A stable public synopsis");
  fixture.card.description="";fixture.card.logo=null;fixture.reviseCatalog([1,0]);
  await page.clock.fastForward(15100);await page.clock.runFor(200);
  await expect.poll(()=>fixture.requests.filter(r=>r.path==="/api/bootstrap").length).toBeGreaterThan(1);
  expect(await texts(page)).toContain("A stable public synopsis");
  home.hero={...fixture.cards[3],description:"Another title's synopsis"};home.featured=[home.hero];fixture.reviseCatalog([0,1]);
  await page.clock.fastForward(15100);
  await expect.poll(async()=>{await page.clock.runFor(32);return texts(page);}).toContain("Another title's synopsis");
  expect(await texts(page)).not.toContain("A stable public synopsis");
});

test("specials do not become the default season and remain explicitly selectable",async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!,{seasonPages:true});
  const series=fixture.cards[0];
  const episode=(season:number,index:number)=>({...series,identity:{...series.identity,id:`s${season}e${index}`,episode:{season,episode:index,order:`s${season}e${index}`}},title:season===0?"A special":"A regular episode",parent_identity:series.identity});
  const seasons=[{season:0,episode_count:1,offset:0},{season:1,episode_count:1,offset:1}];
  await page.route("**/api/meta/**",route=>{
    const offset=Number(new URL(route.request().url()).searchParams.get("offset")??0);
    return route.fulfill({json:{item:series,seasons,episodes:[episode(offset===0?0:1,1)],recommendations:[],next_cursor:null}});
  });
  await page.goto("/tv/?focusdebug=1");await expect(state(page)).toHaveAttribute("data-tv-ready","true");
  await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
  await expect(state(page)).toHaveAttribute("data-tv-screen","detail");await expect(state(page)).toHaveAttribute("data-tv-ready","true");
  await expect.poll(()=>texts(page)).toContain("Season 1");
  expect(await texts(page)).not.toContain("Season 0");
  await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
  await expect(state(page)).toHaveAttribute("data-tv-overlay","choices");
  await expect.poll(()=>texts(page)).toContain("Specials");
  await page.keyboard.press("ArrowUp");await page.keyboard.press("Enter");
  await expect(state(page)).toHaveAttribute("data-tv-overlay","");
  await expect.poll(()=>texts(page)).toContain("A special");
  expect(await texts(page)).not.toContain("A regular episode");
});

test("Home moves a stable rail and shelf while retaining the focus anchor",async({page,baseURL})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);
  const home=fixture.bootstrap().home!;
  home.rows=[{...home.rows[0],id:"continue",cards:fixture.cards},
    {...home.rows[0],id:"second",title:"Second shelf for scrolling",cards:fixture.cards}];
  await page.goto("/tv/?focusdebug=1");await expect(state(page)).toHaveAttribute("data-tv-ready","true");
  await page.keyboard.press("ArrowDown");await expect(state(page)).toHaveAttribute("data-tv-focus",/^rows:0:0:/);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  await page.clock.runFor(300);
  const position=()=>page.evaluate(()=>{
    let first:any,heading:any,outline=Infinity;
    function walk(n:any){
      if(n.props.w===424&&n.props.h===238&&n.texture?.props?.src?.includes('a5729872fdf6d97950dabed6371ef4d6.jpg'))first={id:n.id,x:n.absX};
      if(n.viptvText==='Second shelf for scrolling')heading={id:n.id,y:n.absY};
      if(n.isRenderable&&n.props.w===4&&n.props.h===230)outline=Math.min(outline,n.absX);
      n.children?.forEach(walk);
    }
    walk((window as any).__viptvRenderer.stage.root);return{first,heading,outline};
  });
  const before=await position();expect(before.first).toBeDefined();expect(before.outline).toBeCloseTo(96,0);
  await page.keyboard.press("ArrowRight");await page.clock.runFor(70);
  const middle=await position();expect(middle.first.id).toBe(before.first.id);
  expect(middle.first.x).toBeLessThan(before.first.x-8);expect(middle.first.x).toBeGreaterThan(before.first.x-434);
  expect(middle.outline).toBeCloseTo(96,0);
  await page.clock.runFor(200);
  expect(Math.round((await position()).first.x)).toBe(-346);
  const prior=(await position()).heading;
  await page.keyboard.press("ArrowDown");await page.clock.runFor(70);
  const moving=(await position()).heading;
  expect(moving.id).toBe(prior.id);expect(moving.y).toBeLessThan(prior.y-8);expect(moving.y).toBeGreaterThan(553);
  await page.clock.runFor(200);
  expect(Math.round((await position()).heading.y)).toBe(545);
  expect(fixture.requests.some(r=>r.path.startsWith('/api/meta/')||r.path==='/api/streams')).toBe(false);
});

test("entering Continue Watching fades from the displayed featured image directly to its row target",async({page,baseURL})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);const home=fixture.bootstrap().home!;
  const first={...fixture.card,logo:null,description:"First featured synopsis"};
  const second={...fixture.cards[2],logo:null,description:"Second featured synopsis"};
  const target={...fixture.cards[4],logo:null,description:"Continue target synopsis"};
  home.hero=first;home.featured=[first,second];home.rows=[{...home.rows[0],id:"continue",cards:[target]}];
  const photos=()=>page.evaluate(()=>{
    const src:string[]=[];function walk(n:any){if(n.isRenderable&&((n.props.w===1440&&n.props.h===810)||(n.props.w===1920&&n.props.h===1080))&&typeof n.texture?.props?.src==='string'&&n.texture.props.src.includes('/fixture/'))src.push(n.texture.props.src);n.children?.forEach(walk);}
    walk((window as any).__viptvRenderer.stage.root);return src;
  });
  await page.goto('/tv/?focusdebug=1');await expect.poll(()=>texts(page)).toContain(first.description);
  await expect.poll(()=>backdrops(page)).toContain(first.landscape);
  await page.clock.fastForward(9100);await expect.poll(async()=>{await page.clock.runFor(16);return texts(page);}).toContain(second.description);
  await expect.poll(()=>backdrops(page)).toContain(second.landscape);
  await page.clock.runFor(200);await page.keyboard.press('ArrowDown');
  const seen=new Set<string>();
  for(let i=0;i<28;i++){await page.clock.runFor(32);for(const src of await photos())seen.add(src);}
  await expect.poll(async()=>{await page.clock.runFor(32);return texts(page);}).toContain(target.description);
  expect([...seen]).not.toContain(first.landscape);
  expect([...seen]).toContain(second.landscape);expect([...seen]).toContain(target.landscape);
});

test("a prepared clearlogo keeps the same rendered node when its hero becomes visible",async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!);const home=fixture.bootstrap().home!;
  const card={...fixture.card,logo:'https://images.metahub.space/logo/medium/tt123/img',description:'Stable prepared logo'};
  home.hero=card;home.featured=[card];
  await page.route('**/api/bootstrap',route=>route.fulfill({json:{...fixture.bootstrap(),clearlogo_image_supported:true}}));
  await page.route('**/api/images/clearlogo/v1/tt123.png',route=>route.fulfill({path:referenceRoot+'/assets/274e704ffc2eeb3e73918396e294edb0.png',contentType:'image/png'}));
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/fixture/a5729872fdf6d97950dabed6371ef4d6.jpg',async route=>{await held;await route.fallback().catch(()=>{});});
  const logo=()=>page.evaluate(()=>{
    let found:{id:number;loaded:boolean}|undefined;function walk(n:any){if(n.texture?.props?.src?.includes?.('/api/images/clearlogo/'))found={id:n.id,loaded:n.texture.state==='loaded'};n.children?.forEach(walk);}
    walk((window as any).__viptvRenderer.stage.root);return found;
  });
  await page.goto('/tv/?focusdebug=1');await expect.poll(async()=>!!(await logo())?.loaded).toBe(true);
  const before=(await logo())!.id;expect(typeof before).toBe('number');release();await expect.poll(()=>texts(page)).toContain(card.description);
  await page.waitForTimeout(250);expect((await logo())?.id).toBe(before);
});

test("Home reuses bounded shelf and poster nodes across vertical reversals",async({page,baseURL})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:"no-preference"});await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!),home=fixture.bootstrap().home!;
  home.rows=Array.from({length:7},(_,row)=>({...home.rows[0],id:`pool-${row}`,title:`Pooled shelf ${row}`,
    cards:Array.from({length:40},(_,index)=>{const card=fixture.cards[(row+index)%fixture.cards.length];return {...card,identity:{...card.identity,id:`pool-${row}-${index}`}};})}));
  await page.goto('/tv/?focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('ArrowDown');await expect(state(page)).toHaveAttribute('data-tv-focus',/^rows:0:0:/);
  await page.clock.runFor(500);
  const nodes=()=>page.evaluate(()=>{
    const labels:Record<string,number>={},posters:number[]=[],visible:string[]=[];
    function walk(n:any){
      if(n.viptvText?.startsWith('Pooled shelf '))labels[n.viptvText]=n.id;
      if(n.props.w===256&&n.props.h===383&&n.texture?.props?.src?.includes('/fixture/')){
        posters.push(n.id);if(n.isRenderable&&Math.abs(n.absX-96)<1&&n.absY>530&&n.absY<700)visible.push(n.texture.props.src);
      }
      n.children?.forEach(walk);
    }
    walk((window as any).__viptvRenderer.stage.root);return{labels,posters:posters.sort((a,b)=>a-b),visible};
  });
  const initial=await nodes();expect(Object.keys(initial.labels)).toHaveLength(3);expect(initial.posters.length).toBeGreaterThan(0);
  let previous=0;
  for(const row of [1,2,3,4,5,6,5,4,3,2,1,0]){
    await page.keyboard.press(row>previous?'ArrowDown':'ArrowUp');previous=row;
    await expect(state(page)).toHaveAttribute('data-tv-focus',new RegExp(`^rows:0:${row}:0:`));await page.clock.runFor(300);
    const current=await nodes();expect(Object.keys(current.labels)).toHaveLength(3);
    expect(current.posters).toEqual(initial.posters);
    expect(current.visible).toEqual([home.rows[row].cards[0].poster]);
    for(const [title,id] of Object.entries(current.labels))expect(id).toBe(initial.labels[`Pooled shelf ${Number(title.split(' ').at(-1))%3}`]);
  }
  for(let column=1;column<=14;column++){
    await page.keyboard.press('ArrowRight');await page.clock.runFor(250);
    await expect(state(page)).toHaveAttribute('data-tv-focus',new RegExp(`^rows:${column}:0:`));
    const current=await nodes();expect(current.posters).toEqual(initial.posters);
    expect(current.visible).toEqual([home.rows[0].cards[column].poster]);
  }
  expect(fixture.requests.filter(request=>request.path.endsWith('/home')||request.path.endsWith('/library'))).toHaveLength(0);
});

test("focused hero poster aligns to the profile edge with clearance and uses a sharp proxy backdrop",async({page,baseURL})=>{
  const fixture=await installRemoteBackend(page,baseURL!),home=fixture.bootstrap().home!;
  const card={...fixture.card,identity:{...fixture.card.identity,id:'proxy-preview'},logo:null,
    description:'Proxy backdrop and aligned portrait preview',poster:'https://image.tmdb.org/t/p/original/preview-poster.jpg',
    landscape:'https://image.tmdb.org/t/p/original/preview-background.jpg'};
  home.rows=[{...home.rows[0],id:'portrait-row',cards:[card]}];
  const requests:URL[]=[];
  await page.route('https://wsrv.nl/**',async route=>{
    requests.push(new URL(route.request().url()));
    await route.fulfill({path:referenceRoot+'/assets/3da010bb588e70c5323088b2c66658fe.jpg',contentType:'image/jpeg'});
  });
  await page.goto('/tv/?focusdebug=1');await expect(state(page)).toHaveAttribute('data-tv-ready','true');
  await page.keyboard.press('ArrowDown');await expect.poll(()=>texts(page)).toContain(card.description);
  const boxes=await page.evaluate(()=>{
    let poster:any,avatar:any;
    function walk(n:any){
      if(n.isRenderable&&n.props.w===240&&n.props.h===360)poster={x:n.absX,y:n.absY,w:240,h:360};
      if(n.isRenderable&&n.props.w===56&&n.props.h===56&&n.absX>1700)avatar={x:n.absX,y:n.absY,w:56,h:56};
      n.children?.forEach(walk);
    }
    walk((window as any).__viptvRenderer.stage.root);return{poster,avatar};
  });
  expect(boxes.poster).toBeDefined();expect(boxes.avatar).toBeDefined();
  expect(boxes.poster.x+boxes.poster.w).toBe(boxes.avatar.x+boxes.avatar.w);
  expect(boxes.poster.y-boxes.avatar.y-boxes.avatar.h).toBeGreaterThanOrEqual(48);
  expect(boxes.poster.y+boxes.poster.h).toBeLessThan(530);
  expect(requests.some(url=>!url.searchParams.has('blur')&&url.searchParams.get('w')==='960')).toBe(true);
  expect(requests.some(url=>url.searchParams.get('w')==='240'&&!url.searchParams.has('blur'))).toBe(true);
});
