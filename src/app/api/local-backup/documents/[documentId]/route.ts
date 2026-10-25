import 'server-only'
import { handle, noQuery } from '@/server/local-backup/service'
import { documents } from '@/server/local-backup/document-context'
import { need } from '@/server/local-backup/contracts.mjs'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{documentId:string}>}){return handle(request,async()=>{const search=noQuery(request,['revision']),revision=search.get('revision');need(revision===null||/^[a-f0-9]{64}$/.test(revision),'document_revision_invalid');return{dataStatus:'connected',reasonCode:'registered_document_body',document:documents().detail((await context.params).documentId,revision)}})}
