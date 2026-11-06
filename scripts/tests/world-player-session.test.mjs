import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createPlayerAccessStore,WORLD_ID} from "../../src/server/world-player-access/store.mjs";
import {authorizeWithStore,createPlayerSessionHandlers} from "../../src/server/world-player-access/session.mjs";
import {ensurePrivatePlayerStorage} from "../../src/server/world-player-access/private-storage.mjs";

test("OS owner provisions fresh private credential storage; unprotected preexisting storage is never adopted",t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"private-player-201-")),root=fs.realpathSync.native(temp);
  t.after(()=>{assert.ok(temp.startsWith(path.join(os.tmpdir(),"private-player-201-")));fs.rmSync(temp,{recursive:true,force:true});});
  const anchor=path.join(root,"package.json");fs.writeFileSync(anchor,"{}");
  const shared=path.join(root,"shared"),safe=path.join(root,"provision");
  fs.mkdirSync(shared);fs.mkdirSync(safe);
  fs.mkdirSync(path.join(shared,"world-player-access"));if(process.platform!=="win32")fs.chmodSync(path.join(shared,"world-player-access"),0o755);
  assert.throws(()=>ensurePrivatePlayerStorage(anchor,shared,true));
  assert.throws(()=>ensurePrivatePlayerStorage(anchor,safe,false));
  const dir=ensurePrivatePlayerStorage(anchor,safe,true);
  createPlayerAccessStore(dir).issueInvite();
  assert.equal(ensurePrivatePlayerStorage(anchor,safe,false),dir);
});

async function fixture(t){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),"player-session-201-"));
  const dir=path.join(fs.realpathSync.native(base),"private");
  let now=Date.now();
  const store=()=>createPlayerAccessStore(dir,()=>now);
  const handlers=createPlayerSessionHandlers(store);
  const server=http.createServer(async(req,res)=>{
    try{
      const url="http://127.0.0.1:"+server.address().port+req.url;
      const init={method:req.method,headers:req.headers};
      if(req.method==="POST"){init.body=req;init.duplex="half";}
      const request=new Request(url,init);
      const reply=await handlers[req.method](request);
      res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));
    }catch{res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    assert.ok(base.startsWith(path.join(os.tmpdir(),"player-session-201-")));
    fs.rmSync(base,{recursive:true,force:true});
  });
  const origin="http://127.0.0.1:"+server.address().port,url=origin+"/api/world/player-session";
  const call=(body,headers={})=>fetch(url,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
  const get=(cookie="")=>fetch(url,{headers:{Cookie:cookie}});
  const grant=(cookie,world= WORLD_ID)=>authorizeWithStore(new Request(url,{headers:{cookie}}),world,store);
  return {dir,origin,url,call,get,grant,store,handlers,advance:ms=>{now+=ms;},now:()=>now};
}
const password=()=>randomBytes(24).toString("base64url");

test("real HTTP enrollment, logout, relogin, process restart, grant revocation and scoped read",async t=>{
  const f=await fixture(t), username="本地玩家甲",pass=password();
  assert.deepEqual(await (await f.get()).json(),{authenticated:false});assert(!fs.existsSync(f.dir));
  const {invite}=f.store().issueInvite();
  const registered=await f.call({action:"enroll",invite,username,password:pass});
  assert.equal(registered.status,201);assert.equal(registered.headers.get("set-cookie"),null);
  const account=await registered.json();assert.equal(account.authenticated,false);assert.notEqual(account.accountId,"mvp-natural-player-001");
  assert.equal((await f.call({action:"enroll",invite,username:"另一位玩家",password:pass})).status,403);
  assert.equal((await f.call({action:"login",username,password:password()})).status,401);
  const login=async()=>{
    const r=await f.call({action:"login",username,password:pass});
    assert.equal(r.status,200);
    const raw=r.headers.get("set-cookie");assert.match(raw,/HttpOnly/);assert.match(raw,/SameSite=Strict/);assert.match(raw,/Max-Age=43200/);
    const body=await r.json();assert.equal(body.accountId,account.accountId);assert.equal(body.token,undefined);
    return raw.split(";")[0];
  };
  const first=await login();
  const auth=f.grant(first);assert.equal(auth.ok,true);assert.equal(auth.permission,"world.read");assert.equal(auth.accountId,account.accountId);
  assert.equal(auth.playerId,"mvp-natural-player-001");assert.equal(f.grant(first,"unrelated").status,403);
  assert.equal(f.grant("ai_console_operator_session=operator").status,401);
  assert.equal(f.grant(first+"; "+first).status,401);
  assert.equal((await (await f.get(first)).json()).accountId,account.accountId);
  const scopeCookie=first.slice(first.indexOf("=")+1);
  const fresh=spawnSync(process.execPath,["--input-type=module","-e",`
    import fs from 'node:fs';import {createPlayerAccessStore,WORLD_ID} from './src/server/world-player-access/store.mjs';
    const r=JSON.parse(fs.readFileSync(0,'utf8'));const g=createPlayerAccessStore(r.dir).authorize(r.token,r.origin,WORLD_ID);
    console.log(JSON.stringify({id:g.accountId,world:g.worldId}));`],{input:JSON.stringify({dir:f.dir,origin:f.origin,token:scopeCookie}),encoding:"utf8"});
  assert.equal(fresh.status,0);assert.deepEqual(JSON.parse(fresh.stdout),{id:account.accountId,world:WORLD_ID});
  const logout=await f.call({action:"logout"},{Cookie:first});
  assert.equal(logout.status,200);assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);assert.equal(f.grant(first).status,401);
  const second=await login();assert.notEqual(second,first);
  const secondAccount={username:"本地玩家乙",password:password()};
  assert.equal((await f.call({action:"enroll",invite:f.store().issueInvite().invite,...secondAccount})).status,201);
  const other=await f.call({action:"login",...secondAccount}),otherGrant=f.grant(other.headers.get("set-cookie").split(";")[0]);
  assert.equal(otherGrant.ok,true);assert.notEqual(otherGrant.accountId,account.accountId);
  const db=new DatabaseSync(path.join(f.dir,"players.sqlite"));
  try{
    const stored=db.prepare("SELECT salt,derived_key FROM accounts WHERE id=?").get(account.accountId);
    assert.equal(stored.salt.length,16);assert.equal(stored.derived_key.length,64);
    assert.equal(db.prepare("UPDATE world_grants SET revoked_ms=? WHERE account_id=?").run(f.now(),account.accountId).changes,1);
  }finally{db.close();}
  assert.equal(f.grant(second).status,403);assert.equal(f.grant(other.headers.get("set-cookie").split(";")[0]).ok,true);
  for(const name of fs.readdirSync(f.dir)){
    const raw=fs.readFileSync(path.join(f.dir,name));
    for(const secret of [pass,invite,scopeCookie])assert.equal(raw.includes(Buffer.from(secret)),false);
  }
  f.advance(12*60*60*1000);assert.equal(f.grant(second).status,401);
});

