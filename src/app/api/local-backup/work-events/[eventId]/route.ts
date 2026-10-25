import 'server-only'
import { handle, noQuery } from '@/server/local-backup/service'
import { workRecords } from '@/server/local-backup/work-query-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{eventId:string}>}){return handle(request,async()=>{noQuery(request);return workRecords().detail((await context.params).eventId)})}
