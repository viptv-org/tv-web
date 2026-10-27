// Owned HTTPS ingress and external add-on fixture for the real Rust producer.
// Run from tv-web; the backend fixture uses an in-memory database and no real account.
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = 'https://viptv.local.test:18565';
const reference = resolve('../design/viptv-design-system/reference/assets');
const films = ['tt1234567','tt2345678','tt3456789'].map((id,i)=>({
  id, type:'movie', name:`Fixture film ${i+1}`, description:'Synthetic title for real producer acceptance.',
  poster:`${origin}/fixture/c5e059aaab8694dc24d6eac5443251d7.jpg`,
  background:`${origin}/fixture/a5729872fdf6d97950dabed6371ef4d6.jpg`,
  releaseInfo:'2026', genres:['Action'], runtime:'100 min', contentRating:'PG-13',
}));
const addon = http.createServer((req,res)=>{
  const path = new URL(req.url,'http://fixture').pathname;
  let value;
  if(path==='/manifest.json') value={ id:'org.viptv.remote-fixture', name:'TV acceptance fixture', version:'1.0.0', resources:['catalog','meta','stream'], types:['movie'], catalogs:[{type:'movie',id:'fixture',name:'Fixture films',extra:[{name:'search',isRequired:false}]}] };
  else if(path.startsWith('/catalog/')) value={metas:films};
  else if(path.startsWith('/meta/movie/')) value={meta:films.find(f=>f.id===path.split('/').pop().replace('.json',''))};
  else if(path.startsWith('/stream/movie/')) value={streams:[{name:'Owned HLS fixture',url:`${origin}/media/fixture/index.m3u8`}]};
  if(!value){res.writeHead(404).end();return;}
  res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(value));
}).listen(18566,'127.0.0.1');
const ingress = https.createServer({
  key:readFileSync('../.local-https/certs/viptv.local.test.key'),
  cert:readFileSync('../.local-https/certs/viptv.local.test.crt'),
},(req,res)=>{
  const path = new URL(req.url,origin).pathname;
  if(/^\/fixture\/[a-f0-9]+\.(jpg|png)$/.test(path)) {
    res.writeHead(200,{'content-type':path.endsWith('.png')?'image/png':'image/jpeg'}).end(readFileSync(resolve(reference,path.split('/').pop())));return;
  }
  if(/^\/media\/fixture\/(index\.m3u8|segment[0-4]\.ts)$/.test(path)) {
    const file=path.split('/').pop();
    res.writeHead(200,{'content-type':file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'}).end(readFileSync(resolve('tests/fixtures/hls',file.replace(/\.ts$/,'.bin'))));return;
  }
  const proxy = http.request({ hostname:'127.0.0.1',port:18567,path:req.url,method:req.method,headers:req.headers },upstream=>{
    res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);
  });
  proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Fixture backend unavailable');});
  req.pipe(proxy);
});
ingress.listen(18565,'127.0.0.1',()=>console.log('REMOTE_TV_HTTPS_READY'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{ingress.close();addon.close();process.exit(0);});
