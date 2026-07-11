import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      status: "legacy_live_world_candidate_image_retired",
      message: "旧 P10/live-world 候选图片入口已经退出当前控制面。",
      currentEntrypoint: "npm run run:complete-game-world",
    },
    { status: 410 },
  )
}
