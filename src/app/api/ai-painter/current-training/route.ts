import { NextResponse } from "next/server"
import { readCurrentTrainingDashboard } from "@/server/ai-painter-current-training"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await readCurrentTrainingDashboard(), {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  })
}
