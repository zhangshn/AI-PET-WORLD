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
  const controlSketch = request?.body.controlSketch ?? null
  const visualFixHints = request?.body.visualFixHints ?? []

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
      promptPackage: decision.promptPackage,
      generationRequestAudit: {
        hasAiImageGenerationRequest: Boolean(request),
        requestId: request?.requestId ?? null,
        providerKind: request?.providerKind ?? decision.aiImageProviderStatus.providerKind,
        endpointConfigured: Boolean(request?.endpoint),
        method: request?.method ?? null,
        hasPromptPackage: Boolean(decision.promptPackage),
        hasControlSketch: Boolean(controlSketch),
        controlSketchId: controlSketch?.controlSketchId ?? null,
        controlSketchCanShowToPlayer: controlSketch?.canShowToPlayer ?? null,
        controlSketchCannotApprove: controlSketch?.cannotApprove ?? null,
        hasVisualFixHints: visualFixHints.length > 0,
        visualFixPlanId: request?.body.metadata.visualFixPlanId ?? null,
        visualFixHintCount: visualFixHints.length,
        outputSize: request?.body.outputSize ?? null,
        imageStyle: request?.body.imageStyle ?? null,
        safety: request?.body.safety ?? null,
        canShowToPlayer: request?.canShowToPlayer ?? false,
      },
      provider: decision.aiImageProviderStatus,
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
          : "下一步需要配置图像生成入口或授权导入候选图。",
        en: decision.aiImageGenerationRequest
          ? "Next call POST /api/world/visual/generate to create a hidden candidate."
          : "Next configure an image generation entry or authorized candidate import.",
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