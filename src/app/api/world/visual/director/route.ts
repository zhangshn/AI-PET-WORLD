import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { buildWorldVisualPainterDecision } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取 AI Painter Director。",
        messageEn:
          "Runtime world has not been created, so AI Painter Director cannot be read.",
        readStatus: readResult.status,
        canShowToPlayer: false,
        tags: ["world_visual_director_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: readResult.record,
  })
  const request = decision.aiImageGenerationRequest
  const condition = decision.generationCondition

  return NextResponse.json(
    {
      ok: true,
      directorStatus: {
        status: decision.status,
        currentStage: decision.currentStage,
        canShowToPlayer: decision.canShowToPlayer,
        reason: decision.reason,
        requiredChain: decision.requiredChain,
        tags: decision.tags,
      },
      worldFacts: {
        worldId: decision.factManifest.worldId,
        tick: decision.factManifest.tick,
        factSource: decision.factManifest.factSource,
        hasRuntimeWorld: decision.factManifest.hasRuntimeWorld,
        hasButlerProfile: decision.factManifest.hasButlerProfile,
        hasHomeMapState: decision.factManifest.hasHomeMapState,
        hasTraceField: decision.factManifest.hasTraceField,
        hasConstructionState: decision.factManifest.hasConstructionState,
        zoneCount: decision.factManifest.zoneCount,
        placementCount: decision.factManifest.placementCount,
        constructionPlanCount: decision.factManifest.constructionPlanCount,
        recentEventCount: decision.factManifest.recentEventCount,
        sourceFactIds: decision.factManifest.sourceFactIds,
        primaryFacts: decision.factManifest.primaryFacts,
        supportingFacts: decision.factManifest.supportingFacts,
        ambientFacts: decision.factManifest.ambientFacts,
        factManifestAudit: decision.factManifestAudit,
      },
      sceneIntent: decision.sceneIntent,
      visualPlans: {
        compositionPlan: decision.compositionPlan,
        terrainPlan: decision.terrainPlan,
        assetPlan: decision.assetPlan,
        motionPlan: decision.motionPlan,
      },
      generationCondition: condition,
      generationRequestAudit: {
        hasAiImageGenerationRequest: Boolean(request),
        requestId: request?.requestId ?? null,
        modelVersion:
          request?.modelVersion ?? decision.imageModelStatus.modelVersion,
        conditionId: condition.conditionId,
        conditionVersion: condition.version,
        conditionWorldId: condition.worldId,
        conditionTick: condition.tick,
        sourceFactIdCount: condition.sourceFactIds.length,
        fixConditionCount: condition.fixConditions.length,
        output: request?.output ?? null,
        safety: condition.safetyCondition,
        canShowToPlayer: request?.canShowToPlayer ?? false,
      },
      imageModel: decision.imageModelStatus,
      reviewPreview: {
        status: decision.reviewReport.status,
        score: decision.reviewReport.score,
        reason: decision.reviewReport.reason,
        checkCount: decision.reviewReport.checks.length,
        failedChecks: decision.reviewReport.checks
          .filter((check) => !check.passed)
          .map((check) => ({
            id: check.id,
            label: check.label,
            evidence: check.evidence,
            score: check.score,
            tags: check.tags,
          })),
      },
      fixPreview: {
        status: decision.fixPlan.status,
        planId: decision.fixPlan.planId,
        actionCount: decision.fixPlan.actions.length,
        highPriorityActionCount: decision.fixPlan.actions.filter(
          (action) => action.priority === "high"
        ).length,
        changesWorldFacts: decision.fixPlan.actions.some(
          (action) => action.changesWorldFacts
        ),
      },
      approvedPreview: {
        hasApprovedFrame: Boolean(decision.approvedFrame),
        approvedFrameId: decision.approvedFrame?.frameId ?? null,
        canShowToPlayer: decision.approvedFrame?.canShowToPlayer ?? false,
      },
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "AI Painter Director 只负责把世界事实翻译成图像生成任务，不能直接展示为世界画面。",
        displayRuleEn:
          "AI Painter Director only translates world facts into image generation tasks and must not be displayed as the world frame.",
        noWorldFactRewrite:
          "Director 只能读取并翻译 WorldRuntimeSaveRecord，不能为了画面效果改写世界事实。",
        noWorldFactRewriteEn:
          "Director may only read and translate WorldRuntimeSaveRecord, and must not rewrite world facts for visual effects.",
      },
      nextStep: {
        zh: decision.aiImageGenerationRequest
          ? "下一步调用 POST /api/world/visual/generate，生成隐藏候选图。"
          : "下一步需要实现项目内部模型训练与推理。",
        en: decision.aiImageGenerationRequest
          ? "Next call POST /api/world/visual/generate to create a hidden candidate."
          : "Next implement the project's internal model training and inference.",
        endpoint: decision.aiImageGenerationRequest
          ? "POST /api/world/visual/generate"
          : null,
      },
      canShowToPlayer: false,
      tags: [
        "world_visual_director_api",
        "director_read_only",
        "world_facts_to_image_task",
        "not_player_visible",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: 200 }
  )
}
