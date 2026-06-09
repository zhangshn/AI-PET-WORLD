// 当前文件作用：定义 AI-PET-WORLD 自研真实图像模型启用门禁；未满足资产、授权、原创确认与 manifest 契约前不允许进入真实出图。

import fs from "node:fs"
import path from "node:path"

import { ALLOWED_LICENSES } from "./contracts.mjs"
import { readAndValidateRealModelManifest } from "./real-model-manifest.mjs"

export const REAL_MODEL_ENV = {
  enabled: "AI_PET_WORLD_REAL_IMAGE_MODEL_ENABLED",
  assetDirectory: "AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR",
  manifestPath: "AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST",
  license: "AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE",
  originalityConfirmed: "AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED",
}

export function readRealImageModelReadiness(input = {}) {
  const config = readRealImageModelReadinessConfig(input)

  if (!config.enabled) {
    return buildReadinessFailure({
      status: "real_image_model_disabled",
      message:
        "真实自研图像模型尚未显式启用，因此 adapter 不能声明可生成真实图片。",
      messageEn:
        "The real in-house image model is not explicitly enabled, so the adapter cannot declare real image generation readiness.",
      config,
      tags: ["real_model_disabled"],
    })
  }

  if (!config.assetDirectory) {
    return buildReadinessFailure({
      status: "real_image_model_asset_directory_missing",
      message: `真实自研图像模型缺少 ${REAL_MODEL_ENV.assetDirectory} 配置。`,
      messageEn: `The real in-house image model is missing ${REAL_MODEL_ENV.assetDirectory}.`,
      config,
      tags: ["asset_directory_missing"],
    })
  }

  const assetDirectoryStat = readSafeStat(config.assetDirectory)

  if (!assetDirectoryStat.ok || !assetDirectoryStat.stat.isDirectory()) {
    return buildReadinessFailure({
      status: "real_image_model_asset_directory_invalid",
      message: "真实自研图像模型资产目录不存在或不是目录。",
      messageEn:
        "The real in-house image model asset directory does not exist or is not a directory.",
      config,
      tags: ["asset_directory_invalid"],
    })
  }

  if (!config.manifestPath) {
    return buildReadinessFailure({
      status: "real_image_model_manifest_missing",
      message: `真实自研图像模型缺少 ${REAL_MODEL_ENV.manifestPath} 配置。`,
      messageEn: `The real in-house image model is missing ${REAL_MODEL_ENV.manifestPath}.`,
      config,
      tags: ["manifest_missing"],
    })
  }

  const manifestStat = readSafeStat(config.manifestPath)

  if (!manifestStat.ok || !manifestStat.stat.isFile()) {
    return buildReadinessFailure({
      status: "real_image_model_manifest_invalid",
      message: "真实自研图像模型 manifest 不存在或不是文件。",
      messageEn:
        "The real in-house image model manifest does not exist or is not a file.",
      config,
      tags: ["manifest_invalid"],
    })
  }

  if (!ALLOWED_LICENSES.includes(config.license)) {
    return buildReadinessFailure({
      status: "real_image_model_license_invalid",
      message:
        "真实自研图像模型 license 不合法，只允许 self_owned / cc0 / commercial_license。",
      messageEn:
        "The real in-house image model license is invalid. Only self_owned / cc0 / commercial_license are allowed.",
      config,
      tags: ["license_invalid"],
    })
  }

  if (config.originalityConfirmed !== true) {
    return buildReadinessFailure({
      status: "real_image_model_originality_not_confirmed",
      message:
        "真实自研图像模型尚未确认 originalityConfirmed=true，因此不能进入正式出图链路。",
      messageEn:
        "The real in-house image model has not confirmed originalityConfirmed=true, so it cannot enter the formal generation chain.",
      config,
      tags: ["originality_not_confirmed"],
    })
  }

  const manifestValidation = readAndValidateRealModelManifest(config.manifestPath)

  if (!manifestValidation.ok) {
    return buildReadinessFailure({
      status: "real_image_model_manifest_contract_invalid",
      message: "真实自研图像模型 manifest 契约检查未通过。",
      messageEn:
        "The real in-house image model manifest contract check failed.",
      config,
      manifest: manifestValidation,
      tags: ["manifest_contract_invalid"],
    })
  }

  if (manifestValidation.license !== config.license) {
    return buildReadinessFailure({
      status: "real_image_model_manifest_license_mismatch",
      message: "真实自研图像模型 manifest license 与环境变量 license 不一致。",
      messageEn:
        "The real in-house image model manifest license does not match the environment license.",
      config,
      manifest: manifestValidation,
      tags: ["manifest_license_mismatch"],
    })
  }

  if (manifestValidation.originalityConfirmed !== config.originalityConfirmed) {
    return buildReadinessFailure({
      status: "real_image_model_manifest_originality_mismatch",
      message:
        "真实自研图像模型 manifest originalityConfirmed 与环境变量 originalityConfirmed 不一致。",
      messageEn:
        "The real in-house image model manifest originalityConfirmed does not match the environment originalityConfirmed.",
      config,
      manifest: manifestValidation,
      tags: ["manifest_originality_mismatch"],
    })
  }

  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: true,
    manifestConfigured: true,
    license: config.license,
    originalityConfirmed: true,
    manifest: manifestValidation,
    canRunInference: false,
    adapterConnected: false,
    message:
      "真实自研图像模型资产与 manifest 门禁已通过，但推理 runner 尚未接入，因此仍不能生成图片。",
    messageEn:
      "The real in-house image model asset and manifest gate passed, but the inference runner is not connected yet, so images still cannot be generated.",
    canShowToPlayer: false,
    tags: [
      "real_image_model_readiness",
      "assets_ready",
      "manifest_valid",
      "runner_not_connected",
      "does_not_generate",
      "not_player_visible",
    ],
  }
}

