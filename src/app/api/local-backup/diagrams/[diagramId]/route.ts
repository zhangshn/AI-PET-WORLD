import 'server-only'
import { handle, noQuery } from '@/server/local-backup/service'
import { diagrams } from '@/server/local-backup/document-context'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{diagramId:string}>}){return handle(request,async()=>{noQuery(request);return{dataStatus:'connected',reasonCode:'bound_document_diagram',diagram:diagrams().detail((await context.params).diagramId)}})}
