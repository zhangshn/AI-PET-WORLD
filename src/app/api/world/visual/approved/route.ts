import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { readLatestWorldVisualApprovedFrameRecord } from "@/world/world-visual-painter"

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
  const controlSketch = request?.body.controlSketch ?? null
  const visualFixHints = request?.body.visualFixHints ?? []

  return NextResponse.json(
    {
      ok: true,
      status: approvedFrameReadResult.status,
      record,
      runtimeRenderGate: {
        approvedFrameRecordCanShowToPlayer: record.canShowToPlayer,
        approvedFrameCanShowToPlayer: record.approvedFrame.canShowToPlayer,
        canRuntimeRender:
          record.canShowToPlayer === true &&
          record.approvedFrame.canShowToPlayer === true,
        displayRule:
          "Runtime Render 只能展示 ApprovedFrameRecord 和 ApprovedFrame 同时允许展示的图片。",
        displayRuleEn:
          "Runtime Render may only display an image when both ApprovedFrameRecord and ApprovedFrame allow display.",
      },
      provenance: {
        frameId: record.approvedFrame.frameId,
        sourceAiImageCandidateId: record.sourceAiImageCandidateId,
        sourcePromptPackageId: record.sourcePromptPackageId,
        sourceAiImageGenerationRequestId:
          record.sourceAiImageGenerationRequestId,
        sourceControlSketchId: record.sourceControlSketchId,
        sourceVisualFixPlanId: record.sourceVisualFixPlanId,
        sourceVisualFixHintCount: record.sourceVisualFixHintCount,
        sourceFactIds: record.sourceFactIds,
        reviewScore: record.approvedFrame.reviewScore,
        imageFormat: record.approvedFrame.imageFormat,
        width: record.approvedFrame.width,
        height: record.approvedFrame.height,
        sourceImageSha256: record.approvedFrame.sourceImageSha256,
        sourceImageByteLength: record.approvedFrame.sourceImageByteLength,
        sourceImageContentType: record.approvedFrame.sourceImageContentType,
        sourceImagePayloadQualityPassed:record.approvedFrame.sourceImagePayloadQualityPassed,
      },
      sourceCandidateAudit: {
        candidateId: record.sourceCandidateRecord.candidate.candidateId,
        candidateCanShowToPlayer:
          record.sourceCandidateRecord.candidate.canShowToPlayer,
        candidateProviderKind:
          record.sourceCandidateRecord.candidate.providerKind,
        candidateLicense: record.sourceCandidateRecord.candidate.license,
        originalityConfirmed:
          record.sourceCandidateRecord.candidate.originalityConfirmed,
        hasPromptPackage: Boolean(record.sourceCandidateRecord.promptPackage),
        hasAiImageGenerationRequest: Boolean(request),
        hasControlSketch: Boolean(controlSketch),
        controlSketchCanShowToPlayer: controlSketch?.canShowToPlayer ?? null,
        controlSketchCannotApprove: controlSketch?.cannotApprove ?? null,
        hasVisualFixHints: visualFixHints.length > 0,
        visualFixHints: visualFixHints.map((hint) => ({
          sourceCheckId: hint.sourceCheckId,
          actionType: hint.actionType,
          priority: hint.priority,
          changesWorldFacts: hint.changesWorldFacts,
          instructionZh: hint.instructionZh,
          instructionEn: hint.instructionEn,
          expectedResultZh: hint.expectedResultZh,
          expectedResultEn: hint.expectedResultEn,
          tags: hint.tags,
        })),
      },
      reviewAudit: {
        status: record.reviewReport.status,
        score: record.reviewReport.score,
        canShowToPlayer: record.reviewReport.canShowToPlayer,
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
      canShowToPlayer:
        record.canShowToPlayer === true &&
        record.approvedFrame.canShowToPlayer === true,
      nextStep: {
        zh: "该 ApprovedFrame 可供 /world Runtime Render 读取展示；不得由前端重新生成或修改画面。",
        en: "This ApprovedFrame may be read by /world Runtime Render for display. The frontend must not regenerate or modify the frame.",
      },
      tags: [
        "world_visual_approved_api",
        "approved_frame_only",
        "provenance_exposed_for_audit",
        "runtime_render_gate_checked",
        ...approvedFrameReadResult.tags,
      ],
    },
    { status: 200 }
  )
}