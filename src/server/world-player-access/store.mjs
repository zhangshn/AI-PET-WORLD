import {createHash,randomBytes,randomUUID,scrypt,timingSafeEqual} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {promisify} from "node:util";
import {ensurePrivatePlayerStorage} from "./private-storage.mjs";

const derive=promisify(scrypt);
export const WORLD_ID="mvp-natural-world-001";
const OWNER_ID="mvp-natural-owner-001",NAMESPACE_PLAYER_ID="mvp-natural-player-001";
export const SESSION_SECONDS=12*60*60;
const MINUTE=60_000, INVITE_LIFETIME=30*MINUTE;
const scryptOptions={N:32768,r:8,p:1,maxmem:64*1024*1024};
const schema=`
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
 salt BLOB NOT NULL, derived_key BLOB NOT NULL, created_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS invites(digest TEXT PRIMARY KEY, world_id TEXT NOT NULL, permission TEXT NOT NULL,
 issued_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL, used_by TEXT REFERENCES accounts(id),used_ms INTEGER);
CREATE TABLE IF NOT EXISTS world_grants(account_id TEXT NOT NULL REFERENCES accounts(id), world_id TEXT NOT NULL,
 owner_id TEXT NOT NULL,namespace_player_id TEXT NOT NULL,permission TEXT NOT NULL,revoked_ms INTEGER,
 PRIMARY KEY(account_id,world_id,permission));
CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),
 origin TEXT NOT NULL,issued_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_account ON sessions(account_id,issued_ms);
CREATE TABLE IF NOT EXISTS attempts(bucket TEXT PRIMARY KEY,started_ms INTEGER NOT NULL,count INTEGER NOT NULL);`;

class AccessError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
export function denied(status,code){return new AccessError(status,code);}
export function isAccessError(e){return e instanceof AccessError;}
function secretDigest(tag,value){return createHash("sha256").update(tag+"\0"+value).digest("hex");}
function randomSecret(){return randomBytes(32).toString("base64url");}
const isToken=(v)=>typeof v==="string"&&/^[a-zA-Z0-9_-]{43}$/.test(v);
function credentials(username,password){
  if(typeof username!=="string"||typeof password!=="string")throw denied(400,"invalid_credentials_format");
  const name=username.normalize("NFKC");
  if(!/^[\p{L}\p{N}][\p{L}\p{N}_-]{2,31}$/u.test(name) || [...password].length<12 || [...password].length>128
    || Buffer.byteLength(password)>512)throw denied(400,"invalid_credentials_format");
  return {name,key:name.toLowerCase()};
}
function transact(db,callback){
  db.exec("BEGIN IMMEDIATE");
  try {const result=callback();db.exec("COMMIT");return result;}
  catch(e){db.exec("ROLLBACK");throw e;}
}

// Production can address only this project-private directory. No path originates in HTTP or CLI arguments.
function privateDirectory(create){
  const root=process.cwd();
  const anchor=path.join(root,"package.json");
  if(JSON.parse(fs.readFileSync(anchor,"utf8")).name!=="ai-pet-world")throw denied(503,"player_access_unavailable");
  try{return ensurePrivatePlayerStorage(anchor,fs.realpathSync.native(path.join(root,".runtime")),create);}
  catch{throw denied(503,"player_private_storage_unavailable");}
}
export const localPlayerPrivateDirectory=()=>privateDirectory(false);
export const issueLocalWorldInvite=()=>createPlayerAccessStore(privateDirectory(true)).issueInvite();

