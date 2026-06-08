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
    hasLocalModelHealthEndpoint: Boolean(
      process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT?.trim()
    ),
    hasLocalModelDryRunEndpoint: Boolean(
      process.env.AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT?.trim()
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
      localModelIntegrationContract: {
        endpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT",
        healthEndpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT",
        dryRunEndpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT",
        providerEnv: "AI_PET_WORLD_IMAGE_PROVIDER=local_model",
        method: "POST",
        requestContentType: "application/json",
        requestBodyShape: {
          modelTask: {
            taskKind: "generate_hidden_world_bitmap_candidate",
            modelRole: "ai_image_generation_model",
            outputPurpose: "hidden_ai_image_candidate",
            worldFrameKind: "static_top_down_pixel_world_frame",
            mustReturnResponseContract: true,
            mustNotDisplayDirectly: true,
            mustNotRewriteWorldFacts: true,
            mustNotUseProgrammaticRenderer: true,
            mustNotCopyUnlicensedThirdPartyWorks: true,
            canShowToPlayer: false,
          },
          positivePrompt: "string",
          negativePrompt: "string",
          width: "number",
          height: "number",
          imageFormat: "png | webp | jpg",
          promptPackage: "WorldVisualPromptPackage excerpt",
          controlSketch: "composition_control_only, not player visible",
          outputSize: "requested output size",
          imageStyle: "top-down pixel world frame style target",
          safety: "hard visual safety flags",
          responseContract:
            "required response fields and display gate contract",
          visualFixHints:
            "previous VisualFix actions, empty array when not needed",
          metadata:
            "worldId, tick, promptPackageId, sourceFactIds, controlSketchId, visualFixPlanId",
        },
        requiredResponseShape: {
          imageUrl: "http(s) URL or data:image URL",
          imageFormat: "png | webp | jpg",
          width: "number",
          height: "number",
          license: "self_owned | cc0 | commercial_license",
          originalityConfirmed: "true",
        },
        responseRules: [
          {
            zh: "返回结果必须是真实 PNG/WebP/JPG 位图的 http、https 或 data:image URL，不能是本地文件路径、SVG、HTML、JSON、调试图或占位图。",
            en: "The response must point to a real PNG/WebP/JPG bitmap through an http, https, or data:image URL, not a local file path, SVG, HTML, JSON, debug image, or placeholder.",
          },
          {
            zh: "返回结果只会保存为隐藏 AiImageCandidate，不能直接展示给玩家。",
            en: "The response is only persisted as a hidden AiImageCandidate and must not be displayed directly.",
          },
          {
            zh: "模型不得改写世界事实，只能根据 PromptPackage、ControlSketch、VisualFixHints 改善视觉表达。",
            en: "The model must not rewrite world facts, and may only improve visual expression from PromptPackage, ControlSketch, and VisualFixHints.",
          },
          {
            zh: "模型必须确认授权与原创安全：license 必须是 self_owned、cc0 或 commercial_license，originalityConfirmed 必须为 true。",
            en: "The model must confirm license and originality safety: license must be self_owned, cc0, or commercial_license, and originalityConfirmed must be true.",
          },
          {
            zh: "返回结果必须通过 Runner responseContract 校验、VisualJudge 图片审核、ApprovedFrame 硬闸门后，/world 才能展示。",
            en: "The response must pass Runner responseContract validation, VisualJudge image review, and ApprovedFrame hard gate before /world can display it.",
          },
        ],
        endpointRules: [
          {
            zh: "正式生成会 POST 到 AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT。",
            en: "Formal generation posts to AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT.",
          },
          {
            zh: "health 优先读取 AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT；未配置时从主 endpoint 推导 /health。",
            en: "health prefers AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT; when missing, it derives /health from the main endpoint.",
          },
          {
            zh: "dry-run 优先读取 AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT；未配置时从主 endpoint 推导 /dry-run。",
            en: "dry-run prefers AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT; when missing, it derives /dry-run from the main endpoint.",
          },
        ],
      },
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
        "local_model_contract_exposed",
        "status_only",
        "does_not_generate",
        "does_not_modify_world_facts",
        "not_player_visible",
      ],
    },
    { status: 200 }
  )
}

function buildNextStep(
  providerStatus: ReturnType<typeof readWorldVisualAiImageProviderStatus>
) {
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
    en: "No image generation entry is available and authorized import flow is enabled. Configure AI_PET_WORLD_IMAGE_PROVIDER first.",
    endpoint: null,
  }
}