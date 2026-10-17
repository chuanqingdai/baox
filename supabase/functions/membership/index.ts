import postgres from 'postgres';
import {createHandler} from './api/account.mjs';
import {ca} from './server/ca.mjs';
// Supabase injects this server-only credential; it is never sent to Vercel or browsers.
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{
  prepare:false,max:2,idle_timeout:10,connect_timeout:10,
  ssl:{ca,rejectUnauthorized:true}
});
function adapter(connection,inside=false){
  return {
    async query(text,params=[]){
      if(inside)return {rows:await connection.unsafe(text,params)};
      return sql.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE baox_backend');return {rows:await tx.unsafe(text,params)};});
    },
    async transaction(fn){
      return sql.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE baox_backend');return fn(adapter(tx,true));});
    }
  };
}
const database=adapter(sql);
// Log only database role and SQLSTATE diagnostics, never queries or credentials.
sql.unsafe('select current_user').then(rows=>console.info('Membership database role:',rows[0].current_user)).catch(error=>console.error('Database startup:',error.code,error.message));
const handler=createHandler(()=>database);
// The public endpoint implements its own account/session/admin authentication.
// A Supabase Auth JWT is not used for BAOX username/password membership.
Deno.serve(async request=>{
  try {
    const url=new URL(request.url);
    const headers=Object.fromEntries(request.headers);
    // Ignore client-supplied Vercel headers at the public service boundary.
    delete headers['x-vercel-forwarded-for'];
    headers['x-forwarded-for']=request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',').pop()?.trim()||'unknown';
    let body;
    if(request.method==='POST'){
      if(Number(request.headers.get('content-length'))>420000)return Response.json({error:'上传内容过大。'},{status:413});
      const raw=await request.text();
      if(new TextEncoder().encode(raw).length>420000)return Response.json({error:'上传内容过大。'},{status:413});
      try{body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw new Error('invalid body');}catch{return Response.json({error:'请求内容格式不正确。'},{status:400});}
    }
    let status=200,responseBody='';const responseHeaders=new Headers();
    const res={setHeader:(key,value)=>responseHeaders.set(key,value),get statusCode(){return status;},set statusCode(value){status=value;},end:value=>{responseBody=value||'';}};
    await handler({url:url.pathname+url.search,method:request.method,headers,body},res);
    return new Response(responseBody,{status,headers:responseHeaders});
  }catch(error){console.error('Membership edge failed:',error.name,error.code);return Response.json({error:'会员服务暂时不可用，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}});}
});
