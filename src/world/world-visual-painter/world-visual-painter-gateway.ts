import { buildWorldVisualAiImageCandidate } from "./ai-image-candidate"
import {
  buildWorldVisualExternalApiRequest,
  readWorldVisualAiImageProviderStatus,
} from "./ai-image-provider"
import { buildWorldVisualApprovedFrame } from "./approved-frame"
import { buildWorldVisualAssetPlan } from "./asset-plan"
import { buildWorldVisualAuthorizedDataManifest } from "./authorized-data"
import { buildWorldVisualCompositionPlan } from "./composition-plan"
import { buildWorldVisualMotionPlan } from "./motion-plan"
import { buildWorldVisualPromptPackage } from "./prompt-package"
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
  const aiImageProviderStatus = readWorldVisualAiImageProviderStatus()
  const promptPackage = buildWorldVisualPromptPackage({
    factManifest,
    sceneIntent,
    compositionPlan,
    terrainPlan,
    assetPlan,
    motionPlan,
    ruleDataset: WORLD_VISUAL_MVP_RULE_DATASET,
  })
  const latestFixPlanReadResult = await readLatestWorldVisualFixPlanRecord({
    ownerId: input.saveRecord.ownerId,
    worldId: input.saveRecord.worldId,
  })
  const latestFixPlan =
    latestFixPlanReadResult.status === "found" && latestFixPlanReadResult.record
      ? latestFixPlanReadResult.record.fixPlan
      : null
  const aiImageGenerationRequest = buildWorldVisualExternalApiRequest({
    factManifest,
    promptPackage,
    providerStatus: aiImageProviderStatus,
    latestFixPlan,
  })
  const aiImageCandidate = buildWorldVisualAiImageCandidate({
    factManifest,
    promptPackage,
    providerStatus: aiImageProviderStatus,
  })
  const reviewReport = await buildWorldVisualReviewReport({
    factManifest,
    aiImageCandidate,
  })
  const approvedFrame = buildWorldVisualApprovedFrame({
    factManifest,
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
          zh: "AI 位图候选图已通过审核并生成 ApprovedFrame，可以进入 Runtime Render。",
          en: "The AI bitmap candidate passed review and produced ApprovedFrame, so it may enter Runtime Render.",
        }
      : {
          zh: "正式世界画面必须由 AI 图像生成模型根据 Prompt Package、世界事实和最近一次 VisualFix 修正提示产出位图候选图，并通过 Visual Judge 后生成 ApprovedFrame。当前还没有合格 AI 位图候选图，禁止展示。",
          en: "Formal world rendering requires an AI-generated bitmap candidate from the Prompt Package, world facts, and the latest VisualFix hints, then a Visual Judge pass before ApprovedFrame exists. No qualified AI bitmap candidate exists now, so display is blocked.",
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
    promptPackage,
    aiImageProviderStatus,
    aiImageGenerationRequest,
    aiImageCandidate,
    approvedFrame,
    requiredChain: REQUIRED_AI_PAINTER_CHAIN,
    tags: [
      "world_visual_painter",
      "ai_image_model_required",
      "prompt_package_ready",
      latestFixPlan ? "latest_visual_fix_plan_loaded" : "no_latest_visual_fix_plan",
      "ai_image_candidate_required",
      "approved_frame_required",
      "pass_required_for_display",
      "old_renderer_removed",
      "no_fallback_renderer",
    ],
  }
}