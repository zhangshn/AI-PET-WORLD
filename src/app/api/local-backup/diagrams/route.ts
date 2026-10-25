import 'server-only'
import { handle } from '@/server/local-backup/service'
import { diagrams } from '@/server/local-backup/document-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export function GET(request:Request){return handle(request,()=>diagrams().list(new URL(request.url).searchParams))}
