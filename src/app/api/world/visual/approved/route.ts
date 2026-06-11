import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { readLatestWorldVisualApprovedFrameRecord } from "@/world/world-visual-painter"
import type { WorldVisualApprovedFrame } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取 ApprovedFrame。",
        messageEn:
          "Runtime world has not been created, so no ApprovedFrame can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_approved_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const approvedFrameReadResult = await readLatestWorldVisualApprovedFrameRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
  })

  if (
    approvedFrameReadResult.status !== "found" ||
    !approvedFrameReadResult.record
  ) {
    const blockedState = buildApprovedFrameBlockedState(
      approvedFrameReadResult.status
    )

    return NextResponse.json(
      {
        ok: false,
        status: approvedFrameReadResult.status,
        apiState: blockedState.apiState,
        vj0Blocked: blockedState.vj0Blocked,
        message: blockedState.message,
        messageEn: blockedState.messageEn,
        canShowToPlayer: false,
        runtimeRenderGate: {
          canRuntimeRender: false,
          reason: blockedState.reason,
          reasonZh: blockedState.message,
          reasonEn: blockedState.messageEn,
          tags: blockedState.tags,
        },
        readAudit: {
          status: approvedFrameReadResult.status,
          path: approvedFrameReadResult.path,
          warnings: approvedFrameReadResult.warnings,
          tags: approvedFrameReadResult.tags,
        },
        displayRule: blockedState.displayRule,
        displayRuleEn: blockedState.displayRuleEn,
        nextStep: blockedState.nextStep,
        tags: [
          "world_visual_approved_api",
          "approved_frame_read_not_found",
          ...blockedState.tags,
          ...approvedFrameReadResult.tags,
        ],
      },
      { status: blockedState.httpStatus }
    )
  }

  const record = approvedFrameReadResult.record
  const request = record.sourceCandidateRecord.aiImageGenerationRequest
  const condition = record.sourceCandidateRecord.generationCondition
  const runtimeRenderGate = buildRuntimeRenderGate(record.approvedFrame, record.canShowToPlayer)

  return NextResponse.json(
    {
      ok: true,
      status: approvedFrameReadResult.status,
      apiState: "approved_frame_found",
      vj0Blocked: false,
      record,
      runtimeRenderGate,
      provenance: {
        frameId: record.approvedFrame.frameId,
        sourceAiImageCandidateId: record.sourceAiImageCandidateId,
        sourceGenerationConditionId: record.sourceGenerationConditionId,
        sourceAiImageGenerationRequestId:
          record.sourceAiImageGenerationRequestId,
        sourceVisualFixPlanId: record.sourceVisualFixPlanId,
        sourceVisualFixHintCount: record.sourceVisualFixHintCount,
        sourceFactIds: record.sourceFactIds,
        reviewScore: record.approvedFrame.reviewScore,
        imageUrl: record.approvedFrame.imageUrl,
        imageUrlAudit: buildImageUrlAudit(record.approvedFrame.imageUrl),
        imageFormat: record.approvedFrame.imageFormat,
        width: record.approvedFrame.width,
        height: record.approvedFrame.height,
        sourceImageSha256: record.approvedFrame.sourceImageSha256,
        sourceImageByteLength: record.approvedFrame.sourceImageByteLength,
        sourceImageContentType: record.approvedFrame.sourceImageContentType,
        sourceImagePayloadQualityPassed:
          record.approvedFrame.sourceImagePayloadQualityPassed,
      },
      sourceCandidateAudit: {
        candidateId: record.sourceCandidateRecord.candidate.candidateId,
        candidateCanShowToPlayer:
          record.sourceCandidateRecord.candidate.canShowToPlayer,
        candidateSourceKind:
          record.sourceCandidateRecord.candidate.sourceKind,
        candidateModelVersion:
          record.sourceCandidateRecord.candidate.modelVersion,
        candidateLicense: record.sourceCandidateRecord.candidate.license,
        originalityConfirmed:
          record.sourceCandidateRecord.candidate.originalityConfirmed,
        hasGenerationCondition: Boolean(condition),
        hasAiImageGenerationRequest: Boolean(request),
        conditionId: condition.conditionId,
        conditionVersion: condition.version,
        conditionWorldId: condition.worldId,
        conditionTick: condition.tick,
        sourceFactIds: condition.sourceFactIds,
        safetyCondition: condition.safetyCondition,
        fixConditions: condition.fixConditions,
      },
      reviewAudit: {
        status: record.reviewReport.status,
        score: record.reviewReport.score,
        canShowToPlayer: record.reviewReport.canShowToPlayer,
        imageInspectionSummary: record.reviewReport.imageInspectionSummary,
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
      canShowToPlayer: runtimeRenderGate.canRuntimeRender,
      nextStep: runtimeRenderGate.canRuntimeRender
        ? {
            zh: "该 ApprovedFrame 可供 /world Runtime Render 读取展示；不得由前端重新生成或修改画面。",
            en: "This ApprovedFrame may be read by /world Runtime Render for display. The frontend must not regenerate or modify the frame.",
          }
        : {
            zh: "ApprovedFrame 缺少 Runtime Render 必需硬字段，/world 必须继续阻断。",
            en: "The ApprovedFrame is missing required Runtime Render hard fields, so /world must remain blocked.",
          },
      tags: [
        "world_visual_approved_api",
        "approved_frame_only",
        "provenance_exposed_for_audit",
        "runtime_render_gate_checked",
        runtimeRenderGate.canRuntimeRender
          ? "runtime_render_allowed"
          : "runtime_render_blocked",
        ...approvedFrameReadResult.tags,
      ],
    },
    { status: 200 }
  )
}

