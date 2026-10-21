import { handle, body } from '@/server/local-backup/service'
import { productionGit } from '@/server/local-backup/git-context'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function POST(request:Request) {
  return handle(request,async()=>productionGit().preview(await body(request),new URL(request.url).searchParams),true)
}
