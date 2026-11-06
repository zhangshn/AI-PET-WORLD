import {createPlayerAccessStore,localPlayerPrivateDirectory,denied,isAccessError,SESSION_SECONDS} from "./store.mjs";

const getStore=()=>createPlayerAccessStore(localPlayerPrivateDirectory());
const loopback=(hostname)=>["localhost","127.0.0.1","[::1]"].includes(hostname);
const MAX_BODY=4096;
function originError(){return denied(403,"player_origin_denied");}

function admitted(url){
  if(url.username||url.password||!["http:","https:"].includes(url.protocol))throw originError();
  if(loopback(url.hostname))return url.origin;
  // A public host is opt-in and must be the service's canonical TLS origin.
  if(url.protocol!=="https:" || process.env.AI_PET_WORLD_PLAYER_ORIGIN!==url.origin)throw originError();
  return url.origin;
}
function requestOrigin(request,write=false){
  const url=new URL(request.url);
  const host=request.headers.get("host");
  if(host && host.toLowerCase()!==url.host.toLowerCase())throw originError();
  const origin=admitted(url);
  const site=request.headers.get("sec-fetch-site");
  if(write && (request.headers.get("origin")!==origin || (site!==null&&site!=="same-origin")))throw originError();
  return origin;
}
function pageOrigin(headers){
  const host=headers.get("host");
  if(!host||host.length>253||/[\s/@?#\\]/.test(host))throw originError();
  const scheme=headers.get("x-forwarded-proto")==="https"?"https":"http";
  return admitted(new URL(scheme+"://"+host));
}
const cookieName=(origin)=>origin.startsWith("https:")?"__Host-aipw_player":"aipw_local_player";
function sessionToken(headers,origin){
  const raw=headers.get("cookie")??"";
  if(raw.length>8192)return null;
  const prefix=cookieName(origin)+"=";
  const found=raw.split(";").map(x=>x.trim()).filter(x=>x.startsWith(prefix));
  return found.length===1?found[0].slice(prefix.length):null;
}
function cookie(origin,token,lifetime){
  return cookieName(origin)+"="+token+"; Path=/; HttpOnly; SameSite=Strict; Max-Age="+lifetime+
    (origin.startsWith("https:")?"; Secure":"");
}
function failure(error){
  return isAccessError(error)?{ok:false,status:error.status,errorCode:error.code}:
    {ok:false,status:503,errorCode:"player_access_unavailable"};
}

/** Server-side check shared by the world page and the separate frame readers.
 * @param {Pick<Headers,'get'> | Request} source
 * @param {string} worldId
 * @returns {{ok:true,accountId:string,username:string,worldId:string,ownerId:string,playerId:string,permission:'world.read'} | {ok:false,status:number,errorCode:string}}
 */
export function authorizeWorldPlayerRead(source,worldId){
  return authorizeWithStore(source,worldId,getStore);
}
export function authorizeWithStore(source,worldId,storeFactory){
  try{
    const request=typeof source?.url==="string" && source?.headers ? source:null;
    const headers=request?request.headers:source;
    const origin=request?requestOrigin(request):pageOrigin(headers);
    const token=sessionToken(headers,origin);
    if(!token)throw denied(401,"player_login_required");
    if(typeof worldId!=="string" || worldId.length>180)throw denied(403,"world_access_denied");
    return {ok:true,...storeFactory().authorize(token,origin,worldId)};
  }catch(error){return failure(error);}
}

async function readBody(request){
  if((request.headers.get("content-type")??"").split(";")[0].trim().toLowerCase()!=="application/json"
    || ![null,"identity"].includes(request.headers.get("content-encoding")))throw denied(415,"player_json_required");
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY))throw denied(413,"player_request_too_large");
  if(!request.body)throw denied(400,"invalid_player_request");
  const reader=request.body.getReader(),parts=[];
  let count=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      count+=value.byteLength;
      if(count>MAX_BODY){await reader.cancel();throw denied(413,"player_request_too_large");}
      parts.push(value);
    }
  }finally{reader.releaseLock();}
  let body;
  try{body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts,count)));}
  catch{throw denied(400,"invalid_player_request");}
  const actions=new Map([["enroll",["action","invite","password","username"]],["login",["action","password","username"]],["logout",["action"]]]);
  const expected=actions.get(body?.action);
  if(!body||typeof body!=="object"||Array.isArray(body)||!expected||Object.keys(body).sort().join(",")!==expected.join(","))throw denied(400,"invalid_player_request");
  return body;
}
function reply(body,status=200,setCookie){
  const headers={"Cache-Control":"private, no-store","Vary":"Cookie, Origin","X-Content-Type-Options":"nosniff"};
  if(setCookie)headers["Set-Cookie"]=setCookie;
  if(status===429)headers["Retry-After"]="900";
  return Response.json(body,{status,headers});
}
function errorReply(error){
  const {status,errorCode}=failure(error);
  return reply({ok:false,errorCode},status);
}
export function createPlayerSessionHandlers(storeFactory){
  return {
    async GET(request){
      try{
        const origin=requestOrigin(request),token=sessionToken(request.headers,origin);
        const account=token?storeFactory().session(token,origin):null;
        return reply(account?{authenticated:true,...account}:{authenticated:false});
      }catch(e){return errorReply(e);}
    },
    async POST(request){
      try{
        const origin=requestOrigin(request,true),body=await readBody(request);
        const store=storeFactory();
        if(body.action==="enroll"){
          const account=await store.enroll(body.invite,body.username,body.password);
          return reply({ok:true,authenticated:false,...account},201);
        }
        if(body.action==="login"){
          const {token,...account}=await store.login(body.username,body.password,origin);
          return reply({ok:true,authenticated:true,...account},200,cookie(origin,token,SESSION_SECONDS));
        }
        store.logout(sessionToken(request.headers,origin),origin);
        return reply({ok:true,authenticated:false},200,cookie(origin,"",0));
      }catch(e){return errorReply(e);}
    }
  };
}
export const playerSessionHandlers=createPlayerSessionHandlers(getStore);
