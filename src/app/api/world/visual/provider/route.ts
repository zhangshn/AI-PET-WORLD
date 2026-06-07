import { NextResponse } from "next/server"

import { readWorldVisualAiImageProviderStatus } from "@/world/world-visual-painter"

export async function GET() {
  const providerStatus = readWorldVisualAiImageProviderStatus()

  const environmentAudit = {
    providerKind: providerStatus.providerKind,
    hasProviderKindEnv: Boolean(process.env.AI_PET_WORLD_IMAGE_PROVIDER?.trim()),
    hasExternalApiEndpoint: Boolean(
      process.env.AI_PET_WORLD_IMAGE_API_ENDPOINT?.trim()
    ),
    hasExternalApiKey: Boolean(process.env.AI_PET_WORLD_IMAGE_API_KEY?.trim()),
    hasLocalModelEndpoint: Boolean(
      process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT?.trim()
    ),
    hasManualImageUrl: Boolean(process.env.AI_PET_WORLD_MANUAL_IMAGE_URL?.trim()),
    hasManualImageWidth: Boolean(
      process.env.AI_PET_WORLD_MANUAL_IMAGE_WIDTH?.trim()
    ),
    hasManualImageHeight: Boolean(
      process.env.AI_PET_WORLD_MANUAL_IMAGE_HEIGHT?.trim()
    ),
    hasManualImageFormat: Boolean(
      process.env.AI_PET_WORLD_MANUAL_IMAGE_FORMAT?.trim()
    ),
    hasManualImageLicense: Boolean(
      process.env.AI_PET_WORLD_MANUAL_IMAGE_LICENSE?.trim()
    ),
    manualOriginalityConfirmed:
      process.env.AI_PET_WORLD_MANUAL_IMAGE_ORIGINALITY_CONFIRMED === "true",
  }

  return NextResponse.json(
    {
      ok: true,
      providerStatus,
      environmentAudit,
      generationGate: {
        canGenerateAutomatically: providerStatus.canGenerateAutomatically,
        canUseManualImport: providerStatus.canUseManualImport,
        configured: providerStatus.configured,
        reason: providerStatus.reason,
      },
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "Provider 状态只决定能否进入候选图生成或授权导入流程，不允许直接展示任何图片。",
        displayRuleEn:
          "Provider status only determines whether candidate generation or authorized import may start. It must not display any image directly.",
        noCandidateBypass:
          "即使 provider 已配置，返回结果也必须先保存为隐藏 AiImageCandidate，并通过 VisualJudge 后才能生成 ApprovedFrame。",
        noCandidateBypassEn:
          "Even when a provider is configured, its result must be persisted as a hidden AiImageCandidate and pass VisualJudge before ApprovedFrame can be created.",
      },
      nextStep: buildNextStep(providerStatus),
      canShowToPlayer: false,
      tags: [
        "world_visual_provider_api",
        providerStatus.providerKind,
        providerStatus.configured ? "configured" : "not_configured",
        providerStatus.canGenerateAutomatically
          ? "automatic_generation_available"
          : "automatic_generation_blocked",
        providerStatus.canUseManualImport
          ? "manual_import_available"
          : "manual_import_unavailable",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
        "not_player_visible",
      ],
    },
    { status: 200 }
  )
}

function buildNextStep(providerStatus: ReturnType<typeof readWorldVisualAiImageProviderStatus>) {
  if (providerStatus.canGenerateAutomatically) {
    return {
      zh: "图像生成入口已就绪。下一步调用 POST /api/world/visual/generate 生成隐藏候选图。",
      en: "The image generation entry is ready. Next call POST /api/world/visual/generate to create a hidden candidate.",
      endpoint: "POST /api/world/visual/generate",
    }
  }

  if (providerStatus.canUseManualImport) {
    return {
      zh: "授权导入流程已启用。下一步调用 POST /api/world/visual/generate 登记隐藏候选图。",
      en: "Authorized import flow is enabled. Next call POST /api/world/visual/generate to register a hidden candidate.",
      endpoint: "POST /api/world/visual/generate",
    }
  }

  return {
    zh: "当前没有可用图像生成入口，也没有启用授权导入流程。需要先配置 AI_PET_WORLD_IMAGE_PROVIDER。",
    en: "No image generation entry is available and authorized import flow is not enabled. Configure AI_PET_WORLD_IMAGE_PROVIDER first.",
    endpoint: null,
  }
}