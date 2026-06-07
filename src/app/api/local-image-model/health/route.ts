import { NextResponse } from "next/server"

export async function GET() {
  const engineEndpoint =
    process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT?.trim() ?? null

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
      },
      message: engineConfigured
        ? "本地图像模型适配服务已就绪。"
        : "本地图像模型适配服务存在，但还没有配置真实图像引擎 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT。",
      messageEn: engineConfigured
        ? "The local image model adapter is ready."
        : "The local image model adapter exists, but AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT is not configured.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_health",
        "adapter_service",
        engineConfigured ? "engine_configured" : "engine_missing",
        "does_not_generate",
        "not_player_visible",
      ],
    },
    { status: engineConfigured ? 200 : 503 }
  )
}