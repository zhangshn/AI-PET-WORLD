import type { WorldVisualImageModelStatus } from "../world-visual-painter-schema"

export function readWorldVisualImageModelStatus(): WorldVisualImageModelStatus {
  const enabled = process.env.AI_PET_WORLD_IMAGE_MODEL_ENABLED === "true"
  const modelVersion = process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION?.trim() || null
  const modelAssetDir = process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR?.trim()

  if (!enabled) {
    return {
      status: "disabled",
      modelVersion,
      canGenerate: false,
      reason: {
        zh: "项目内部世界图像生成模型尚未启用。当前只允许继续建设条件协议、训练数据和模型实现。",
        en: "The project's internal world image generation model is disabled. Only condition contracts, training data, and model implementation work may continue.",
      },
      tags: ["internal_image_model", "disabled", "generation_blocked"],
    }
  }

  if (!modelVersion || !modelAssetDir) {
    return {
      status: "not_implemented",
      modelVersion,
      canGenerate: false,
      reason: {
        zh: "项目内部模型缺少模型版本或资产目录，不能生成世界候选图。",
        en: "The internal model is missing its model version or asset directory and cannot generate a world candidate.",
      },
      tags: ["internal_image_model", "not_implemented", "generation_blocked"],
    }
  }

  return {
    status: "ready",
    modelVersion,
    canGenerate: true,
    reason: {
      zh: "项目内部世界图像生成模型配置已就绪。",
      en: "The project's internal world image generation model configuration is ready.",
    },
    tags: ["internal_image_model", "ready"],
  }
}
