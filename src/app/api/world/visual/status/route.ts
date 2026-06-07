import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
  readLatestWorldVisualFixPlanRecord,
  readWorldVisualAiImageProviderStatus,
} from "@/world/world-visual-painter"

export async function GET() {
  const runtimeReadResult = await readWorldRuntimeSaveRecord()

  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_missing",
        message: "世界尚未创建，不能读取视觉链路状态。",
        messageEn:
          "Runtime world has not been created, so visual pipeline status cannot be read.",
        readStatus: runtimeReadResult.status,
        canShowToPlayer: false,
        runtimeRenderGate: {
          canRuntimeRender: false,
          reason: "runtime_world_missing",
          reasonZh: "世界尚未创建，Runtime Render 必须阻断。",
          reasonEn:
            "Runtime world is missing, so Runtime Render must remain blocked.",
        },
        tags: ["world_visual_status_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const ownerId = runtimeReadResult.record.ownerId
  const worldId = runtimeReadResult.record.worldId
  const providerStatus = readWorldVisualAiImageProviderStatus()

  const [candidateReadResult, fixPlanReadResult, approvedFrameReadResult] =
    await Promise.all([
      readLatestWorldVisualCandidateRecord({ ownerId, worldId }),
      readLatestWorldVisualFixPlanRecord({ ownerId, worldId }),
      readLatestWorldVisualApprovedFrameRecord({ ownerId, worldId }),
    ])

  const candidateRecord = candidateReadResult.record
  const fixPlanRecord = fixPlanReadResult.record
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const canRuntimeRender =
    approvedFrameReadResult.status === "found" &&
    approvedFrameRecord?.canShowToPlayer === true &&
    approvedFrame?.canShowToPlayer === true

  return NextResponse.json(
    {
      ok: true,
      status: canRuntimeRender ? "runtime_render_ready" : "blocked",
    runtime: {
      ownerId,
      worldId,
      tick: runtimeReadResult.record.tick,
      hasRuntimeWorld: true,
    },
    provider: {
      providerKind: providerStatus.providerKind,
      configured: providerStatus.configured,
      canGenerateAutomatically: providerStatus.canGenerateAutomatically,
      canUseManualImport: providerStatus.canUseManualImport,
      reason: providerStatus.reason,
    },
    pipeline: {
        candidate: {
          status: candidateReadResult.status,
          exists: Boolean(candidateRecord),
          candidateId: candidateRecord?.candidate.candidateId ?? null,
          providerKind: candidateRecord?.candidate.providerKind ?? null,
          canShowToPlayer:
            candidateRecord?.candidate.canShowToPlayer ?? null,
          hasPromptPackage: Boolean(candidateRecord?.promptPackage),
          hasAiImageGenerationRequest: Boolean(
            candidateRecord?.aiImageGenerationRequest
          ),
          visualFixHintCount:
            candidateRecord?.aiImageGenerationRequest?.body.visualFixHints
              .length ?? 0,
          tags: candidateReadResult.tags,
        },
        fixPlan: {
          status: fixPlanReadResult.status,
          exists: Boolean(fixPlanRecord),
          planId: fixPlanRecord?.fixPlan.planId ?? null,
          planStatus: fixPlanRecord?.fixPlan.status ?? null,
          actionCount: fixPlanRecord?.fixPlan.actions.length ?? 0,
          changesWorldFacts:
            fixPlanRecord?.fixPlan.actions.some(
              (action) => action.changesWorldFacts
            ) ?? false,
          canShowToPlayer: fixPlanRecord?.fixPlan.canShowToPlayer ?? null,
          tags: fixPlanReadResult.tags,
        },
        approvedFrame: {
          status: approvedFrameReadResult.status,
          exists: Boolean(approvedFrameRecord),
          frameId: approvedFrame?.frameId ?? null,
          reviewScore: approvedFrame?.reviewScore ?? null,
          approvedFrameRecordCanShowToPlayer:
            approvedFrameRecord?.canShowToPlayer ?? null,
          approvedFrameCanShowToPlayer:
            approvedFrame?.canShowToPlayer ?? null,
          sourceAiImageCandidateId:
            approvedFrameRecord?.sourceAiImageCandidateId ?? null,
          sourcePromptPackageId:
            approvedFrameRecord?.sourcePromptPackageId ?? null,
          sourceAiImageGenerationRequestId:
            approvedFrameRecord?.sourceAiImageGenerationRequestId ?? null,
          sourceControlSketchId:
            approvedFrameRecord?.sourceControlSketchId ?? null,
          sourceVisualFixPlanId:
            approvedFrameRecord?.sourceVisualFixPlanId ?? null,
          sourceVisualFixHintCount:
            approvedFrameRecord?.sourceVisualFixHintCount ?? 0,
          sourceImageSha256: approvedFrame?.sourceImageSha256 ?? null,
          sourceImageByteLength: approvedFrame?.sourceImageByteLength ?? null,
          sourceImageContentType: approvedFrame?.sourceImageContentType ?? null,
          sourceImagePayloadQualityPassed:
            approvedFrame?.sourceImagePayloadQualityPassed ?? null,
          tags: approvedFrameReadResult.tags,
        },
      },
      runtimeRenderGate: {
        canRuntimeRender,
        required: [
          "approvedFrameReadResult.status === found",
          "approvedFrameRecord.canShowToPlayer === true",
          "approvedFrame.canShowToPlayer === true",
        ],
        actual: {
          approvedFrameReadStatus: approvedFrameReadResult.status,
          approvedFrameRecordCanShowToPlayer:
            approvedFrameRecord?.canShowToPlayer ?? null,
          approvedFrameCanShowToPlayer:
            approvedFrame?.canShowToPlayer ?? null,
        },
        displayRule: canRuntimeRender
          ? "Runtime Render 可以展示 latest ApprovedFrame。"
          : "Runtime Render 必须阻断，直到存在可展示的 ApprovedFrame。",
        displayRuleEn: canRuntimeRender
          ? "Runtime Render may display the latest ApprovedFrame."
          : "Runtime Render must remain blocked until a displayable ApprovedFrame exists.",
      },
      nextStep: buildNextStep({
        hasCandidate: Boolean(candidateRecord),
        hasFixPlan: Boolean(fixPlanRecord),
        canRuntimeRender,
        providerKind: providerStatus.providerKind,
        providerConfigured: providerStatus.configured,
        canGenerateAutomatically: providerStatus.canGenerateAutomatically,
        canUseManualImport: providerStatus.canUseManualImport,
      }),
      canShowToPlayer: canRuntimeRender,
      tags: [
        "world_visual_status_api",
        canRuntimeRender ? "runtime_render_ready" : "display_blocked",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: 200 }
  )
}

function buildNextStep(input: {
  hasCandidate: boolean
  hasFixPlan: boolean
  canRuntimeRender: boolean
  providerKind: string
  providerConfigured: boolean
  canGenerateAutomatically: boolean
  canUseManualImport: boolean
}) {
  if (input.canRuntimeRender) {
    return {
      zh: "视觉链路已生成可展示 ApprovedFrame，/world 可以读取并展示。",
      en: "The visual pipeline has a displayable ApprovedFrame. /world may read and display it.",
      endpoint: "/world",
    }
  }

  if (!input.providerConfigured) {
    return {
      zh: "图像生成入口尚未配置。下一步查看 GET /api/world/visual/provider。",
      en: "The image generation entry is not configured yet. Next check GET /api/world/visual/provider.",
      endpoint: "GET /api/world/visual/provider",
    }
  }

  if (input.providerKind === "local_model" && !input.hasCandidate) {
    return {
      zh: "本地图像模型已配置。下一步先检查 GET /api/world/visual/provider-health 和 GET /api/world/visual/provider-dry-run，再调用 generate。",
      en: "The local image model is configured. Next check GET /api/world/visual/provider-health and GET /api/world/visual/provider-dry-run, then call generate.",
      endpoint: "GET /api/world/visual/provider-health",
    }
  }

  if (
    !input.hasCandidate &&
    (input.canGenerateAutomatically || input.canUseManualImport)
  ) {
    return {
      zh: "还没有隐藏候选图。下一步调用 POST /api/world/visual/generate。",
      en: "No hidden candidate exists. Next call POST /api/world/visual/generate.",
      endpoint: "POST /api/world/visual/generate",
    }
  }

  if (!input.hasCandidate) {
    return {
      zh: "还没有隐藏候选图，但当前 provider 不可生成也不可授权导入。先检查 provider 配置。",
      en: "No hidden candidate exists, but the current provider cannot generate or import. Check provider configuration first.",
      endpoint: "GET /api/world/visual/provider",
    }
  }

  if (!input.hasFixPlan) {
    return {
      zh: "已有隐藏候选图。下一步调用 POST /api/world/visual/judge。",
      en: "A hidden candidate exists. Next call POST /api/world/visual/judge.",
      endpoint: "POST /api/world/visual/judge",
    }
  }

  return {
    zh: "已有 VisualFixPlan。下一步重新调用 POST /api/world/visual/generate，让修复提示进入下一次生成请求。",
    en: "A VisualFixPlan exists. Next call POST /api/world/visual/generate again so fix hints enter the next generation request.",
    endpoint: "POST /api/world/visual/generate",
  }
}