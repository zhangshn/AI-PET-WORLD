import { NextResponse } from "next/server"

const DEFAULT_ENGINE_TIMEOUT_MS = 120_000
const MIN_ENGINE_TIMEOUT_MS = 10_000
const MAX_ENGINE_TIMEOUT_MS = 600_000

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

export async function GET() {
  const engineEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT?.trim() ?? null
  const engineApiKeyConfigured = Boolean(
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY?.trim()
  )
  const configuredEngineLicense =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE?.trim() ?? null
  const configuredOriginalityConfirmed =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED === "true"
  const configuredRequestMode =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE?.trim() ??
    "world_visual_body"
  const engineTimeoutMs = readEngineTimeoutMs()

  const engineConfigured = Boolean(engineEndpoint)

  return NextResponse.json(
    {
      ok: engineConfigured,
      status: engineConfigured
        ? "local_image_model_adapter_ready"
        : "local_image_engine_missing",
      model: "ai-pet-world-local-image-model-adapter",
      version: "mvp-adapter-1",
      supportsWorldVisualPainter: true,
      supportsResponseContract: true,
      supportsHiddenCandidateOutput: true,
      supportsPng: true,
      supportsWebp: true,
      supportsJpg: true,
      engine: {
      configured: engineConfigured,
      endpointConfigured: engineConfigured,
      apiKeyConfigured: engineApiKeyConfigured,
      licenseDefaultConfigured:
        configuredEngineLicense === "self_owned" ||
        configuredEngineLicense === "cc0" ||
        configuredEngineLicense === "commercial_license",
      originalityDefaultConfirmed: configuredOriginalityConfirmed,
      requestMode: configuredRequestMode,
      timeoutMs: engineTimeoutMs,
    },
      engineIntegrationContract: {
        endpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT",
        apiKeyEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY",
        licenseDefaultEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE",
        originalityConfirmedDefaultEnv:
          "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED",
        requestModeEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE",
        timeoutMsEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS",
        timeoutRangeMs: {
          default: DEFAULT_ENGINE_TIMEOUT_MS,
          min: MIN_ENGINE_TIMEOUT_MS,
          max: MAX_ENGINE_TIMEOUT_MS,
        },
        supportedRequestModes: [
          "world_visual_body",
          "prompt_only",
          "prompt_package",
        ],
        method: "POST",
        requestContentType: "application/json",
        requestBody:
          "默认 world_visual_body 模式会收到完整 WorldVisualAiImageGenerationRequestBody；prompt_only 模式只收到 prompt、negativePrompt、width、height、imageFormat；prompt_package 模式会收到 prompt、PromptPackage、ControlSketch、VisualFixHints 与 metadata。",
        requestBodyEn:
          "By default, world_visual_body mode receives the full WorldVisualAiImageGenerationRequestBody. prompt_only mode receives prompt, negativePrompt, width, height, and imageFormat. prompt_package mode receives prompt, PromptPackage, ControlSketch, VisualFixHints, and metadata.",
        requiredResponseShape: {
        imageUrl:
          "http(s) URL or data:image URL. Alias supported: url. If imageUrl is missing, the adapter may build it from imageBase64/base64/b64_json plus imageFormat.",
        imageBase64:
          "optional real bitmap base64. Supported aliases: imageBase64, base64, b64_json.",
        imageFormat:
          "png | webp | jpg. Alias supported: format. The adapter also normalizes jpeg to jpg.",
        width: "number",
        height: "number",
        license: "self_owned | cc0 | commercial_license",
        originalityConfirmed: true,
              },
        supportedRawImageResponse: {
          contentTypes: ["image/png", "image/webp", "image/jpeg"],
          behavior:
            "The adapter converts raw image bytes into data:image URL and parses width/height before responseContract validation.",
        },
        supportedResponseContainers: [
          "direct fields",
          "result",
          "image",
          "output",
          "data[0]",
          "images[0]",
          "outputs[0]",
        ],
        hardRules: [
          {
            zh: "真实图像引擎必须生成真实 PNG/WebP/JPG 位图，不能返回 SVG、HTML、JSON、调试图、占位图或程序绘图结果。",
            en: "The real image engine must generate a real PNG/WebP/JPG bitmap, not SVG, HTML, JSON, debug images, placeholders, or programmatic render results.",
          },
          {
            zh: "真实图像引擎不能改写 WorldRuntimeSaveRecord，只能根据 PromptPackage、ControlSketch、VisualFixHints 改善视觉表达。",
            en: "The real image engine must not rewrite WorldRuntimeSaveRecord, and may only improve visual expression from PromptPackage, ControlSketch, and VisualFixHints.",
          },
          {
            zh: "真实图像引擎返回的图片只会进入隐藏 AiImageCandidate，必须通过 VisualJudge 和 ApprovedFrame 后才能展示。",
            en: "The returned image only enters hidden AiImageCandidate, and must pass VisualJudge and ApprovedFrame before display.",
          },
          {
            zh: "license 必须是 self_owned、cc0 或 commercial_license，originalityConfirmed 必须为 true。",
            en: "license must be self_owned, cc0, or commercial_license, and originalityConfirmed must be true.",
          },
          {
            zh: "如果真实图像引擎本身不返回 license 或 originalityConfirmed，适配层只会在显式配置 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE 与 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED=true 时补齐；否则生成会失败。",
            en: "If the real image engine does not return license or originalityConfirmed, the adapter only fills them when AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE and AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED=true are explicitly configured; otherwise generation fails.",
          },
          {
            zh: "如果真实图像引擎返回 base64，必须是真实 PNG/WebP/JPG 图片字节的 base64，适配层会转成 data:image URL 后交给 VisualJudge 审核。",
            en: "If the real image engine returns base64, it must be real PNG/WebP/JPG image bytes encoded as base64. The adapter will convert it into a data:image URL for VisualJudge review.",
          },
          {
            zh: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE 只改变发送给真实图像引擎的请求体形状，不改变 responseContract、VisualJudge 或 ApprovedFrame 硬闸门。",
            en: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE only changes the request body shape sent to the real image engine. It does not change responseContract, VisualJudge, or ApprovedFrame hard gates.",
          },
          {
            zh: "真实图像引擎可以直接返回 image/png、image/webp 或 image/jpeg 二进制；适配层会转成 data:image URL，并解析宽高后继续执行 responseContract 与 VisualJudge。",
            en: "The real image engine may return image/png, image/webp, or image/jpeg bytes directly. The adapter converts them into data:image URL, parses width and height, and then continues responseContract and VisualJudge.",
          },
        ],
      },
      message: engineConfigured
        ? "本地图像模型适配服务已就绪，已配置真实图像引擎入口。"
        : "本地图像模型适配服务存在，但还没有配置真实图像引擎 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT。",
      messageEn: engineConfigured
        ? "The local image model adapter is ready and the real image engine endpoint is configured."
        : "The local image model adapter exists, but AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT is not configured.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_health",
        "adapter_service",
        engineConfigured ? "engine_configured" : "engine_missing",
        "engine_contract_exposed",
        "does_not_generate",
        "not_player_visible",
      ],
    },
    { status: engineConfigured ? 200 : 503 }
  )
}