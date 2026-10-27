import 'server-only'
import { verifyLocalControlRead } from '@/server/ai-console-control/operator-session'
import { noQuery, respond } from '@/server/local-backup/service'
import { ModuleError } from '@/server/local-backup/contracts.mjs'
import { workEvidence } from '@/server/local-backup/work-evidence-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{eventId:string;evidenceIndex:string;imageIndex:string}>}){
 const auth=verifyLocalControlRead(request);if(!auth.ok)return respond({reasonCode:auth.errorCode},403)
 try{noQuery(request);const p=await context.params,r=workEvidence().image(p.eventId,p.evidenceIndex,p.imageIndex);return new Response(new Uint8Array(r.bytes),{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin'}})}
 catch(error){return respond({reasonCode:error instanceof ModuleError?error.message:'work_evidence_read_unavailable'},error instanceof ModuleError?error.status:503)}
}
