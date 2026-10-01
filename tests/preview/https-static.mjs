// Disposable trusted-HTTPS static candidate host; no backend/provider traffic.
// Pass the existing local certificate directory and an unused loopback port.
import https from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const dist = resolve(import.meta.dirname,'../../dist');
const certs = resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 18444);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid fixture port');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4'};
https.createServer({cert:readFileSync(resolve(certs,'viptv.local.test.crt')),key:readFileSync(resolve(certs,'viptv.local.test.key'))},(request,response)=>{
  const path = new URL(request.url,'https://fixture.invalid').pathname;
  if(!path.startsWith('/tv/') || request.method!=='GET') { response.writeHead(404).end(); return; }
  let file = resolve(dist,decodeURIComponent(path.slice(4)) || 'index.html');
  if(!file.startsWith(dist+sep)) { response.writeHead(404).end(); return; }
  if(!existsSync(file)) file = resolve(dist,'index.html');
  try { response.writeHead(200,{'content-type':mime[extname(file)] ?? 'application/octet-stream','cache-control':'no-store'}).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
}).listen(port,'127.0.0.1',()=>console.log(`Candidate static HTTPS on loopback port ${port}; API routes are refused`));