// The isolated test harness supplies its own private directory. The production wrapper above has no parameters.
export function createPlayerAccessStore(privateDirectory,clock=Date.now){
  const directory=path.resolve(privateDirectory),filename=path.join(directory,"players.sqlite");
  function withDatabase(mode,callback){
    const init=mode==="initialize";
    if(init)fs.mkdirSync(directory,{mode:0o700,recursive:true});
    if(!fs.existsSync(directory)){
      if(mode==="read")return null;
      throw denied(503,"player_access_unavailable");
    }
    if(fs.realpathSync.native(directory)!==directory || !fs.lstatSync(directory).isDirectory())throw denied(503,"player_access_unavailable");
    for(const p of [filename,filename+"-wal",filename+"-shm",filename+"-journal"]){
      let st;
      try {st=fs.lstatSync(p);} catch(e){if(e.code==="ENOENT")continue;throw e;}
      if(!st.isFile()||st.nlink!==1||fs.realpathSync.native(p)!==p)throw denied(503,"player_access_unavailable");
    }
    if(!fs.existsSync(filename)&&!init){
      if(mode==="read")return null;
      throw denied(503,"player_access_unavailable");
    }
    if(init&&!fs.existsSync(filename)){
      try{fs.closeSync(fs.openSync(filename,"wx",0o600));}catch(e){if(e.code!=="EEXIST")throw e;}
    }
    const db=new DatabaseSync(filename,{readOnly:mode==="read"});
    try {
      db.exec("PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON");
      if(init)db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;"+schema);
      return callback(db);
    } finally {db.close();}
  }

  // Record quota before running expensive password derivation. Global limits bound
  // arbitrary-name attacks; a separate per-name bucket protects each account.
  function consumeLimits(mode,limits){
    const now=clock();
    const allowed=withDatabase(mode,db=>transact(db,()=>{
      db.prepare("DELETE FROM attempts WHERE started_ms<=?").run(now-24*60*MINUTE);
      for(const [bucket,max,window] of limits){
        const row=db.prepare("SELECT started_ms,count FROM attempts WHERE bucket=?").get(bucket);
        if(row && row.started_ms>now-window && row.count>=max)return false;
      }
      const add=db.prepare("INSERT INTO attempts VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET started_ms=CASE WHEN started_ms<=? THEN excluded.started_ms ELSE started_ms END,count=CASE WHEN started_ms<=? THEN 1 ELSE count+1 END");
      for(const [bucket,,window] of limits)add.run(bucket,now,now-window,now-window);
      return true;
    }));
    if(!allowed)throw denied(429,"player_rate_limited");
  }

  function issueInvite(){
    consumeLimits("initialize",[["issue",12,60*MINUTE]]);
    const now=clock(),invite=randomSecret();
    withDatabase("write",db=>transact(db,()=>{
      db.prepare("DELETE FROM invites WHERE expires_ms<=? AND used_by IS NULL").run(now);
      db.prepare("INSERT INTO invites(digest,world_id,permission,issued_ms,expires_ms) VALUES(?,?,?,?,?)")
        .run(secretDigest("invite",invite),WORLD_ID,"world.read",now,now+INVITE_LIFETIME);
    }));
    return {invite,worldId:WORLD_ID,permission:"world.read",expiresAtUtc:new Date(now+INVITE_LIFETIME).toISOString()};
  }

  async function enroll(invite,username,password){
    const {name,key}=credentials(username,password);
    consumeLimits("write",[["enroll",24,15*MINUTE]]);
    if(!isToken(invite))throw denied(403,"enrollment_denied");
    const digest=secretDigest("invite",invite);
    const valid=(db,now)=>db.prepare("SELECT 1 FROM invites WHERE digest=? AND world_id=? AND permission='world.read' AND used_by IS NULL AND expires_ms>?")
      .get(digest,WORLD_ID,now);
    if(!withDatabase("read",db=>valid(db,clock())))throw denied(403,"enrollment_denied");
    const salt=randomBytes(16),derived=await derive(password,salt,64,scryptOptions);
    return withDatabase("write",db=>transact(db,()=>{
      const now=clock(),id=randomUUID();
      if(!valid(db,now)||db.prepare("SELECT 1 FROM accounts WHERE username_key=?").get(key))throw denied(403,"enrollment_denied");
      db.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)").run(id,name,key,salt,derived,now);
      const used=db.prepare("UPDATE invites SET used_by=?,used_ms=? WHERE digest=? AND used_by IS NULL AND expires_ms>?").run(id,now,digest,now);
      if(used.changes!==1)throw denied(403,"enrollment_denied");
      db.prepare("INSERT INTO world_grants VALUES(?,?,?,?,?,NULL)").run(id,WORLD_ID,OWNER_ID,NAMESPACE_PLAYER_ID,"world.read");
      return {accountId:id,username:name};
    }));
  }

  async function login(username,password,origin){
    const {key}=credentials(username,password);
    consumeLimits("write",[["login",100,15*MINUTE],["login:"+secretDigest("username",key),8,15*MINUTE]]);
    const account=withDatabase("read",db=>db.prepare("SELECT * FROM accounts WHERE username_key=?").get(key));
    const derived=await derive(password,account?.salt??Buffer.alloc(16),64,scryptOptions);
    const matched=timingSafeEqual(derived,account?.derived_key??Buffer.alloc(64));
    if(!matched||!account)throw denied(401,"login_denied");
    const token=randomSecret(),now=clock(),expires=now+SESSION_SECONDS*1000;
    withDatabase("write",db=>transact(db,()=>{
      db.prepare("DELETE FROM sessions WHERE expires_ms<=?").run(now);
      db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?)").run(secretDigest("session",token),account.id,origin,now,expires);
      db.prepare("DELETE FROM sessions WHERE account_id=? AND rowid NOT IN (SELECT rowid FROM sessions WHERE account_id=? ORDER BY issued_ms DESC,rowid DESC LIMIT 8)").run(account.id,account.id);
    }));
    return {token,accountId:account.id,username:account.username,expiresAtUtc:new Date(expires).toISOString()};
  }

  function session(token,origin){
    if(!isToken(token))return null;
    return withDatabase("read",db=>db.prepare("SELECT a.id accountId,a.username FROM sessions s JOIN accounts a ON s.account_id=a.id WHERE s.digest=? AND s.origin=? AND s.expires_ms>?")
      .get(secretDigest("session",token),origin,clock()))??null;
  }
  function authorize(token,origin,worldId){
    if(!isToken(token))throw denied(401,"player_login_required");
    const row=withDatabase("read",db=>db.prepare(`SELECT a.id accountId,a.username,g.world_id worldId,g.owner_id ownerId,g.namespace_player_id playerId,g.permission
      FROM sessions s JOIN accounts a ON s.account_id=a.id LEFT JOIN world_grants g ON g.account_id=a.id AND g.world_id=? AND g.permission='world.read' AND g.revoked_ms IS NULL
      WHERE s.digest=? AND s.origin=? AND s.expires_ms>?`).get(worldId,secretDigest("session",token),origin,clock()));
    if(!row)throw denied(401,"player_login_required");
    if(worldId!==WORLD_ID || row.worldId!==WORLD_ID || row.ownerId!==OWNER_ID || row.playerId!==NAMESPACE_PLAYER_ID)throw denied(403,"world_access_denied");
    return {...row};
  }
  function logout(token,origin){
    if(isToken(token))withDatabase("write",db=>db.prepare("DELETE FROM sessions WHERE digest=? AND origin=?").run(secretDigest("session",token),origin));
  }
  return {issueInvite,enroll,login,session,authorize,logout};
}
