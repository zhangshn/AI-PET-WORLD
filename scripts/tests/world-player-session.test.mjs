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

for (const stage of ["initialize", "read", "write"]) {
  for (const mode of ["error-cleanup", "undefined-cleanup", "null-cleanup", "false-cleanup", "primary-only", "close-only"]) {
    test(`player storage cleanup ${stage} ${mode}`, t => {
      const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),"player-storage-errors-")));
      const store=createPlayerAccessStore(dir), token="x".repeat(43), origin="http://127.0.0.1";
      if(stage!=="initialize")store.issueInvite();
      const primary=mode.startsWith("undefined")?undefined:mode.startsWith("null")?null:mode.startsWith("false")?false:Object.freeze(new Error("private-storage-operation"));
      const rollback=Object.freeze(new Error("private-storage-rollback")),close=Object.freeze(new Error("private-storage-close"));
      const injectPrimary=mode!=="close-only",injectClose=mode!=="primary-only",injectRollback=stage==="write"&&injectPrimary&&injectClose;
      const exec=DatabaseSync.prototype.exec,prepare=DatabaseSync.prototype.prepare,closeDb=DatabaseSync.prototype.close;
      const active=new WeakSet();let closed=0,rolledBack=0;
      t.mock.method(DatabaseSync.prototype,"exec",function(sql){
        if(stage==="initialize"&&sql.startsWith("PRAGMA busy_timeout")){active.add(this);if(injectPrimary)throw primary;}
        if(active.has(this)&&sql==="ROLLBACK"){rolledBack++;exec.call(this,sql);if(injectRollback)throw rollback;return;}
        return exec.call(this,sql);
      });
      t.mock.method(DatabaseSync.prototype,"prepare",function(sql){
        if((stage==="read"&&sql.startsWith("SELECT a.id accountId"))||(stage==="write"&&sql.startsWith("INSERT INTO invites"))){active.add(this);if(injectPrimary)throw primary;}
        return prepare.call(this,sql);
      });
      t.mock.method(DatabaseSync.prototype,"close",function(){
        closeDb.call(this);if(active.has(this)){closed++;if(injectClose)throw close;}
      });
      let thrown=false,caught;
      try{if(stage==="read")store.session(token,origin);else store.issueInvite();}catch(error){thrown=true;caught=error;}
      finally{t.mock.restoreAll();}
      assert.equal(thrown,true);assert.equal(closed,1);assert.equal(rolledBack,stage==="write"&&injectPrimary?1:0);
      if(!injectPrimary)assert.equal(caught,close);
      else if(!injectClose)assert.equal(caught,primary);
      else{
        assert(caught instanceof AggregateError);assert.equal(caught.errors.at(-1),close);
        if(injectRollback){assert(caught.errors[0] instanceof AggregateError);assert.equal(caught.errors[0].cause,primary);assert.deepEqual(caught.errors[0].errors,[primary,rollback]);assert.equal(caught.cause,caught.errors[0]);}
        else{assert.equal(caught.cause,primary);assert.deepEqual(caught.errors,[primary,close]);}
      }
      // Inspect the actual database after restoring methods; no fake successful writes.
      if(stage!=="initialize"){
        const db=new DatabaseSync(path.join(dir,"players.sqlite"),{readOnly:true});
        try{assert.equal(db.prepare("SELECT count(*) count FROM invites").get().count,stage==="write"&&!injectPrimary?2:1);assert.equal(db.prepare("SELECT count(*) count FROM accounts").get().count,0);assert.equal(db.prepare("SELECT count(*) count FROM sessions").get().count,0);}finally{db.close();}
      }
      store.issueInvite();assert.equal(store.session(token,origin),null);
      assert.equal(authorizeWithStore(new Request(origin+"/world",{headers:{cookie:"aipw_local_player="+token}}),WORLD_ID,()=>store).ok,false);
    });
  }
}

test("player storage cleanup HTTP failure does not expose causes or grant a session",async t=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),"player-storage-http-errors-"))),store=createPlayerAccessStore(dir);
  store.issueInvite();const prepare=DatabaseSync.prototype.prepare,closeDb=DatabaseSync.prototype.close;
  const primary=Object.freeze(new Error("private-query-detail")),cleanup=Object.freeze(new Error("private-close-detail"));const active=new WeakSet();
  t.mock.method(DatabaseSync.prototype,"prepare",function(sql){if(sql.startsWith("SELECT a.id accountId")){active.add(this);throw primary;}return prepare.call(this,sql);});
  t.mock.method(DatabaseSync.prototype,"close",function(){closeDb.call(this);if(active.has(this))throw cleanup;});
  let response;try{response=await createPlayerSessionHandlers(()=>store).GET(new Request("http://127.0.0.1/api/world/player-session",{headers:{cookie:"aipw_local_player="+"x".repeat(43)}}));}finally{t.mock.restoreAll();}
  assert.equal(response.status,503);assert.equal(response.headers.get("set-cookie"),null);
  const body=await response.text();assert(!body.includes(primary.message));assert(!body.includes(cleanup.message));assert.match(body,/player_access_unavailable/);
});

test("player storage cleanup preserves a real SQLite query error with close failure",t=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),"player-storage-sqlite-errors-"))),store=createPlayerAccessStore(dir);
  store.issueInvite();const seed=new DatabaseSync(path.join(dir,"players.sqlite"));seed.exec("DROP TABLE sessions");seed.close();
  const closeDb=DatabaseSync.prototype.close,cleanup=Object.freeze(new Error("database close failed"));
  t.mock.method(DatabaseSync.prototype,"close",function(){closeDb.call(this);throw cleanup;});
  let caught;try{store.session("x".repeat(43),"http://127.0.0.1");}catch(error){caught=error;}finally{t.mock.restoreAll();}
  assert(caught instanceof AggregateError);assert.equal(caught.cause.code,"ERR_SQLITE_ERROR");assert.match(caught.cause.message,/no such table: sessions/);assert.equal(caught.errors[0],caught.cause);assert.equal(caught.errors[1],cleanup);
  store.issueInvite();assert.equal(store.session("x".repeat(43),"http://127.0.0.1"),null);
});

test("player storage cleanup retains rollback failure when close succeeds",t=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),"player-storage-rollback-errors-"))),store=createPlayerAccessStore(dir);
  store.issueInvite();const exec=DatabaseSync.prototype.exec,prepare=DatabaseSync.prototype.prepare;
  const primary=Object.freeze(new Error("insert failed")),rollback=Object.freeze(new Error("rollback acknowledgement failed"));const active=new WeakSet();
  t.mock.method(DatabaseSync.prototype,"prepare",function(sql){if(sql.startsWith("INSERT INTO invites")){active.add(this);throw primary;}return prepare.call(this,sql);});
  t.mock.method(DatabaseSync.prototype,"exec",function(sql){const result=exec.call(this,sql);if(active.has(this)&&sql==="ROLLBACK")throw rollback;return result;});
  let caught;try{store.issueInvite();}catch(error){caught=error;}finally{t.mock.restoreAll();}
  assert(caught instanceof AggregateError);assert.equal(caught.cause,primary);assert.deepEqual(caught.errors,[primary,rollback]);
  const db=new DatabaseSync(path.join(dir,"players.sqlite"),{readOnly:true});try{assert.equal(db.prepare("SELECT count(*) count FROM invites").get().count,1);}finally{db.close();}
});
