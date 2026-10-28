import 'server-only'
import {handle,noQuery} from '@/server/local-backup/service'
import {projectProgress} from '@/server/local-backup/project-progress-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export function GET(request:Request){return handle(request,()=>{noQuery(request);return projectProgress()})}
