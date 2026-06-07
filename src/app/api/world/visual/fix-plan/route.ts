import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { readLatestWorldVisualFixPlanRecord } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取 VisualFixPlan。",
        messageEn:
          "Runtime world has not been created, so no VisualFixPlan can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_fix_plan_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const fixPlanReadResult = await readLatestWorldVisualFixPlanRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
  })

  if (fixPlanReadResult.status !== "found" || !fixPlanReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: fixPlanReadResult.status,
        message: "还没有 VisualFixPlan。需要先执行 /api/world/visual/judge。",
        messageEn:
          "No VisualFixPlan exists yet. Run /api/world/visual/judge first.",
        canShowToPlayer: false,
        displayRule:
          "VisualFixPlan 只用于修正下一次 AI 图像生成请求，不允许展示给玩家当作世界画面。",
        displayRuleEn:
          "VisualFixPlan is only used to repair the next AI image generation request and must not be shown as the world frame.",
        tags: ["world_visual_fix_plan_api", ...fixPlanReadResult.tags],
      },
      { status: fixPlanReadResult.status === "empty" ? 404 : 500 }
    )
  }

  const record = fixPlanReadResult.record
  const requiredActions = record.fixPlan.actions.filter(
    (action) => action.priority === "high"
  )
  const mediumActions = record.fixPlan.actions.filter(
    (action) => action.priority === "medium"
  )
  const lowActions = record.fixPlan.actions.filter(
    (action) => action.priority === "low"
  )
  const changesWorldFacts = record.fixPlan.actions.some(
    (action) => action.changesWorldFacts
  )

  return NextResponse.json(
    {
      ok: true,
      status: fixPlanReadResult.status,
      record,
      fixPlanAudit: {
        planId: record.fixPlan.planId,
        planStatus: record.fixPlan.status,
        sourceReviewScore: record.fixPlan.sourceReviewScore,
        actionCount: record.fixPlan.actions.length,
        highPriorityActionCount: requiredActions.length,
        mediumPriorityActionCount: mediumActions.length,
        lowPriorityActionCount: lowActions.length,
        changesWorldFacts,
        canShowToPlayer: record.fixPlan.canShowToPlayer,
        sourceFactIds: record.sourceFactIds,
      },
      actionSummary: {
        highPriorityActions: requiredActions.map((action) => ({
          id: action.id,
          sourceCheckId: action.sourceCheckId,
          actionType: action.actionType,
          instructionZh: action.instruction.zh,
          instructionEn: action.instruction.en,
          expectedResultZh: action.expectedResult.zh,
          expectedResultEn: action.expectedResult.en,
          changesWorldFacts: action.changesWorldFacts,
          tags: action.tags,
        })),
        mediumPriorityActions: mediumActions.map((action) => ({
          id: action.id,
          sourceCheckId: action.sourceCheckId,
          actionType: action.actionType,
          instructionZh: action.instruction.zh,
          instructionEn: action.instruction.en,
          expectedResultZh: action.expectedResult.zh,
          expectedResultEn: action.expectedResult.en,
          changesWorldFacts: action.changesWorldFacts,
          tags: action.tags,
        })),
        lowPriorityActions: lowActions.map((action) => ({
          id: action.id,
          sourceCheckId: action.sourceCheckId,
          actionType: action.actionType,
          instructionZh: action.instruction.zh,
          instructionEn: action.instruction.en,
          expectedResultZh: action.expectedResult.zh,
          expectedResultEn: action.expectedResult.en,
          changesWorldFacts: action.changesWorldFacts,
          tags: action.tags,
        })),
      },
      reviewAudit: {
        reviewStatus: record.reviewReport.status,
        reviewScore: record.reviewReport.score,
        failedChecks: record.reviewReport.checks
          .filter((check) => !check.passed)
          .map((check) => ({
            id: check.id,
            score: check.score,
            label: check.label,
            evidence: check.evidence,
            tags: check.tags,
          })),
        passedCheckCount: record.reviewReport.checks.filter(
          (check) => check.passed
        ).length,
        totalCheckCount: record.reviewReport.checks.length,
      },
      canShowToPlayer: false,
      displayRule:
        "VisualFixPlan 只允许进入下一次 AI 图像生成请求，不能作为世界画面展示。",
      displayRuleEn:
        "VisualFixPlan may only feed the next AI image generation request and must not be displayed as the world frame.",
      nextStep: {
        zh: "下一步调用 /api/world/visual/generate 时，系统会读取 latest VisualFixPlan 并写入 AiImageGenerationRequest.body.visualFixHints。",
        en: "On the next /api/world/visual/generate call, the system reads the latest VisualFixPlan and writes it into AiImageGenerationRequest.body.visualFixHints.",
      },
      tags: [
        "world_visual_fix_plan_api",
        "visual_fix_plan_only",
        "not_player_visible",
        "world_facts_locked",
        "regeneration_hint_source",
        ...fixPlanReadResult.tags,
      ],
    },
    { status: 200 }
  )
}