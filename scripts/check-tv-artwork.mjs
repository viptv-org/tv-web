import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const manifest=JSON.parse(readFileSync(resolve(root,"src/tv-solid/remote/tv-artwork.manifest.json"),"utf8"));
if(manifest.version!==1)throw Error("Unsupported TV artwork manifest");
for(const [path,expected] of Object.entries({...manifest.inputs,...manifest.outputs})){
  if(path.startsWith("/")||path.split("/").includes(".."))throw Error("Invalid TV artwork path");
  const hash=createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex");
  if(hash!==expected)throw Error(`TV artwork is stale: ${path}. Run scripts/build-tv-artwork.py with Pillow.`);
}
console.log("TV artwork inputs and both packaged copies match");
