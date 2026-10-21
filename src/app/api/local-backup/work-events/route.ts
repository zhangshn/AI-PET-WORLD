import { handle, ledger } from '@/server/local-backup/service'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return handle(request, () => ledger().events(new URL(request.url).searchParams)) }
