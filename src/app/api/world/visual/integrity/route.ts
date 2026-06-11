import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
  readLatestWorldVisualFixPlanRecord,
} from "@/world/world-visual-painter"

type IntegrityCheck = {
  id: string
  passed: boolean
  severity: "high" | "medium" | "low"
  zh: string
  en: string
  tags: string[]
}

export async function GET() {
  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_missing",
        message: "世界尚未创建，不能执行视觉链路完整性检查。",
        messageEn:
          "Runtime world has not been created, so visual pipeline integrity cannot be checked.",
        canShowToPlayer: false,
        checks: [
          check(
            "runtime_world_exists",
            false,
            "high",
            "缺少正式世界运行记录。",
            "Runtime world record is missing.",
            ["runtime_world_missing"]
          ),
        ],
        tags: ["world_visual_integrity_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const runtime = runtimeReadResult.record
  const ownerId = runtime.ownerId
  const worldId = runtime.worldId
  const [candidateReadResult, fixPlanReadResult, approvedFrameReadResult] =
    await Promise.all([
      readLatestWorldVisualCandidateRecord({ ownerId, worldId }),
      readLatestWorldVisualFixPlanRecord({ ownerId, worldId }),
      readLatestWorldVisualApprovedFrameRecord({ ownerId, worldId }),
    ])

  const candidateRecord = candidateReadResult.record
  const candidate = candidateRecord?.candidate ?? null
  const request = candidateRecord?.aiImageGenerationRequest ?? null
  const condition = candidateRecord?.generationCondition ?? null
  const fixPlanRecord = fixPlanReadResult.record
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const approvedFrameDoubleGatePassed =
    approvedFrameRecord?.canShowToPlayer === true &&
    approvedFrame?.canShowToPlayer === true

  const checks: IntegrityCheck[] = [
    check(
      "runtime_world_exists",
      true,
      "high",
      "正式世界运行记录存在。",
      "Runtime world record exists.",
      ["runtime_world"]
    ),
    check(
      "candidate_hidden_if_exists",
      !candidate || candidate.canShowToPlayer === false,
      "high",
      candidate
        ? "候选图保持隐藏，不能直接展示。"
        : "当前没有候选图，展示仍然阻断。",
      candidate
        ? "The candidate remains hidden and cannot be displayed directly."
        : "No candidate exists, so display remains blocked.",
      ["candidate", "hidden_until_visual_judge"]
    ),
    check(
      "candidate_has_generation_condition_if_exists",
      !candidateRecord || Boolean(condition),
      "high",
      "候选图记录必须绑定 WorldGenerationCondition。",
      "Candidate record must be bound to WorldGenerationCondition.",
      ["candidate", "world_generation_condition"]
    ),
    check(
      "generation_condition_matches_runtime",
      !condition ||
        (condition.worldId === worldId && condition.tick === runtime.tick),
      "high",
      "生成条件必须对应当前世界和当前 tick。",
      "Generation condition must match the current world and tick.",
      ["world_generation_condition", "runtime_alignment"]
    ),
    check(
      "generation_condition_preserves_world_facts",
      !condition || condition.safetyCondition.preserveWorldFacts === true,
      "high",
      "生成条件必须锁定世界事实，绘图不能篡改事实。",
      "Generation condition must preserve world facts.",
      ["world_generation_condition", "world_facts_locked"]
    ),
    check(
      "generation_condition_requires_review",
      !condition ||
        (condition.canShowToPlayer === false &&
          condition.safetyCondition.requireVisualJudge === true),
      "high",
      "生成条件和模型结果默认不可展示，必须经过 VisualJudge。",
      "Generation conditions and model outputs must remain hidden until VisualJudge passes them.",
      ["world_generation_condition", "visual_judge_required"]
    ),
    check(
      "candidate_has_generation_request_when_generated",
      !candidateRecord ||
        candidate?.sourceKind === "development_test_asset" ||
        Boolean(request),
      "medium",
      "内部模型生成的候选图必须绑定生成请求；开发测试资产不能进入正式展示。",
      "Internal-model candidates must bind a generation request. Development test assets cannot enter formal display.",
      ["candidate", "ai_image_generation_request"]
    ),
    check(
      "generation_request_uses_same_condition",
      !request ||
        !condition ||
        request.condition.conditionId === condition.conditionId,
      "high",
      "生成请求必须使用候选图记录绑定的同一份生成条件。",
      "The generation request must use the same condition bound to the candidate record.",
      ["ai_image_generation_request", "world_generation_condition"]
    ),
    check(
      "visual_fix_does_not_change_world_facts",
      !fixPlanRecord ||
        fixPlanRecord.fixPlan.actions.every(
          (action) => action.changesWorldFacts === false
        ),
      "high",
      "VisualFix 只修视觉表达，不修改世界事实。",
      "VisualFix only repairs visual expression and does not change world facts.",
      ["visual_fix", "world_facts_locked"]
    ),
    check(
      "approved_frame_record_gate_if_exists",
      !approvedFrameRecord || approvedFrameDoubleGatePassed,
      "high",
      "ApprovedFrameRecord 与 ApprovedFrame 必须同时允许展示。",
      "ApprovedFrameRecord and ApprovedFrame must both allow display.",
      ["approved_frame", "runtime_render_gate"]
    ),
    check(
      "approved_frame_sources_candidate_if_exists",
      !approvedFrameRecord ||
        approvedFrameRecord.sourceCandidateRecord.candidate.candidateId ===
          approvedFrameRecord.sourceAiImageCandidateId,
      "high",
      "ApprovedFrame 必须可追溯到通过审核的候选图。",
      "ApprovedFrame must trace back to the reviewed candidate.",
      ["approved_frame", "source_candidate_record"]
    ),
  ]

  const failedChecks = checks.filter((item) => !item.passed)
  const highSeverityFailedChecks = failedChecks.filter(
    (item) => item.severity === "high"
  )
  const ok = highSeverityFailedChecks.length === 0

  return NextResponse.json(
    {
      ok,
      status: ok ? "integrity_passed" : "integrity_failed",
      runtime: { ownerId, worldId, tick: runtime.tick },
      pipelinePresence: {
        candidateStatus: candidateReadResult.status,
        hasCandidate: Boolean(candidateRecord),
        fixPlanStatus: fixPlanReadResult.status,
        hasFixPlan: Boolean(fixPlanRecord),
        approvedFrameStatus: approvedFrameReadResult.status,
        hasApprovedFrame: Boolean(approvedFrameRecord),
      },
      checks,
      failedChecks,
      highSeverityFailedCount: highSeverityFailedChecks.length,
      canShowToPlayer: Boolean(approvedFrameDoubleGatePassed && ok),
      displayRule:
        "Runtime Render 只能展示通过完整性检查且拥有 ApprovedFrame 的图像。",
      displayRuleEn:
        "Runtime Render may only display an image that has an ApprovedFrame and passes the full pipeline integrity check.",
      tags: [
        "world_visual_integrity_api",
        ok ? "integrity_passed" : "integrity_failed",
        "world_generation_condition_checked",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: ok ? 200 : 422 }
  )
}

function check(
  id: string,
  passed: boolean,
  severity: IntegrityCheck["severity"],
  zh: string,
  en: string,
  tags: string[]
): IntegrityCheck {
  return {
    id,
    passed,
    severity,
    zh,
    en,
    tags: [id, passed ? "passed" : "failed", ...tags],
  }
}
