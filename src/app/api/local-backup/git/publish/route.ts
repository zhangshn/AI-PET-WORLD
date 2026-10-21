import { handle, body, noQuery } from '@/server/local-backup/service'
import { productionGit } from '@/server/local-backup/git-context'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function POST(request:Request) {
  return handle(request,async()=>{noQuery(request);return productionGit().publish(await body(request))},true)
}
