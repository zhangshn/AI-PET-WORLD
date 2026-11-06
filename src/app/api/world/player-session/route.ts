import { playerSessionHandlers } from "@/server/world-player-access/session.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return playerSessionHandlers.GET(request)
}

export async function POST(request: Request) {
  return playerSessionHandlers.POST(request)
}
