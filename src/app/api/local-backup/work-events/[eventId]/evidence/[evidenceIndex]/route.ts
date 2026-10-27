import 'server-only'
import { handle, noQuery } from '@/server/local-backup/service'
import { workEvidence } from '@/server/local-backup/work-evidence-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{eventId:string;evidenceIndex:string}>}){return handle(request,async()=>{noQuery(request);const p=await context.params;return workEvidence().detail(p.eventId,p.evidenceIndex)})}
