import { existsSync, statSync } from "node:fs"
import path from "node:path"

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

  const assetAudit = auditInternalModelAssets(modelAssetDir)
  if (!assetAudit.ok) {
    return {
      status: "not_implemented",
      modelVersion,
      canGenerate: false,
      reason: {
        zh: `项目内部模型资产不完整：${assetAudit.reasonZh}`,
        en: `The internal model assets are incomplete: ${assetAudit.reasonEn}`,
      },
      tags: [
        "internal_image_model",
        "not_implemented",
        "generation_blocked",
        ...assetAudit.tags,
      ],
    }
  }

  return {
    status: "not_implemented",
    modelVersion,
    canGenerate: false,
    reason: {
      zh: "项目内部模型资产目录存在，但本项目推理实现尚未完成，不能生成世界候选图。",
      en: "The internal model asset directory exists, but project inference is not implemented and cannot generate a world candidate.",
    },
    tags: [
      "internal_image_model",
      "not_implemented",
      "generation_blocked",
      "model_assets_present",
      "inference_implementation_missing",
    ],
  }
}

function auditInternalModelAssets(modelAssetDir: string): {
  ok: boolean
  reasonZh: string
  reasonEn: string
  tags: string[]
} {
  if (!path.isAbsolute(modelAssetDir)) {
    return {
      ok: false,
      reasonZh: "模型资产目录必须是绝对路径。",
      reasonEn: "The model asset directory must be an absolute path.",
      tags: ["model_asset_dir_not_absolute"],
    }
  }

  if (!existsSync(modelAssetDir)) {
    return {
      ok: false,
      reasonZh: "模型资产目录不存在。",
      reasonEn: "The model asset directory does not exist.",
      tags: ["model_asset_dir_missing"],
    }
  }

  const assetDirStat = statSync(modelAssetDir)
  if (!assetDirStat.isDirectory()) {
    return {
      ok: false,
      reasonZh: "模型资产路径不是目录。",
      reasonEn: "The model asset path is not a directory.",
      tags: ["model_asset_dir_not_directory"],
    }
  }

  const manifestPath = path.join(modelAssetDir, "model-manifest.json")
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      reasonZh: "缺少 model-manifest.json。",
      reasonEn: "model-manifest.json is missing.",
      tags: ["model_manifest_missing"],
    }
  }

  const manifestStat = statSync(manifestPath)
  if (!manifestStat.isFile()) {
    return {
      ok: false,
      reasonZh: "model-manifest.json 不是文件。",
      reasonEn: "model-manifest.json is not a file.",
      tags: ["model_manifest_not_file"],
    }
  }

  return {
    ok: true,
    reasonZh: "模型资产目录和清单存在。",
    reasonEn: "The model asset directory and manifest exist.",
    tags: ["model_asset_dir_present", "model_manifest_present"],
  }
}
