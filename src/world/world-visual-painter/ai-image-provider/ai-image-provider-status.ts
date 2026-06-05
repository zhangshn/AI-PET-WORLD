import type { WorldVisualAiImageProviderStatus } from "../world-visual-painter-schema"

export function readWorldVisualAiImageProviderStatus(): WorldVisualAiImageProviderStatus {
  const providerKind = process.env.AI_PET_WORLD_IMAGE_PROVIDER?.trim()

  if (providerKind === "manual_import") {
    return {
      providerKind: "manual_import",
      configured: true,
      canGenerateAutomatically: false,
      canUseManualImport: true,
      reason: {
        zh: "当前使用授权人工导入候选图流程。系统不会自动生成图片，只登记已确认授权的隐藏候选图。",
        en: "The authorized manual import flow is active. The system does not generate images automatically and only registers confirmed licensed hidden candidates.",
      },
      tags: ["ai_image_provider", "manual_import", "automatic_generation_disabled"],
    }
  }

  if (providerKind === "external_api") {
    const endpoint = process.env.AI_PET_WORLD_IMAGE_API_ENDPOINT?.trim()
    const apiKey = process.env.AI_PET_WORLD_IMAGE_API_KEY?.trim()
    const configured = Boolean(endpoint && apiKey)

    return {
      providerKind: "external_api",
      configured,
      canGenerateAutomatically: configured,
      canUseManualImport: false,
      reason: configured
        ? {
            zh: "外部 AI 图像生成 API 已配置，可以进入自动候选图生成阶段。",
            en: "External AI image generation API is configured and may produce automatic image candidates.",
          }
        : {
            zh: "外部 AI 图像生成 API 未配置完整，缺少 endpoint 或 api key，因此不能自动生成候选图。",
            en: "External AI image generation API is incomplete. Endpoint or API key is missing, so automatic candidate generation is blocked.",
          },
      tags: [
        "ai_image_provider",
        "external_api",
        configured ? "configured" : "missing_config",
      ],
    }
  }

  if (providerKind === "local_model") {
    const endpoint = process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT?.trim()
    const configured = Boolean(endpoint)

    return {
      providerKind: "local_model",
      configured,
      canGenerateAutomatically: configured,
      canUseManualImport: false,
      reason: configured
        ? {
            zh: "本地图像模型端点已配置，可以进入自动候选图生成阶段。",
            en: "Local image model endpoint is configured and may produce automatic image candidates.",
          }
        : {
            zh: "本地图像模型端点未配置，因此不能自动生成候选图。",
            en: "Local image model endpoint is missing, so automatic candidate generation is blocked.",
          },
      tags: [
        "ai_image_provider",
        "local_model",
        configured ? "configured" : "missing_config",
      ],
    }
  }

  return {
    providerKind: "not_configured",
    configured: false,
    canGenerateAutomatically: false,
    canUseManualImport: false,
    reason: {
      zh: "尚未配置图像生成供应商。系统会保持阻断，不会生成或展示候选图。",
      en: "No image generation provider is configured. The system remains blocked and will not generate or display candidates.",
    },
    tags: ["ai_image_provider", "not_configured", "display_blocked"],
  }
}
