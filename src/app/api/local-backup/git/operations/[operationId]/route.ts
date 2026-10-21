import { handle, noQuery } from '@/server/local-backup/service'
import { productionGit } from '@/server/local-backup/git-context'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request:Request,context:{params:Promise<{operationId:string}>}) {
  return handle(request,async()=>{noQuery(request);const {operationId}=await context.params;return{dataStatus:'connected',operation:productionGit().operation(operationId)}})
}
