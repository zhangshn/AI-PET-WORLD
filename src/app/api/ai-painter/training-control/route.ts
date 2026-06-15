import { NextRequest, NextResponse } from "next/server"
import { startTrainingAction, type TrainingAction } from "@/server/ai-painter-training-controller"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const actions = new Set<TrainingAction>(["prepare", "train", "infer", "full", "prepare_multiscene", "train_multiscene", "train_multiscene_gan", "infer_multiscene", "full_multiscene"])

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止启动本地训练。" }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as { action?: TrainingAction } | null
  if (!body?.action || !actions.has(body.action)) {
    return NextResponse.json({ ok: false, message: "训练操作无效。" }, { status: 400 })
  }
  try {
    const state = await startTrainingAction(body.action)
    return NextResponse.json({ ok: true, state }, { status: 202 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "无法启动训练任务。" },
      { status: 409 },
    )
  }
}
