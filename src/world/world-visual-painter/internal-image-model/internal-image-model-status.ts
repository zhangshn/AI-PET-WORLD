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

  // A local image and a latest pointer are not proof of model inference: they
  // can be fixtures, resized legacy assets, or copied artifacts.  A model is
  // eligible only when its immutable manifest explicitly records the local
  // checkpoint-forward execution contract and its evidence binding.
  if (!hasManifest) {
    return {
      ok: false,
      reasonZh:
        "缺少真实本地模型推理 manifest；latest.json 或 generated.png 不能替代模型执行证据。",
      reasonEn:
        "The real local model-inference manifest is missing; latest.json or generated.png cannot substitute for execution evidence.",
      tags: [
        "model_manifest_missing",
        hasLocalInferenceOutput ? "local_output_without_inference_evidence" : "local_inference_output_missing",
        "development_fixture_only",
      ],
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

  const manifestAudit = readRealInferenceManifest(manifestPath)
  if (!manifestAudit.ok) return manifestAudit
  if (!hasLocalInferenceOutput) {
    return {
      ok: false,
      reasonZh: "真实模型 manifest 已存在，但尚未绑定可读取的本地推理输出。",
      reasonEn: "The real-model manifest exists, but no readable local inference output is bound yet.",
      tags: ["real_inference_output_missing", "generation_blocked"],
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
    reasonZh: "真实本地模型前向推理证据和输出资产已就绪。",
    reasonEn: "Real local model forward-inference evidence and output assets are ready.",
    tags: [
      "model_asset_dir_present",
      "model_manifest_present",
      "real_local_checkpoint_forward_evidence",
      "local_inference_output_present",
    ],
  }
}

function readRealInferenceManifest(manifestPath: string): {
  ok: boolean
  reasonZh: string
  reasonEn: string
  tags: string[]
} {
  try {
    const value = JSON.parse(readFileSync(/* turbopackIgnore: true */ manifestPath, "utf8")) as {
      schemaVersion?: unknown
      inference?: {
        kind?: unknown
        executionEvidence?: unknown
        entrypoint?: unknown
        checkpointSha256?: unknown
      }
      weights?: { sha256?: unknown }
    }
    const inference = value.inference
    const checkpointSha256 = inference?.checkpointSha256 ?? value.weights?.sha256
    if (
      value.schemaVersion !== "ai-painter-real-local-inference-manifest-v1" ||
      inference?.kind !== "local_checkpoint_forward" ||
      inference.executionEvidence !== "recorded" ||
      typeof inference.entrypoint !== "string" ||
      !inference.entrypoint.trim() ||
      typeof checkpointSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(checkpointSha256)
    ) {
      return {
        ok: false,
        reasonZh: "模型 manifest 没有完整的本地 Checkpoint 前向推理证据绑定。",
        reasonEn: "The model manifest lacks a complete local-checkpoint forward-inference evidence binding.",
        tags: ["real_inference_evidence_missing", "development_fixture_only"],
      }
    }
    return { ok: true, reasonZh: "", reasonEn: "", tags: [] }
  } catch {
    return {
      ok: false,
      reasonZh: "模型 manifest 无法解析，不能证明真实推理。",
      reasonEn: "The model manifest cannot be parsed, so real inference cannot be proven.",
      tags: ["model_manifest_unreadable", "real_inference_evidence_missing"],
    }
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