test("one invitation has one winner under concurrency; duplicate name does not burn a different invitation",async t=>{
  const f=await fixture(t),invite=f.store().issueInvite().invite,p=password();
  const names=["本地并发甲","本地并发乙"];
  const replies=await Promise.all(names.map(username=>f.call({action:"enroll",invite,username,password:p})));
  assert.deepEqual(replies.map(r=>r.status).sort(),[201,403]);
  const winner=names[replies.findIndex(r=>r.status===201)],next=f.store().issueInvite().invite;
  assert.equal((await f.call({action:"enroll",invite:next,username:winner,password:p})).status,403);
  assert.equal((await f.call({action:"enroll",invite:next,username:"新玩家三",password:p})).status,201);
  const expired=f.store().issueInvite().invite;f.advance(30*60*1000);
  assert.equal((await f.call({action:"enroll",invite:expired,username:"新玩家四",password:p})).status,403);
});

test("origin, body, transport and rate limits cannot become game credentials",async t=>{
  const f=await fixture(t),pass=password(),invitation=f.store().issueInvite();
  const login={action:"login",username:"test-player",password:pass};
  assert.equal((await f.call(login,{Origin:"https://other.invalid"})).status,403);
  assert.equal((await f.call(login,{Origin:"null"})).status,403);
  assert.equal((await f.call(login,{"sec-fetch-site":"cross-site"})).status,403);
  assert.equal((await f.call(login,{"Content-Type":"text/plain"})).status,415);
  assert.equal((await f.call({...login,worldId:WORLD_ID})).status,400);
  assert.equal((await f.call({...login,password:"x".repeat(5000)})).status,413);
  const untrusted=new Request("http://outside.example/api/world/player-session",{method:"POST",headers:{origin:"http://outside.example","content-type":"application/json"},body:JSON.stringify(login)});
  assert.equal((await f.handlers.POST(untrusted)).status,403);
  assert.equal((await f.call({action:"enroll",invite:invitation.invite,username:login.username,password:pass})).status,201);
  for(let i=0;i<8;i++)assert.equal((await f.call({...login,password:"bad-"+pass})).status,401);
  assert.equal((await f.call(login)).status,429);
  f.advance(15*60*1000);
  assert.equal((await f.call(login)).status,200);
  for(let i=0;i<11;i++)f.store().issueInvite();
  assert.throws(()=>f.store().issueInvite(),e=>e.status===429);
  const old=process.env.AI_PET_WORLD_PLAYER_ORIGIN, secure="https://internal.example";
  try{
    process.env.AI_PET_WORLD_PLAYER_ORIGIN=secure;
    const r=await f.handlers.POST(new Request(secure+"/api/world/player-session",{method:"POST",headers:{origin:secure,"content-type":"application/json"},body:JSON.stringify(login)}));
    assert.equal(r.status,200);assert.match(r.headers.get("set-cookie"),/^__Host-aipw_player=/);assert.match(r.headers.get("set-cookie"),/; Secure$/);
    const secureCookie=r.headers.get("set-cookie").split(";")[0];
    assert.equal(f.grant(secureCookie).status,401);
    assert.equal(authorizeWithStore(new Request(secure+"/world",{headers:{cookie:secureCookie}}),WORLD_ID,f.store).ok,true);
  }finally{
    if(old===undefined)delete process.env.AI_PET_WORLD_PLAYER_ORIGIN;else process.env.AI_PET_WORLD_PLAYER_ORIGIN=old;
  }
});
