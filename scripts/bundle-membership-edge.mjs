import {readFile,mkdir,writeFile} from 'node:fs/promises';
const files=[];
async function add(name,path){files.push({name,content:await readFile(path,'utf8')});}
await add('index.ts','supabase/functions/membership/index.ts');
await add('deno.json','supabase/functions/membership/deno.json');
await add('api/account.mjs','server/account-handler.mjs');
// The shared handler resides one level above server/ in the edge bundle.
files.at(-1).content=files.at(-1).content.replace('error.code || error.name','error.code || error.name, error.message');
files.at(-1).content=files.at(-1).content.replaceAll('"./','"../server/');
for(const name of ['membership.mjs','security.mjs','catalog.mjs'])await add('server/'+name,'server/'+name);
files.push({name:'server/db.mjs',content:'export function database(){throw new Error("Injected edge database required");}\nexport async function transaction(db,fn){return db.transaction(fn);}\n'});
files.push({name:'server/ca.mjs',content:'export const ca='+JSON.stringify(await readFile('server/supabase-ca.crt','utf8'))+';\n'});
await mkdir('.local-data',{recursive:true});
await writeFile('.local-data/edge-bundle.json',JSON.stringify(files));
console.log('Bundled shared membership logic for Supabase Edge Functions. No credentials included.');
