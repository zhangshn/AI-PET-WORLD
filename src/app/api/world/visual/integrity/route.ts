import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualFactManifest,
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
  const factManifest = buildWorldVisualFactManifest({ saveRecord: runtime })
  const ownerId = runtime.ownerId
  const worldId = runtime.worldId
  const [candidateReadResult, fixPlanReadResult, approvedFrameReadResult] =
    await Promise.all([
      readLatestWorldVisualCandidateRecord({
        ownerId,
        worldId,
        currentTick: runtime.tick,
        currentSourceFactIds: factManifest.sourceFactIds,
      }),
      readLatestWorldVisualFixPlanRecord({ ownerId, worldId }),
      readLatestWorldVisualApprovedFrameRecord({
        ownerId,
        worldId,
        currentTick: runtime.tick,
        currentSourceFactIds: factManifest.sourceFactIds,
      }),
    ])

  const candidateRecord = candidateReadResult.record
  const candidate = candidateRecord?.candidate ?? null
  const condition = candidateRecord?.generationCondition ?? null
  const request = candidateRecord?.aiImageGenerationRequest ?? null
  const fixPlanRecord = fixPlanReadResult.record
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const approvedFrameDoubleGatePassed =
    approvedFrameReadResult.status === "found" &&
    approvedFrameRecord?.canShowToPlayer === true &&
    approvedFrame?.canShowToPlayer === true
  const approvedFrameCurrentRuntimeMatched =
    Boolean(approvedFrameRecord) &&
    approvedFrameRecord?.worldId === runtime.worldId &&
    approvedFrameRecord?.tick === runtime.tick &&
    sameStringSet(approvedFrameRecord?.sourceFactIds ?? [], factManifest.sourceFactIds)

  const checks: IntegrityCheck[] = [
    check("runtime_world_exists", true, "high", "正式世界运行记录存在。", "Runtime world record exists.", ["runtime_world"]),
    check(
      "candidate_read_gate_if_exists",
      candidateReadResult.status !== "invalid" && candidateReadResult.status !== "failed",
      "high",
      "候选图读取闸门不得返回 invalid/failed；旧 tick 或事实不一致的候选图必须阻断。",
      "The candidate read gate must not return invalid/failed; stale tick or fact-mismatched candidates must be blocked.",
      ["candidate", "read_gate"]
    ),
    check(
      "candidate_hidden_if_exists",
      !candidate || candidate.canShowToPlayer === false,
      "high",
      candidate ? "候选图保持隐藏，不能直接展示。" : "当前没有候选图，展示仍然阻断。",
      candidate ? "The candidate remains hidden and cannot be displayed directly." : "No candidate exists, so display remains blocked.",
      ["candidate", "hidden_until_visual_judge"]
    ),
    check(
      "candidate_current_runtime_binding_if_exists",
      !candidateRecord ||
        (candidateRecord.worldId === runtime.worldId &&
          candidateRecord.tick === runtime.tick &&
          condition?.worldId === runtime.worldId &&
          condition?.tick === runtime.tick &&
          sameStringSet(candidateRecord.sourceFactIds, factManifest.sourceFactIds)),
      "high",
      "候选图如存在，必须绑定当前 worldId、当前 tick 与当前 sourceFactIds。",
      "If a candidate exists, it must bind the current worldId, current tick, and current sourceFactIds.",
      ["candidate", "current_runtime_binding"]
    ),
    check(
      "candidate_source_kind_if_exists",
      !candidate ||
        (candidate.sourceKind === "project_model_generated" &&
          Boolean(candidate.modelVersion) &&
          !candidate.tags.includes("development_test_asset")),
      "high",
      "候选图如存在并进入正式审核，必须来自 project_model_generated，开发测试资产不能进入正式展示链。",
      "If a candidate enters formal review, it must come from project_model_generated; development test assets cannot enter the formal display chain.",
      ["candidate", "formal_source_only"]
    ),
    check(
      "generation_request_binding_if_candidate_exists",
      !candidate ||
        Boolean(
          request &&
            condition &&
            request.canShowToPlayer === false &&
            request.modelVersion === candidate.modelVersion &&
            request.condition.conditionId === condition.conditionId &&
            request.condition.worldId === runtime.worldId &&
            request.condition.tick === runtime.tick &&
            sameStringSet(request.condition.sourceFactIds, factManifest.sourceFactIds)
        ),
      "high",
      "候选图如存在，必须绑定内部模型生成请求，且请求必须绑定当前事实链。",
      "If a candidate exists, it must bind an internal model generation request, and the request must bind the current fact chain.",
      ["candidate", "generation_request"]
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
      "approved_frame_current_runtime_gate_if_exists",
      !approvedFrameRecord || approvedFrameCurrentRuntimeMatched,
      "high",
      "ApprovedFrame 如存在，必须匹配当前 worldId、当前 tick 与当前 sourceFactIds；旧 tick 不能展示。",
      "If an ApprovedFrame exists, it must match the current worldId, current tick, and current sourceFactIds; stale ticks cannot be displayed.",
      ["approved_frame", "current_runtime_gate"]
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
    check(
      "approved_frame_image_fingerprint_if_exists",
      !approvedFrame ||
        (approvedFrame.sourceImageSha256.length === 64 &&
          approvedFrame.sourceImageByteLength > 0 &&
          approvedFrame.sourceImagePayloadQualityPassed === true),
      "high",
      "ApprovedFrame 必须绑定图片 sha256、字节数与基础文件质量结果。",
      "ApprovedFrame must bind image sha256, byte length, and baseline file quality result.",
      ["approved_frame", "image_fingerprint"]
    ),
  ]

  const failedChecks = checks.filter((item) => !item.passed)
  const highSeverityFailedChecks = failedChecks.filter((item) => item.severity === "high")
  const ok = highSeverityFailedChecks.length === 0

  return NextResponse.json(
    {
      ok,
      status: ok ? "integrity_passed" : "integrity_failed",
      runtime: {
        ownerId,
        worldId,
        tick: runtime.tick,
        sourceFactIds: factManifest.sourceFactIds,
        sourceFactIdCount: factManifest.sourceFactIds.length,
      },
      pipelinePresence: {
        candidateStatus: candidateReadResult.status,
        hasCandidate: Boolean(candidateRecord),
        fixPlanStatus: fixPlanReadResult.status,
        hasFixPlan: Boolean(fixPlanRecord),
        approvedFrameStatus: approvedFrameReadResult.status,
        hasApprovedFrame: Boolean(approvedFrameRecord),
      },
      readAudits: {
        candidate: {
          path: candidateReadResult.path,
          warnings: candidateReadResult.warnings,
          tags: candidateReadResult.tags,
        },
        fixPlan: {
          path: fixPlanReadResult.path,
          warnings: fixPlanReadResult.warnings,
          tags: fixPlanReadResult.tags,
        },
        approvedFrame: {
          path: approvedFrameReadResult.path,
          warnings: approvedFrameReadResult.warnings,
          tags: approvedFrameReadResult.tags,
        },
      },
      checks,
      failedChecks,
      highSeverityFailedCount: highSeverityFailedChecks.length,
      canShowToPlayer: Boolean(approvedFrameDoubleGatePassed && approvedFrameCurrentRuntimeMatched && ok),
      displayRule: "Runtime Render 只能展示通过完整性检查、匹配当前 tick/sourceFactIds 且拥有 ApprovedFrame 的图像。",
      displayRuleEn:
        "Runtime Render may only display an image that passes integrity checks, matches the current tick/sourceFactIds, and has an ApprovedFrame.",
      tags: [
        "world_visual_integrity_api",
        ok ? "integrity_passed" : "integrity_failed",
        "current_tick_gate_checked",
        "current_source_facts_gate_checked",
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

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
