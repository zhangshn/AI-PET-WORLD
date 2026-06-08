import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  readLatestWorldVisualApprovedFrameRecord,
  readLatestWorldVisualCandidateRecord,
  readLatestWorldVisualFixPlanRecord,
  readWorldVisualAiImageProviderStatus,
} from "@/world/world-visual-painter"

const REQUIRED_RESPONSE_SHAPE = [
  "imageUrl",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

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
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
        canShowToPlayer: false,
        runtimeRenderGate: {
          canRuntimeRender: false,
          reason: "runtime_world_missing",
          reasonZh: "世界尚未创建，Runtime Render 必须阻断。",
          reasonEn:
            "Runtime world is missing, so Runtime Render must remain blocked.",
        },
        nextStep: {
          zh: "先创建世界，再读取视觉链路状态。",
          en: "Create the world first, then read visual pipeline status.",
          endpoint: "/create-world",
        },
        tags: [
          "world_visual_status_api",
          "runtime_save_required",
          "display_blocked",
        ],
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
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
      pipeline: {
        candidate: {
          status: candidateReadResult.status,
          exists: Boolean(candidateRecord),
          candidateId: candidateRecord?.candidate.candidateId ?? null,
          providerKind: candidateRecord?.candidate.providerKind ?? null,
          canShowToPlayer: candidateRecord?.candidate.canShowToPlayer ?? null,
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
          imageUrl: approvedFrame?.imageUrl ?? null,
          imageUrlAudit: buildImageUrlAudit(approvedFrame?.imageUrl ?? null),
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
      generationAcceptanceChecklist: buildGenerationAcceptanceChecklist({
        providerKind: providerStatus.providerKind,
        providerConfigured: providerStatus.configured,
        canGenerateAutomatically: providerStatus.canGenerateAutomatically,
        canUseManualImport: providerStatus.canUseManualImport,
        hasCandidate: Boolean(candidateRecord),
        hasFixPlan: Boolean(fixPlanRecord),
        hasApprovedFrame: Boolean(approvedFrameRecord),
        canRuntimeRender,
      }),
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
        "required_response_shape_exposed",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: 200 }
  )
}

