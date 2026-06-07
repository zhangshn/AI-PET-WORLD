import { NextResponse } from "next/server"

export async function GET() {
  const engineEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT?.trim() ?? null
  const engineApiKeyConfigured = Boolean(
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY?.trim()
  )

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
        timeoutMs: 120000,
      },
      engineIntegrationContract: {
        endpointEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT",
        apiKeyEnv: "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_API_KEY",
        method: "POST",
        requestContentType: "application/json",
        requestBody:
          "真实图像引擎会收到完整的 WorldVisualAiImageGenerationRequestBody。",
        requestBodyEn:
          "The real image engine receives the full WorldVisualAiImageGenerationRequestBody.",
        requiredResponseShape: {
          imageUrl: "http(s) URL or data:image URL",
          imageFormat: "png | webp | jpg",
          width: "number",
          height: "number",
          license: "self_owned | cc0 | commercial_license",
          originalityConfirmed: true,
        },
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