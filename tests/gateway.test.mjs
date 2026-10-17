import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipRequest,proxyMembership,MEMBER_SERVICE} from '../server/remote-membership.mjs';
import {createPageHandler} from '../api/page.mjs';

test('gateway forwards only the validated membership cookie and required action',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{
      assert.equal(url.origin,new URL(MEMBER_SERVICE).origin);
      assert.equal(url.searchParams.get('action'),'access');
      assert.equal(url.searchParams.get('page'),'collection');
      assert.deepEqual(options.headers,{cookie:'baox_session='+ 'a'.repeat(64)});
      return Response.json({allowed:false});
    };
    await membershipRequest({url:'/api/page?slug=collection',method:'GET',headers:{cookie:'other=private; baox_session='+'a'.repeat(64),authorization:'Bearer private'}},'access',{page:'collection'});
  }finally{globalThis.fetch=original;}
});
test('gateway rejects foreign origins before contacting the backend',async()=>{
  let contacted=false;const original=globalThis.fetch;let status;
  try{
    globalThis.fetch=async()=>{contacted=true;};
    const res={setHeader(){},set statusCode(value){status=value;},end(value){assert.match(value,/来源/);}};
    await proxyMembership({method:'POST',url:'/api/account?action=profile',headers:{origin:'https://evil.example','content-type':'application/json'},body:{}},res);
    assert.equal(status,403);assert.equal(contacted,false);
  }finally{globalThis.fetch=original;}
});
test('cloud authorization failure never falls back to protected page HTML',async()=>{
  const original=globalThis.fetch;let status,body;
  try{
    globalThis.fetch=async()=>new Response('Unavailable',{status:503});
    const res={setHeader(){},set statusCode(value){status=value;},end(value){body=value;}};
    await createPageHandler()({method:'GET',url:'/api/page?slug=collection',headers:{}},res);
    assert.equal(status,503);assert.ok(!body.includes('amber-composition'));
  }finally{globalThis.fetch=original;}
});