function buildImageUrlAudit(imageUrl: string | null) {
  if (!imageUrl) {
    return {
      scheme: null,
      allowed: false,
      canBeFetchedByRuntimeRender: false,
      reason: "missing_image_url",
      reasonZh: "当前没有 ApprovedFrame imageUrl。",
      reasonEn: "There is no ApprovedFrame imageUrl.",
      tags: ["image_url_audit", "missing_image_url"],
    }
  }

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

function buildGenerationAcceptanceChecklist(input: {
  providerKind: string
  providerConfigured: boolean
  canGenerateAutomatically: boolean
  canUseManualImport: boolean
  hasCandidate: boolean
  hasFixPlan: boolean
  hasApprovedFrame: boolean
  canRuntimeRender: boolean
}) {
  const localModelSelected = input.providerKind === "local_model"

  return [
    {
      id: "provider_selected",
      passed: input.providerKind !== "not_configured",
      zh: "图像生成入口类型已选择。",
      en: "Image generation provider kind is selected.",
      endpoint: "GET /api/world/visual/provider",
      requiredBeforeGenerate: true,
      tags: [
        "provider",
        input.providerKind !== "not_configured" ? "passed" : "pending",
      ],
    },
    {
      id: "provider_configured",
      passed: input.providerConfigured,
      zh: "图像生成入口已配置。",
      en: "Image generation provider is configured.",
      endpoint: "GET /api/world/visual/provider",
      requiredBeforeGenerate: true,
      tags: ["provider", input.providerConfigured ? "passed" : "pending"],
    },
    {
      id: "required_response_shape_known",
      passed: true,
      zh: "正式视觉链路要求 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "The formal visual pipeline requires imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      endpoint: "GET /api/world/visual/provider",
      requiredBeforeGenerate: true,
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
      tags: ["response_contract", "passed"],
    },
    {
      id: "local_model_health_required",
      passed: !localModelSelected,
      zh: localModelSelected
        ? "当前使用 local_model，生成前需要先调用 provider-health。"
        : "当前不是 local_model，不需要本地图像模型 health 检查。",
      en: localModelSelected
        ? "local_model is selected, so provider-health should be called before generation."
        : "The current provider is not local_model, so local model health is not required.",
      endpoint: localModelSelected
        ? "GET /api/world/visual/provider-health"
        : null,
      requiredBeforeGenerate: localModelSelected,
      tags: [
        "provider_health",
        localModelSelected ? "local_model" : "not_local_model",
        localModelSelected ? "pending_external_check" : "not_required",
      ],
    },
    {
      id: "local_model_dry_run_required",
      passed: !localModelSelected,
      zh: localModelSelected
        ? "当前使用 local_model，生成前需要先调用 provider-dry-run 确认 6 个返回字段。"
        : "当前不是 local_model，不需要本地图像模型 dry-run。",
      en: localModelSelected
        ? "local_model is selected, so provider-dry-run should be called before generation to confirm the six response fields."
        : "The current provider is not local_model, so local model dry-run is not required.",
      endpoint: localModelSelected
        ? "GET /api/world/visual/provider-dry-run"
        : null,
      requiredBeforeGenerate: localModelSelected,
      requiredResponseShape: localModelSelected ? REQUIRED_RESPONSE_SHAPE : null,
      tags: [
        "provider_dry_run",
        localModelSelected ? "local_model" : "not_local_model",
        localModelSelected ? "pending_external_check" : "not_required",
      ],
    },
    {
      id: "candidate_generated",
      passed: input.hasCandidate,
      zh: "隐藏 AiImageCandidate 已生成并保存。",
      en: "Hidden AiImageCandidate has been generated and persisted.",
      endpoint:
        input.canGenerateAutomatically || input.canUseManualImport
          ? "POST /api/world/visual/generate"
          : "GET /api/world/visual/provider",
      requiredBeforeGenerate: false,
      tags: ["candidate", input.hasCandidate ? "passed" : "pending"],
    },
    {
      id: "visual_judge_ran",
      passed: input.hasFixPlan || input.hasApprovedFrame,
      zh: "VisualJudge 已经运行，产生 VisualFixPlan 或 ApprovedFrame。",
      en: "VisualJudge has run and produced either VisualFixPlan or ApprovedFrame.",
      endpoint: input.hasCandidate ? "POST /api/world/visual/judge" : null,
      requiredBeforeGenerate: false,
      tags: [
        "visual_judge",
        input.hasFixPlan || input.hasApprovedFrame ? "passed" : "pending",
      ],
    },
    {
      id: "approved_frame_ready",
      passed: input.hasApprovedFrame,
      zh: "ApprovedFrame 已生成。",
      en: "ApprovedFrame has been created.",
      endpoint: "GET /api/world/visual/approved",
      requiredBeforeGenerate: false,
      tags: ["approved_frame", input.hasApprovedFrame ? "passed" : "pending"],
    },
    {
      id: "runtime_render_ready",
      passed: input.canRuntimeRender,
      zh: "Runtime Render 可以展示 ApprovedFrame。",
      en: "Runtime Render may display ApprovedFrame.",
      endpoint: "/world",
      requiredBeforeGenerate: false,
      tags: [
        "runtime_render",
        input.canRuntimeRender ? "passed" : "blocked",
      ],
    },
  ]
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
    if (input.providerKind === "local_model") {
      return {
        zh: "当前已选择 local_model，但入口尚未配置完成。下一步检查 GET /api/world/visual/provider，并配置真实 local image model endpoint。",
        en: "local_model is selected, but the entry is not fully configured. Next check GET /api/world/visual/provider and configure a real local image model endpoint.",
        endpoint: "GET /api/world/visual/provider",
        requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
      }
    }

    return {
      zh: "图像生成入口尚未配置。下一步查看 GET /api/world/visual/provider。",
      en: "The image generation entry is not configured yet. Next check GET /api/world/visual/provider.",
      endpoint: "GET /api/world/visual/provider",
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
    }
  }

  if (input.providerKind === "local_model" && !input.hasCandidate) {
    return {
      zh: "本地图像模型入口已配置。下一步先检查 GET /api/world/visual/provider-health 和 GET /api/world/visual/provider-dry-run，确认模型理解正式请求契约并会返回 6 个字段，再调用 generate。",
      en: "The local image model entry is configured. Next check GET /api/world/visual/provider-health and GET /api/world/visual/provider-dry-run to confirm it understands the formal request contract and will return the six fields, then call generate.",
      endpoint: "GET /api/world/visual/provider-health",
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
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
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
    }
  }

  if (!input.hasCandidate) {
    return {
      zh: "还没有隐藏候选图，但当前 provider 不可生成也不可授权导入。先检查 provider 配置。",
      en: "No hidden candidate exists, but the current provider cannot generate or import. Check provider configuration first.",
      endpoint: "GET /api/world/visual/provider",
      requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
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
    requiredResponseShape: REQUIRED_RESPONSE_SHAPE,
  }
}