import 'server-only'
import {verifyLocalControlRead} from '@/server/ai-console-control/operator-session'
import {naturalMapReview,parseNaturalMapReview} from '@/server/local-backup/natural-map-review.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}
const denied=(reason:string,status:number)=>Response.json({ok:false,reason},{status,headers})
export async function GET(request:Request){
 const auth=verifyLocalControlRead(request)
 if(!auth.ok)return denied(auth.errorCode,403)
 const origin=request.headers.get('origin')
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))return denied('same_origin_required',403)
 try{
  const q=parseNaturalMapReview(request.url),data=await naturalMapReview(q)
  if(q.kind==='image'&&'bytes' in data)return new Response(new Uint8Array(data.bytes),{headers:{...headers,'Content-Type':'image/png','Content-Security-Policy':"default-src 'none'; sandbox"}})
  return Response.json({ok:true,data},{headers})
 }catch(e){
  const err=e as {code?:string;status?:number}
  return denied(err.code??'natural_map_source_unavailable',err.status??503)
 }
}
