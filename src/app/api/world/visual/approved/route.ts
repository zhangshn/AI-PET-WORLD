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
    return NextResponse.json(
      {
        ok: false,
        status: approvedFrameReadResult.status,
        message: "还没有 ApprovedFrame。需要先生成候选图并通过 VisualJudge。",
        messageEn:
          "No ApprovedFrame exists yet. Generate a candidate and pass VisualJudge first.",
        canShowToPlayer: false,
        displayRule: "没有 ApprovedFrame 时，/world 必须继续阻断。",
        displayRuleEn:
          "/world must remain blocked while no ApprovedFrame exists.",
        tags: ["world_visual_approved_api", ...approvedFrameReadResult.tags],
      },
      { status: approvedFrameReadResult.status === "empty" ? 404 : 500 }
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
