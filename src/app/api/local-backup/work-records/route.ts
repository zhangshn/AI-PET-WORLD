import 'server-only'
import { handle } from '@/server/local-backup/service'
import { workRecords } from '@/server/local-backup/work-query-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export function GET(request:Request){return handle(request,()=>workRecords().list(new URL(request.url).searchParams))}
