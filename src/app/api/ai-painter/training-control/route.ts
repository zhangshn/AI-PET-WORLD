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
  "full_natural_home_v31_edge_refiner",
  "full_natural_home_v32_patchgan_refiner",
  "full_natural_home_v33_water_artifact_guard",
  "full_natural_home_v34_water_stability",
  "full_natural_home_v35_balanced_water_detail",
  "full_natural_home_v36_balanced_generalization",
  "full_natural_home_v37_water_failure_repair",
  "full_natural_home_v38_water_edge_balance",
  "full_natural_home_v39_failure_focus_repair",
  "full_natural_home_v40_sharpness_lock_repair",
  "full_natural_home_v41_v32_water_rescue",
  "full_natural_home_v42_water_expert_fix",
  "full_natural_home_v43_v32_failure_focus_repair",
  "full_natural_home_v44_v32_stable_generalization",
  "full_natural_home_v45_generalization",
  "full_natural_home_v46_v45_failure_focus_repair",
  "full_natural_home_v47_hard_failure_stabilization",
  "full_natural_home_v48_split_expert_merge_gate",
  "full_natural_home_v49_v32_diversity_sweep",
  "full_natural_home_v50_diversity_water_gate",
  "full_natural_home_v51_safe_candidate_pack",
  "full_natural_home_v80_quality_preserving_water_repair",
  "full_natural_home_v81_high_score_diversity_distillation",
  "full_natural_home_v82_broad_structure_coverage",
  "full_natural_home_v83_water_failure_repair",
  "full_natural_home_v84_v82_safe_quality_continuation",
  "full_natural_home_v85_v82_wide_variant_sweep",
  "full_natural_home_v86_wide_candidate_distillation",
  "full_natural_home_v87_quality_ledger",
  "full_natural_home_v88_quality_allowlist_dataset",
  "full_natural_home_v89_quality_allowlist_training",
  "full_natural_home_v96_clean_multilayout",
  "full_natural_home_v97_edge_boundary_repair",
  "full_natural_home_v98_vj1_signal_repair",
  "full_natural_home_v99_vj1_boundary_similarity_repair",
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
  "full_game_map_material_slot_v46_runtime_frame",
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
