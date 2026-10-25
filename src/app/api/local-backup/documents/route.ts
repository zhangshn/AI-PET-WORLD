import 'server-only'
import { handle } from '@/server/local-backup/service'
import { documents } from '@/server/local-backup/document-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export function GET(request:Request){return handle(request,()=>documents().list(new URL(request.url).searchParams))}
