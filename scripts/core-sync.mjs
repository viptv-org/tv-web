import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const destination=join(root,'vendor/core');
const hash=b=>createHash('sha256').update(b).digest('hex');
const mode=process.argv[2]??'check';
if(mode==='sync') {
 const source=resolve(process.argv[3]??'../core');
 const revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const dirty=execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim();
 if(dirty)throw new Error('Commit the core source/artifacts before adoption');
 const entries={};
 const copy=(from,to)=>{mkdirSync(to,{recursive:true});for(const entry of readdirSync(from,{withFileTypes:true})) {
  if(entry.isDirectory())copy(join(from,entry.name),join(to,entry.name));
  else{const data=readFileSync(join(from,entry.name));const path=join(to,entry.name);writeFileSync(path,data);entries[relative(destination,path)]=hash(data);}
 }};
 copy(join(source,'generated/wasm'),join(destination,'wasm'));
 copy(join(source,'generated/typescript'),join(destination,'typescript'));
 writeFileSync(join(destination,'lock.json'),JSON.stringify({repository:'viptv-org/core',revision,files:entries},null,2)+'\n');
 writeFileSync(join(root,'CORE_REF'),revision+'\n');
 console.log(`Imported core ${revision}`);
} else if(mode==='check') {
 const lock=JSON.parse(readFileSync(join(destination,'lock.json'),'utf8'));
 if(readFileSync(join(root,'CORE_REF'),'utf8').trim()!==lock.revision)throw new Error('Core pin mismatch');
 for(const [path,expected] of Object.entries(lock.files)) {
  const file=resolve(destination,path);
  if(!file.startsWith(destination+'/')||!existsSync(file)||hash(readFileSync(file))!==expected)throw new Error(`Core artifact mismatch: ${path}`);
 }
 console.log(`Core integrity passed: ${lock.revision}`);
} else throw new Error('Use sync <core-checkout> or check');
