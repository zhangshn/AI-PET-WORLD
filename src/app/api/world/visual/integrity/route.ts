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
          check("runtime_world_exists", false, "high", "缺少正式世界运行记录。", "Runtime world record is missing.", ["runtime_world_missing"]),
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
  const fixPlanRecord = fixPlanReadResult.record
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const approvedFrameDoubleGatePassed =
    approvedFrameRecord?.canShowToPlayer === true &&
    approvedFrame?.canShowToPlayer === true

  const checks: IntegrityCheck[] = [
    check("runtime_world_exists", true, "high", "正式世界运行记录存在。", "Runtime world record exists.", ["runtime_world"]),
    check(
      "candidate_hidden_if_exists",
      !candidate || candidate.canShowToPlayer === false,
      "high",
      candidate ? "候选图保持隐藏，不能直接展示。" : "当前没有候选图，展示仍然阻断。",
      candidate ? "The candidate remains hidden and cannot be displayed directly." : "No candidate exists, so display remains blocked.",
      ["candidate", "hidden_until_visual_judge"]
    ),
    check(
      "visual_fix_does_not_change_world_facts",
      !fixPlanRecord || fixPlanRecord.fixPlan.actions.every((action) => action.changesWorldFacts === false),
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
  const highSeverityFailedChecks = failedChecks.filter((item) => item.severity === "high")
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
      displayRule: "Runtime Render 只能展示通过完整性检查且拥有 ApprovedFrame 的图像。",
      displayRuleEn:
        "Runtime Render may only display an image that has an ApprovedFrame and passes the full pipeline integrity check.",
      tags: [
        "world_visual_integrity_api",
        ok ? "integrity_passed" : "integrity_failed",
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
