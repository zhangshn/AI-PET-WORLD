import 'server-only'
import {verifyLocalControlRead} from '@/server/ai-console-control/operator-session'
import {parseDevelopmentQuery,readDevelopmentReview} from '@/server/local-backup/native-stage0-development-review.mjs'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}
export async function GET(request:Request){
  const auth=verifyLocalControlRead(request),origin=request.headers.get('origin')
  if(!auth.ok||request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))
    return Response.json({ok:false,reason:'local_same_origin_required'},{status:403,headers})
  try{
    const data=readDevelopmentReview(parseDevelopmentQuery(request.url))
    if('bytes' in data)return new Response(new Uint8Array(data.bytes),{headers:{...headers,'Content-Type':'image/png','Content-Security-Policy':"default-src 'none'; sandbox"}})
    return Response.json({ok:true,data},{headers})
  }catch(e){
    const err=e as {status?:number;code?:string}
    return Response.json({ok:false,reason:err.status?err.code:'invalid_development_evidence'},{status:err.status??503,headers})
  }
}
