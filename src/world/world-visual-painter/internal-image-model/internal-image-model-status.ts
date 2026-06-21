import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { readFileSync } from "node:fs"

import type { WorldVisualImageModelStatus } from "../world-visual-painter-schema"

export function readWorldVisualImageModelStatus(): WorldVisualImageModelStatus {
  const enabled = process.env.AI_PET_WORLD_IMAGE_MODEL_ENABLED === "true"
  const modelVersion =
    process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION?.trim() || null
  const modelAssetDir = process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR?.trim()

  if (!enabled) {
    return {
      status: "disabled",
      modelVersion,
      canGenerate: false,
      reason: {
        zh: "项目内部世界图像生成模型尚未启用。当前只能继续训练数据、模型和审核链路建设。",
        en: "The project's internal world image generation model is disabled. Only training-data, model, and review-chain work may continue.",
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
    status: "ready",
    modelVersion,
    canGenerate: true,
    reason: {
      zh: "项目内部本地小模型输出已就绪，可以生成隐藏候选图；候选图仍必须通过 VisualJudge 后才能成为 ApprovedFrame。",
      en: "The local internal image-model output is ready and can produce a hidden candidate. It still must pass VisualJudge before becoming an ApprovedFrame.",
    },
    tags: [
      "internal_image_model",
      "ready",
      "model_assets_present",
      "local_project_model_output_ready",
      "visual_judge_required",
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

  if (!existsSync(/* turbopackIgnore: true */ modelAssetDir)) {
    return {
      ok: false,
      reasonZh: "模型资产目录不存在。",
      reasonEn: "The model asset directory does not exist.",
      tags: ["model_asset_dir_missing"],
    }
  }

  const assetDirStat = statSync(/* turbopackIgnore: true */ modelAssetDir)
  if (!assetDirStat.isDirectory()) {
    return {
      ok: false,
      reasonZh: "模型资产路径不是目录。",
      reasonEn: "The model asset path is not a directory.",
      tags: ["model_asset_dir_not_directory"],
    }
  }

  const manifestPath = path.join(modelAssetDir, "model-manifest.json")
  const latestPath = path.join(modelAssetDir, "latest.json")
  const generatedPath = path.join(modelAssetDir, "generated.png")
  const hasManifest = existsSync(/* turbopackIgnore: true */ manifestPath)
  const hasLocalInferenceOutput =
    existsSync(/* turbopackIgnore: true */ latestPath) &&
    (existsSync(/* turbopackIgnore: true */ generatedPath) || Boolean(readLatestGeneratedPath(latestPath)))

  if (!hasManifest && !hasLocalInferenceOutput) {
    return {
      ok: false,
      reasonZh:
        "缺少 model-manifest.json，且没有 latest.json + generated.png 本地推理输出。",
      reasonEn:
        "model-manifest.json is missing, and latest.json + generated.png local inference output is not present.",
      tags: ["model_manifest_or_local_inference_output_missing"],
    }
  }

  if (hasManifest && !statSync(/* turbopackIgnore: true */ manifestPath).isFile()) {
    return {
      ok: false,
      reasonZh: "model-manifest.json 不是文件。",
      reasonEn: "model-manifest.json is not a file.",
      tags: ["model_manifest_not_file"],
    }
  }

  if (existsSync(/* turbopackIgnore: true */ latestPath) && !statSync(/* turbopackIgnore: true */ latestPath).isFile()) {
    return {
      ok: false,
      reasonZh: "latest.json 不是文件。",
      reasonEn: "latest.json is not a file.",
      tags: ["latest_json_not_file"],
    }
  }

  if (existsSync(/* turbopackIgnore: true */ generatedPath) && !statSync(/* turbopackIgnore: true */ generatedPath).isFile()) {
    return {
      ok: false,
      reasonZh: "generated.png 不是文件。",
      reasonEn: "generated.png is not a file.",
      tags: ["generated_png_not_file"],
    }
  }

  const latestGeneratedPath = readLatestGeneratedPath(latestPath)
  if (
    latestGeneratedPath &&
    (!existsSync(/* turbopackIgnore: true */ latestGeneratedPath) ||
      !statSync(/* turbopackIgnore: true */ latestGeneratedPath).isFile())
  ) {
    return {
      ok: false,
      reasonZh: "latest.json 指向的 generated 图不存在或不是文件。",
      reasonEn: "The generated image referenced by latest.json does not exist or is not a file.",
      tags: ["latest_generated_image_missing"],
    }
  }

  return {
    ok: true,
    reasonZh: "模型资产目录和本地推理输出存在。",
    reasonEn: "The model asset directory and local inference output exist.",
    tags: [
      "model_asset_dir_present",
      hasManifest ? "model_manifest_present" : "local_inference_output_present",
    ],
  }
}

function readLatestGeneratedPath(latestPath: string): string | null {
  try {
    if (
      !existsSync(/* turbopackIgnore: true */ latestPath) ||
      !statSync(/* turbopackIgnore: true */ latestPath).isFile()
    ) {
      return null
    }
    const latest = JSON.parse(readFileSync(/* turbopackIgnore: true */ latestPath, "utf8")) as {
      generated?: unknown
      rows?: Array<{ generated?: unknown; diagnosisStatus?: unknown }>
    }
    if (typeof latest.generated === "string" && latest.generated.trim()) return latest.generated
    const passRow = latest.rows?.find(
      (row) => row.diagnosisStatus === "pass_candidate" && typeof row.generated === "string" && row.generated.trim(),
    )
    if (typeof passRow?.generated === "string") return passRow.generated
    const firstRow = latest.rows?.find((row) => typeof row.generated === "string" && row.generated.trim())
    return typeof firstRow?.generated === "string" ? firstRow.generated : null
  } catch {
    return null
  }
}
