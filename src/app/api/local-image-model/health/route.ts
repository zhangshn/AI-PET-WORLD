import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: "local_image_model_adapter_ready",
      model: "ai-pet-world-local-image-model-adapter",
      version: "mvp-adapter-1",
      supportsWorldVisualPainter: true,
      supportsResponseContract: true,
      supportsHiddenCandidateOutput: true,
      supportsPng: true,
      supportsWebp: true,
      supportsJpg: true,
      integrationContract: {
        method: "POST",
        requestContentType: "application/json",
        requestBody:
          "Receives the WorldVisualAiImageGenerationRequestBody from the formal visual pipeline.",
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
            zh: "返回结果必须是真实 PNG/WebP/JPG 位图，不能是 SVG、HTML、JSON、调试图、占位图或程序绘图结果。",
            en: "The response must be a real PNG/WebP/JPG bitmap, not SVG, HTML, JSON, debug images, placeholders, or programmatic render results.",
          },
          {
            zh: "返回结果只允许进入隐藏 AiImageCandidate，不能直接展示给玩家。",
            en: "The response may only enter hidden AiImageCandidate and must not be displayed directly to the player.",
          },
          {
            zh: "模型不得改写世界事实，只能根据 PromptPackage、ControlSketch、VisualFixHints 改善视觉表达。",
            en: "The model must not rewrite world facts, and may only improve visual expression from PromptPackage, ControlSketch, and VisualFixHints.",
          },
          {
            zh: "license 必须是 self_owned、cc0 或 commercial_license，originalityConfirmed 必须为 true。",
            en: "license must be self_owned, cc0, or commercial_license, and originalityConfirmed must be true.",
          },
          {
            zh: "返回结果必须通过 Runner responseContract 校验、VisualJudge 图片审核、ApprovedFrame 硬闸门后，/world 才能展示。",
            en: "The response must pass Runner responseContract validation, VisualJudge image review, and ApprovedFrame hard gate before /world can display it.",
          },
        ],
      },
      message:
        "本地图像模型适配入口已就绪。下一步应由正式视觉链路调用 generate，并校验 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      messageEn:
        "The local image model adapter entry is ready. Next, the formal visual pipeline should call generate and validate imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      canShowToPlayer: false,
      tags: [
        "local_image_model_health",
        "adapter_service",
        "contract_ready",
        "does_not_generate",
        "not_player_visible",
      ],
    },
    { status: 200 }
  )
}