import { NextRequest, NextResponse } from "next/server"
import type { TrainingAction } from "@/server/ai-painter-training-controller"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const actions = new Set<TrainingAction>([
  "prepare_natural_home",
  "train_natural_home",
  "infer_natural_home",
  "train_natural_home_structure_guided",
  "infer_natural_home_structure_guided",
  "train_natural_home_rgb_refiner",
  "infer_natural_home_rgb_refiner",
  "full_natural_home",
  "full_natural_home_structure_guided",
  "full_natural_home_rgb_refiner",
  "full_natural_home_v18_source_expert_bank",
  "full_natural_home_v19_promoted_source",
  "full_natural_home_v20_multisource_generalization",
  "full_natural_home_v22_warning_focus",
  "full_natural_home_v23_candidate_consolidation",
  "full_natural_home_v24_diversity_generation",
  "full_natural_home_v25_diversity_generalization",
  "full_natural_home_v28_real_mask_remix",
  "prepare",
  "train",
  "infer",
  "full",
  "prepare_multiscene",
  "train_multiscene",
  "train_multiscene_gan",
  "infer_multiscene",
  "full_multiscene",
  "train_structure_guided",
  "infer_structure_guided",
  "full_structure_guided",
  "train_rgb_refiner",
  "infer_rgb_refiner",
  "full_rgb_refiner",
  "prepare_local_assets",
  "train_local_assets",
  "infer_local_assets",
  "full_local_assets",
  "prepare_discrete_assets",
  "train_discrete_assets",
  "infer_discrete_assets",
  "full_discrete_assets",
  "prepare_component_instances",
  "prepare_training_expansion",
  "full_autonomous_training",
  "report_mvp_gap",
  "report_natural_home",
  "report_natural_home_quality",
])

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止启动本地训练。" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { action?: TrainingAction } | null
  if (!body?.action || !actions.has(body.action)) {
    return NextResponse.json({ ok: false, message: "训练操作无效。" }, { status: 400 })
  }

  try {
    const { startTrainingAction } = await import("@/server/ai-painter-training-controller")
    const state = await startTrainingAction(body.action)
    return NextResponse.json({ ok: true, state }, { status: 202 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "无法启动训练任务。" },
      { status: 409 },
    )
  }
}