function buildApprovedFrameBlockedState(
  status: "empty" | "invalid" | "failed"
) {
  if (status === "empty") {
    return {
      httpStatus: 404,
      apiState: "approved_frame_empty",
      vj0Blocked: false,
      reason: "approved_frame_empty",
      message: "还没有 ApprovedFrame。需要先生成候选图并通过 VisualJudge。",
      messageEn:
        "No ApprovedFrame exists yet. Generate a candidate and pass VisualJudge first.",
      displayRule: "没有 ApprovedFrame 时，/world 必须继续阻断。",
      displayRuleEn:
        "/world must remain blocked while no ApprovedFrame exists.",
      nextStep: {
        zh: "继续等待正式 AI 位图候选图通过 VJ-0，再生成 ApprovedFrame。",
        en: "Wait for a formal AI bitmap candidate to pass VJ-0 before creating an ApprovedFrame.",
      },
      tags: ["approved_frame_empty", "runtime_render_blocked"],
    }
  }

  if (status === "invalid") {
    return {
      httpStatus: 409,
      apiState: "approved_frame_blocked_by_vj_0_read_gate",
      vj0Blocked: true,
      reason: "vj_0_approved_frame_read_gate_failed",
      message: "ApprovedFrameRecord 已被 VJ-0 读取闸门阻断，不能展示。",
      messageEn:
        "The ApprovedFrameRecord was blocked by the VJ-0 read gate and cannot be displayed.",
      displayRule:
        "读取到 invalid ApprovedFrameRecord 时，/world 必须继续阻断，不能展示旧图或坏图。",
      displayRuleEn:
        "When an invalid ApprovedFrameRecord is read, /world must remain blocked and must not display stale or invalid imagery.",
      nextStep: {
        zh: "需要重新生成候选图，并重新通过 VisualJudge 与 ApprovedFrame 写入闸门。",
        en: "Generate a new candidate and pass VisualJudge plus the ApprovedFrame write gate again.",
      },
      tags: [
        "approved_frame_invalid",
        "vj_0_read_gate_blocked",
        "runtime_render_blocked",
      ],
    }
  }

  return {
    httpStatus: 500,
    apiState: "approved_frame_read_failed",
    vj0Blocked: true,
    reason: "approved_frame_read_failed",
    message: "ApprovedFrameRecord 读取失败，不能展示。",
    messageEn: "ApprovedFrameRecord read failed and cannot be displayed.",
    displayRule: "读取失败时，/world 必须继续阻断。",
    displayRuleEn: "/world must remain blocked when reading fails.",
    nextStep: {
      zh: "需要检查本地 ApprovedFrame 存储或重新生成 ApprovedFrame。",
      en: "Check the local ApprovedFrame storage or regenerate the ApprovedFrame.",
    },
    tags: [
      "approved_frame_read_failed",
      "vj_0_read_gate_unresolved",
      "runtime_render_blocked",
    ],
  }
}

