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
        message: "世界尚未创建，不能执行视觉链路完整性自检。",
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

  const ownerId = runtimeReadResult.record.ownerId
  const worldId = runtimeReadResult.record.worldId

  const [candidateReadResult, fixPlanReadResult, approvedFrameReadResult] =
    await Promise.all([
      readLatestWorldVisualCandidateRecord({ ownerId, worldId }),
      readLatestWorldVisualFixPlanRecord({ ownerId, worldId }),
      readLatestWorldVisualApprovedFrameRecord({ ownerId, worldId }),
    ])

  const candidateRecord = candidateReadResult.record
  const candidate = candidateRecord?.candidate ?? null
  const request = candidateRecord?.aiImageGenerationRequest ?? null
  const controlSketch = request?.body.controlSketch ?? null
  const fixPlanRecord = fixPlanReadResult.record
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null

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
      "candidate_has_prompt_package_if_exists",
      !candidateRecord || Boolean(candidateRecord.promptPackage),
      "high",
      "候选图记录绑定 PromptPackage。",
      "Candidate record is bound to PromptPackage.",
      ["candidate", "prompt_package"]
    ),
    check(
      "candidate_has_generation_request_when_generated",
      !candidateRecord ||
        candidate.providerKind === "manual_import" ||
        Boolean(request),
      "medium",
      "自动生成候选图应绑定 AiImageGenerationRequest；manual_import 可以没有自动请求。",
      "Generated candidates should bind AiImageGenerationRequest; manual_import may have no automatic request.",
      ["candidate", "ai_image_generation_request"]
    ),
    check(
      "control_sketch_never_displayable",
      !controlSketch ||
        (controlSketch.canShowToPlayer === false &&
          controlSketch.cannotApprove === true),
      "high",
      "ControlSketch 只作为构图控制参考，不能展示，不能 Approved。",
      "ControlSketch is only a composition control reference and cannot be displayed or approved.",
      ["control_sketch", "cannot_approve", "not_player_visible"]
    ),
    check(
      "visual_fix_does_not_change_world_facts",
      !fixPlanRecord ||
        fixPlanRecord.fixPlan.actions.every(
          (action) => action.changesWorldFacts === false
        ),
      "high",
      "VisualFix 只修视觉表达，不改世界事实。",
      "VisualFix only repairs visual expression and does not change world facts.",
      ["visual_fix", "world_facts_locked"]
    ),
    check(
      "approved_frame_record_gate_if_exists",
      !approvedFrameRecord ||
        (approvedFrameRecord.canShowToPlayer === true &&
          approvedFrame?.canShowToPlayer === true),
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
      "ApprovedFrame 来源必须能追溯到通过审核的 AiImageCandidate。",
      "ApprovedFrame source must trace back to the reviewed AiImageCandidate.",
      ["approved_frame", "source_candidate_record"]
    ),
    check(
      "runtime_render_blocked_without_approved_frame",
      Boolean(approvedFrameRecord && approvedFrame)
        ? approvedFrameRecord.canShowToPlayer === true &&
            approvedFrame.canShowToPlayer === true
        : true,
      "high",
      approvedFrameRecord
        ? "存在 ApprovedFrame 时，Runtime Render 必须通过双重展示闸门。"
        : "没有 ApprovedFrame 时，Runtime Render 必须阻断。",
      approvedFrameRecord
        ? "When ApprovedFrame exists, Runtime Render must pass the double display gate."
        : "Without ApprovedFrame, Runtime Render must remain blocked.",
      ["runtime_render", "approved_frame_required"]
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
      runtime: {
        ownerId,
        worldId,
        tick: runtimeReadResult.record.tick,
      },
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
      canShowToPlayer: Boolean(
        approvedFrameRecord?.canShowToPlayer === true &&
          approvedFrame?.canShowToPlayer === true &&
          ok
      ),
      displayRule:
        "Runtime Render 只能展示通过完整链路自检且拥有 ApprovedFrame 的图片。",
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