export function readRealImageModelReadinessConfig(input = {}) {
  const enabled = readBoolean(
    input.enabled ?? process.env[REAL_MODEL_ENV.enabled]
  )

  const assetDirectory = readOptionalResolvedPath(
    input.assetDirectory ?? process.env[REAL_MODEL_ENV.assetDirectory]
  )

  const manifestPath = readOptionalResolvedPath(
    input.manifestPath ?? process.env[REAL_MODEL_ENV.manifestPath],
    assetDirectory
  )

  const license =
    typeof input.license === "string" && input.license.trim()
      ? input.license.trim()
      : process.env[REAL_MODEL_ENV.license] ?? ""

  const originalityConfirmed = readBoolean(
    input.originalityConfirmed ??
      process.env[REAL_MODEL_ENV.originalityConfirmed]
  )

  return {
    enabled,
    assetDirectory,
    manifestPath,
    license,
    originalityConfirmed,
  }
}

function readBoolean(value) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value !== "string") {
    return false
  }

  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase())
}

function readOptionalResolvedPath(value, baseDirectory = null) {
  if (typeof value !== "string" || !value.trim()) {
    return ""
  }

  const trimmed = value.trim()

  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed)
  }

  if (baseDirectory) {
    return path.resolve(baseDirectory, trimmed)
  }

  return path.resolve(process.cwd(), trimmed)
}

function readSafeStat(targetPath) {
  try {
    return {
      ok: true,
      stat: fs.statSync(targetPath),
    }
  } catch {
    return {
      ok: false,
      stat: null,
    }
  }
}

function buildReadinessFailure(input) {
  return {
    ok: false,
    status: input.status,
    enabled: input.config.enabled,
    assetDirectoryConfigured: Boolean(input.config.assetDirectory),
    manifestConfigured: Boolean(input.config.manifestPath),
    license: input.config.license || null,
    originalityConfirmed: input.config.originalityConfirmed,
    manifest: input.manifest ?? null,
    canRunInference: false,
    adapterConnected: false,
    message: input.message,
    messageEn: input.messageEn,
    canShowToPlayer: false,
    tags: [
      "real_image_model_readiness",
      ...input.tags,
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}