function buildRuntimeRenderGate(
  approvedFrame: WorldVisualApprovedFrame,
  approvedFrameRecordCanShowToPlayer: boolean
) {
  const hardFieldsValid = approvedFrameHardFieldsValid(approvedFrame)
  const canRuntimeRender =
    approvedFrameRecordCanShowToPlayer === true &&
    approvedFrame.canShowToPlayer === true &&
    hardFieldsValid

  return {
    approvedFrameRecordCanShowToPlayer,
    approvedFrameCanShowToPlayer: approvedFrame.canShowToPlayer,
    hardFieldsValid,
    sourceImageSha256Bound:
      typeof approvedFrame.sourceImageSha256 === "string" &&
      approvedFrame.sourceImageSha256.length === 64,
    sourceImageByteLengthBound:
      typeof approvedFrame.sourceImageByteLength === "number" &&
      approvedFrame.sourceImageByteLength > 0,
    sourceImageContentTypeBound:
      typeof approvedFrame.sourceImageContentType === "string" &&
      isApprovedContentType(approvedFrame.sourceImageContentType),
    sourceImagePayloadQualityPassed:
      approvedFrame.sourceImagePayloadQualityPassed === true,
    canRuntimeRender,
    displayRule:
      "Runtime Render 只能展示 ApprovedFrameRecord 与 ApprovedFrame 同时允许展示，并且 sha256 / byteLength / contentType / payloadQualityPassed 全部有效的图片。",
    displayRuleEn:
      "Runtime Render may only display an image when both ApprovedFrameRecord and ApprovedFrame allow display, and sha256 / byteLength / contentType / payloadQualityPassed are all valid.",
    tags: [
      "runtime_render_gate",
      hardFieldsValid ? "hard_fields_valid" : "hard_fields_invalid",
      canRuntimeRender ? "runtime_render_allowed" : "runtime_render_blocked",
    ],
  }
}

function approvedFrameHardFieldsValid(
  approvedFrame: WorldVisualApprovedFrame
): boolean {
  return (
    typeof approvedFrame.sourceImageSha256 === "string" &&
    approvedFrame.sourceImageSha256.length === 64 &&
    typeof approvedFrame.sourceImageByteLength === "number" &&
    approvedFrame.sourceImageByteLength > 0 &&
    typeof approvedFrame.sourceImageContentType === "string" &&
    isApprovedContentType(approvedFrame.sourceImageContentType) &&
    approvedFrame.sourceImagePayloadQualityPassed === true
  )
}

function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

function buildImageUrlAudit(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return {
      scheme: "data:image",
      allowed: true,
      canBeFetchedByRuntimeRender: true,
      reason: "data_image_url_allowed",
      reasonZh: "ApprovedFrame 使用 data:image URL，Runtime Render 可以展示。",
      reasonEn:
        "The ApprovedFrame uses a data:image URL. Runtime Render can display it.",
      tags: ["image_url_audit", "data_image_url_allowed"],
    }
  }

  try {
    const url = new URL(imageUrl)
    const allowed = url.protocol === "http:" || url.protocol === "https:"

    return {
      scheme: url.protocol.replace(":", ""),
      allowed,
      canBeFetchedByRuntimeRender: allowed,
      reason: allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      reasonZh: allowed
        ? "ApprovedFrame 使用 http/https URL，Runtime Render 可以尝试展示。"
        : "ApprovedFrame imageUrl 协议不被允许。",
      reasonEn: allowed
        ? "The ApprovedFrame uses an http/https URL. Runtime Render can try displaying it."
        : "The ApprovedFrame imageUrl uses a disallowed scheme.",
      tags: [
        "image_url_audit",
        allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      ],
    }
  } catch {
    return {
      scheme: "invalid",
      allowed: false,
      canBeFetchedByRuntimeRender: false,
      reason: "invalid_image_url",
      reasonZh: "ApprovedFrame imageUrl 不是有效 URL。",
      reasonEn: "The ApprovedFrame imageUrl is not a valid URL.",
      tags: ["image_url_audit", "invalid_image_url"],
    }
  }
}
