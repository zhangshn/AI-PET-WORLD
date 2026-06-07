import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import { readLatestWorldVisualCandidateRecord } from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取世界画面候选图。",
        messageEn:
          "Runtime world has not been created, so no world image candidate can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_candidate_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
  })

  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: candidateReadResult.status,
        message: "还没有隐藏候选图。需要先调用 /api/world/visual/generate。",
        messageEn:
          "No hidden candidate exists yet. Call /api/world/visual/generate first.",
        canShowToPlayer: false,
        displayRule: "没有隐藏候选图时，VisualJudge 不能运行，/world 也不能展示。",
        displayRuleEn:
          "Without a hidden candidate, VisualJudge cannot run and /world cannot display anything.",
        tags: ["world_visual_candidate_api", ...candidateReadResult.tags],
      },
      { status: candidateReadResult.status === "empty" ? 404 : 500 }
    )
  }

  const record = candidateReadResult.record
  const request = record.aiImageGenerationRequest
  const controlSketch = request?.body.controlSketch ?? null
  const visualFixHints = request?.body.visualFixHints ?? []

  return NextResponse.json(
    {
      ok: true,
      status: candidateReadResult.status,
      record,
      provenance: {
        candidateId: record.candidate.candidateId,
        providerKind: record.candidate.providerKind,
        promptPackageId: record.promptPackage.packageId,
        aiImageGenerationRequestId: request?.requestId ?? null,
        controlSketchId: controlSketch?.controlSketchId ?? null,
        visualFixPlanId: request?.body.metadata.visualFixPlanId ?? null,
        visualFixHintCount: visualFixHints.length,
        sourceFactIds: record.sourceFactIds,
        imageUrl: record.candidate.imageUrl,
        imageUrlAudit: buildImageUrlAudit(record.candidate.imageUrl),
        imageFormat: record.candidate.imageFormat,
        width: record.candidate.width,
        height: record.candidate.height,
        license: record.candidate.license,
        originalityConfirmed: record.candidate.originalityConfirmed,
        canShowToPlayer: record.candidate.canShowToPlayer,
      },
      generationInputAudit: {
        hasPromptPackage: Boolean(record.promptPackage),
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
        safety: request?.body.safety ?? null,
        imageStyle: request?.body.imageStyle ?? null,
        outputSize: request?.body.outputSize ?? null,
      },
      canShowToPlayer: false,
      displayRule: "候选图只供 VisualJudge 审核，不允许直接展示。",
      displayRuleEn:
        "The candidate is only for VisualJudge review and cannot be displayed directly.",
      nextStep: {
        zh: "下一步只能调用 /api/world/visual/judge。候选图通过 VisualJudge 后，才可能生成 ApprovedFrame。",
        en: "The next step is /api/world/visual/judge only. The candidate may become ApprovedFrame only after passing VisualJudge.",
      },
      tags: [
        "world_visual_candidate_api",
        "hidden_candidate_only",
        "provenance_exposed_for_audit",
        "not_player_visible",
        ...candidateReadResult.tags,
      ],
    },
    { status: 200 }
  )
}

function buildImageUrlAudit(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return {
      scheme: "data:image",
      allowed: true,
      canBeFetchedByVisualJudge: true,
      reason: "data_image_url_allowed",
      reasonZh: "候选图使用 data:image URL，VisualJudge 可以读取图片本体。",
      reasonEn:
        "The candidate uses a data:image URL. VisualJudge can read the image bytes.",
      tags: ["image_url_audit", "data_image_url_allowed"],
    }
  }

  try {
    const url = new URL(imageUrl)
    const allowed = url.protocol === "http:" || url.protocol === "https:"

    return {
      scheme: url.protocol.replace(":", ""),
      allowed,
      canBeFetchedByVisualJudge: allowed,
      reason: allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      reasonZh: allowed
        ? "候选图使用 http/https URL，VisualJudge 可以尝试读取图片本体。"
        : "候选图 imageUrl 协议不被允许。",
      reasonEn: allowed
        ? "The candidate uses an http/https URL. VisualJudge can try reading the image bytes."
        : "The candidate imageUrl uses a disallowed scheme.",
      tags: [
        "image_url_audit",
        allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      ],
    }
  } catch {
    return {
      scheme: "invalid",
      allowed: false,
      canBeFetchedByVisualJudge: false,
      reason: "invalid_image_url",
      reasonZh: "候选图 imageUrl 不是有效 URL。",
      reasonEn: "The candidate imageUrl is not a valid URL.",
      tags: ["image_url_audit", "invalid_image_url"],
    }
  }
}