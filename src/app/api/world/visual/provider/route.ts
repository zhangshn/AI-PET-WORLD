import { NextResponse } from "next/server"

import { readWorldVisualAiImageProviderStatus } from "@/world/world-visual-painter"

const DEFAULT_ENGINE_TIMEOUT_MS = 120_000
const MIN_ENGINE_TIMEOUT_MS = 10_000
const MAX_ENGINE_TIMEOUT_MS = 600_000

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

  const localImageEngineAudit = buildLocalImageEngineAudit()

  return NextResponse.json(
    {
      ok: true,
      providerStatus,
      environmentAudit,
      localImageEngineAudit,
      localModelIntegrationContract: {
        endpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT",
        healthEndpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_HEALTH_ENDPOINT",
        dryRunEndpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_MODEL_DRY_RUN_ENDPOINT",
        engineEndpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT",
        engineApiKeyEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY",
        engineLicenseDefaultEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE",
        engineOriginalityConfirmedDefaultEnv:
          "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED",
        engineRequestModeEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE",
        engineTimeoutMsEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS",
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
        engineRules: [
          {
            zh: "主项目调用 AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT；本地模型适配器再调用 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT。",
            en: "The main project calls AI_PET_WORLD_LOCAL_IMAGE_MODEL_ENDPOINT; the local model adapter then calls AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT.",
          },
          {
            zh: "真实图像引擎可以直接返回 imageUrl，也可以返回 base64 / b64_json，适配器会归一化后交给 Runner 与 VisualJudge。",
            en: "The real image engine may return imageUrl or base64 / b64_json. The adapter normalizes it before Runner and VisualJudge.",
          },
          {
            zh: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE 只改变发给真实引擎的请求体形状，不改变 responseContract、VisualJudge 或 ApprovedFrame 硬闸门。",
            en: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE only changes the request body shape sent to the real engine. It does not change responseContract, VisualJudge, or ApprovedFrame hard gates.",
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
    en: "No image generation entry is available and authorized import flow is not enabled. Configure AI_PET_WORLD_IMAGE_PROVIDER first.",
    endpoint: null,
  }
}

function buildLocalImageEngineAudit() {
  const engineEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT?.trim() ?? null
  const engineApiKeyConfigured = Boolean(
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY?.trim()
  )
  const configuredLicense =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE?.trim() ?? null
  const originalityConfirmed =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED === "true"
  const requestMode = readEngineRequestMode()
  const timeoutMs = readEngineTimeoutMs()
  const licenseDefaultConfigured = isAllowedEngineLicense(configuredLicense)

  return {
    engineEndpointConfigured: Boolean(engineEndpoint),
    engineApiKeyConfigured,
    licenseDefaultConfigured,
    configuredLicense: licenseDefaultConfigured ? configuredLicense : null,
    originalityDefaultConfirmed: originalityConfirmed,
    requestMode,
    timeoutMs,
    timeoutRangeMs: {
      default: DEFAULT_ENGINE_TIMEOUT_MS,
      min: MIN_ENGINE_TIMEOUT_MS,
      max: MAX_ENGINE_TIMEOUT_MS,
    },
    adapterGenerateReady: Boolean(engineEndpoint),
    safetyDefaultsReady:
      licenseDefaultConfigured && originalityConfirmed === true,
    note: {
      zh: "adapterGenerateReady 只代表适配器能调用真实引擎；最终图片仍必须通过 responseContract、VisualJudge 与 ApprovedFrame。",
      en: "adapterGenerateReady only means the adapter can call the real engine. The final image must still pass responseContract, VisualJudge, and ApprovedFrame.",
    },
    tags: [
      "local_image_engine_audit",
      engineEndpoint ? "engine_endpoint_configured" : "engine_endpoint_missing",
      engineApiKeyConfigured ? "engine_api_key_configured" : "engine_api_key_missing",
      licenseDefaultConfigured
        ? "engine_license_default_configured"
        : "engine_license_default_missing",
      originalityConfirmed
        ? "engine_originality_default_confirmed"
        : "engine_originality_default_missing",
      `request_mode_${requestMode}`,
    ],
  }
}

function readEngineRequestMode():
  | "world_visual_body"
  | "prompt_only"
  | "prompt_package" {
  const mode = process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE?.trim()

  if (
    mode === "world_visual_body" ||
    mode === "prompt_only" ||
    mode === "prompt_package"
  ) {
    return mode
  }

  return "world_visual_body"
}

function readEngineTimeoutMs(): number {
  const rawValue = process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS?.trim()
  const parsedValue = rawValue ? Number(rawValue) : DEFAULT_ENGINE_TIMEOUT_MS

  if (
    Number.isInteger(parsedValue) &&
    parsedValue >= MIN_ENGINE_TIMEOUT_MS &&
    parsedValue <= MAX_ENGINE_TIMEOUT_MS
  ) {
    return parsedValue
  }

  return DEFAULT_ENGINE_TIMEOUT_MS
}

function isAllowedEngineLicense(value: string | null): boolean {
  return (
    value === "self_owned" ||
    value === "cc0" ||
    value === "commercial_license"
  )
}