import { buildWorldVisualApprovedFrame } from "./approved-frame"
import { buildWorldVisualAssetPlan } from "./asset-plan"
import { buildWorldVisualAuthorizedDataManifest } from "./authorized-data"
import { buildWorldVisualCompositionPlan } from "./composition-plan"
import {
  generateWorldVisualCandidateFromInternalModel,
  readWorldVisualImageModelStatus,
} from "./internal-image-model"
import { buildWorldVisualMotionPlan } from "./motion-plan"
import { buildWorldVisualGenerationCondition } from "./world-generation-condition"
import { buildWorldVisualSceneIntent } from "./scene-intent"
import { buildWorldVisualTerrainPlan } from "./terrain-plan"
import {
  auditWorldVisualFactManifest,
  buildWorldVisualFactManifest,
} from "./visual-fact-manifest"
import {
  buildWorldVisualFixPlan,
  readLatestWorldVisualFixPlanRecord,
} from "./visual-fix"
import { buildWorldVisualReviewReport } from "./visual-review"
import { WORLD_VISUAL_MVP_RULE_DATASET } from "./visual-rule-dataset"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "./visual-target-policy"
import type {
  BuildWorldVisualPainterDecisionInput,
  WorldVisualPainterDecision,
  WorldVisualPainterStage,
} from "./world-visual-painter-schema"

const REQUIRED_AI_PAINTER_CHAIN: WorldVisualPainterStage[] = [
  "world_facts",
  "scene_intent",
  "composition_plan",
  "terrain_plan",
  "asset_plan",
  "motion_plan",
  "ai_image_candidate",
  "visual_review",
  "approved_frame",
]

export async function buildWorldVisualPainterDecision(
  input: BuildWorldVisualPainterDecisionInput
): Promise<WorldVisualPainterDecision> {
  const factManifest = buildWorldVisualFactManifest(input)
  const authorizedDataManifest = buildWorldVisualAuthorizedDataManifest()
  const factManifestAudit = auditWorldVisualFactManifest(factManifest)
  const sceneIntent = buildWorldVisualSceneIntent(factManifest)
  const compositionPlan = buildWorldVisualCompositionPlan(factManifest)
  const terrainPlan = buildWorldVisualTerrainPlan(factManifest)
  const assetPlan = buildWorldVisualAssetPlan(factManifest)
  const motionPlan = buildWorldVisualMotionPlan(factManifest)
  const imageModelStatus = readWorldVisualImageModelStatus()
  const latestFixPlanReadResult = await readLatestWorldVisualFixPlanRecord({
    ownerId: input.saveRecord.ownerId,
    worldId: input.saveRecord.worldId,
  })
  const latestFixPlan =
    latestFixPlanReadResult.status === "found" && latestFixPlanReadResult.record
      ? latestFixPlanReadResult.record.fixPlan
      : null
  const generationCondition = buildWorldVisualGenerationCondition({
    factManifest,
    sceneIntent,
    compositionPlan,
    terrainPlan,
    assetPlan,
    motionPlan,
    ruleDataset: WORLD_VISUAL_MVP_RULE_DATASET,
    imageModelStatus,
    latestFixPlan,
  })
  const generatedImage = input.runGeneration && imageModelStatus.canGenerate
    ? await generateWorldVisualCandidateFromInternalModel({
        factManifest,
        generationCondition,
      })
    : null
  const aiImageGenerationRequest = generatedImage?.request ?? null
  const aiImageCandidate = generatedImage?.candidate ?? null
  const reviewReport = await buildWorldVisualReviewReport({
    factManifest,
    generationCondition,
    aiImageGenerationRequest,
    aiImageCandidate,
  })
  const approvedFrame = buildWorldVisualApprovedFrame({
    factManifest,
    generationCondition,
    aiImageGenerationRequest,
    aiImageCandidate,
    reviewReport,
  })
  const fixPlan = buildWorldVisualFixPlan({
    factManifest,
    reviewReport,
  })

  return {
    status: approvedFrame ? "approved" : "blocked_until_ai_painter_ready",
    canShowToPlayer: Boolean(approvedFrame),
    currentStage: approvedFrame ? "approved_frame" : "ai_image_candidate",
    reason: approvedFrame
      ? {
          zh: "AI 位图候选图已通过 VJ-0/VJ-1 审核并生成受控 MVP ApprovedFrame，可以进入 Runtime Render。",
          en: "The AI bitmap candidate passed VJ-0/VJ-1 and produced a controlled MVP ApprovedFrame, so it may enter Runtime Render.",
        }
      : {
          zh: "正式世界画面必须由项目内部模型根据 WorldGenerationCondition 产出位图候选图，并通过 VisualJudge 后生成 ApprovedFrame。当前还没有可展示的 ApprovedFrame，禁止展示。",
          en: "Formal world rendering requires the internal model to produce a bitmap candidate from WorldGenerationCondition and pass VisualJudge before ApprovedFrame exists. No displayable ApprovedFrame exists now, so display is blocked.",
        },
    mvpTargetPolicy: WORLD_VISUAL_MVP_TARGET_POLICY,
    ruleDataset: WORLD_VISUAL_MVP_RULE_DATASET,
    authorizedDataManifest,
    factManifest,
    factManifestAudit,
    sceneIntent,
    compositionPlan,
    terrainPlan,
    assetPlan,
    motionPlan,
    reviewReport,
    fixPlan,
    generationCondition,
    imageModelStatus,
    aiImageGenerationRequest,
    aiImageCandidate,
    approvedFrame,
    requiredChain: REQUIRED_AI_PAINTER_CHAIN,
    tags: [
      "world_visual_painter",
      "ai_image_model_required",
      imageModelStatus.canGenerate
        ? "ai_image_candidate_generated_from_internal_model"
        : "ai_image_candidate_required",
      "vj_0_hard_gate_required",
      "world_generation_condition_ready",
      latestFixPlan ? "latest_visual_fix_plan_loaded" : "no_latest_visual_fix_plan",
      "approved_frame_required",
      "pass_required_for_display",
      "old_renderer_removed",
      "no_fallback_renderer",
    ],
  }
}
