import {cookieToken,readBody,assertSameOrigin} from './security.mjs';
// Public service URL; never a database key or privileged API credential.
export const MEMBER_SERVICE='https://nophpwifppexocoxwati.supabase.co/functions/v1/membership';
export async function membershipRequest(req, action, query={}){
  const url=new URL(MEMBER_SERVICE);
  const original=new URL(req.url,'https://baox.ai');
  for(const [key,value] of original.searchParams) url.searchParams.set(key,value);
  if(action)url.searchParams.set('action',action);
  for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
  const method=req.method==='POST'?'POST':'GET';
  const token=cookieToken(req),headers={};
  // Forward only the membership cookie, never unrelated cookies or credentials.
  if(token)headers.cookie=`baox_session=${token}`;
  if(method==='POST'){
    assertSameOrigin(req);
    headers.origin=req.headers.origin;
    headers['Content-Type']='application/json';
  }
  return fetch(url,{method,headers,body:method==='POST'?JSON.stringify(await readBody(req)):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
}
export async function proxyMembership(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Cookie');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  try {
    if(!['GET','POST'].includes(req.method)){res.statusCode=405;return res.end(JSON.stringify({error:'请求方式不正确。'}));}
    const response=await membershipRequest(req);
    res.statusCode=response.status;
    const cookie=response.headers.get('set-cookie');
    if(cookie)res.setHeader('Set-Cookie',cookie);
    return res.end(await response.text());
  }catch(error){
    console.error('Membership gateway failed:',error.status||error.name);
    res.statusCode=error.status||503;
    return res.end(JSON.stringify({error:error.status?error.message:'会员服务暂时不可用，请稍后重试。'}));
  }
}
