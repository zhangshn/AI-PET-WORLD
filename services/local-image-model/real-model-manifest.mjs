// 当前文件作用：定义 AI-PET-WORLD 自研真实图像模型 manifest 契约；只有授权、原创与输出能力通过后才允许进入真实出图门禁。

import fs from "node:fs"

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
} from "./contracts.mjs"

export const REAL_MODEL_MANIFEST_SCHEMA_VERSION = "ai-pet-world-real-image-model-manifest-v1"

const ALLOWED_DATA_SOURCE_TYPES = [
  "self_owned",
  "cc0",
  "commercial_license",
  "mixed_allowed_sources",
]

export function readAndValidateRealModelManifest(manifestPath) {
  if (typeof manifestPath !== "string" || !manifestPath.trim()) {
    return buildManifestFailure({
      status: "real_model_manifest_path_missing",
      message: "真实模型 manifest 路径不能为空。",
      messageEn: "The real model manifest path cannot be empty.",
      tags: ["manifest_path_missing"],
    })
  }

  let rawContent

  try {
    rawContent = fs.readFileSync(manifestPath, "utf8")
  } catch {
    return buildManifestFailure({
      status: "real_model_manifest_read_failed",
      message: "无法读取真实模型 manifest 文件。",
      messageEn: "Failed to read the real model manifest file.",
      tags: ["manifest_read_failed"],
    })
  }

  let manifest

  try {
    manifest = JSON.parse(rawContent)
  } catch {
    return buildManifestFailure({
      status: "real_model_manifest_json_invalid",
      message: "真实模型 manifest 不是合法 JSON。",
      messageEn: "The real model manifest is not valid JSON.",
      tags: ["manifest_json_invalid"],
    })
  }

  return validateRealModelManifest(manifest)
}

export function validateRealModelManifest(manifest) {
  if (!isRecord(manifest)) {
    return buildManifestFailure({
      status: "real_model_manifest_invalid",
      message: "真实模型 manifest 必须是对象。",
      messageEn: "The real model manifest must be an object.",
      tags: ["manifest_not_object"],
    })
  }

  if (manifest.schemaVersion !== REAL_MODEL_MANIFEST_SCHEMA_VERSION) {
    return buildManifestFailure({
      status: "real_model_manifest_schema_version_invalid",
      message: `真实模型 manifest schemaVersion 必须是 ${REAL_MODEL_MANIFEST_SCHEMA_VERSION}。`,
      messageEn: `The real model manifest schemaVersion must be ${REAL_MODEL_MANIFEST_SCHEMA_VERSION}.`,
      tags: ["schema_version_invalid"],
    })
  }

  if (!isNonEmptyString(manifest.modelName)) {
    return buildManifestFailure({
      status: "real_model_manifest_model_name_missing",
      message: "真实模型 manifest 缺少 modelName。",
      messageEn: "The real model manifest is missing modelName.",
      tags: ["model_name_missing"],
    })
  }

  if (!isNonEmptyString(manifest.modelVersion)) {
    return buildManifestFailure({
      status: "real_model_manifest_model_version_missing",
      message: "真实模型 manifest 缺少 modelVersion。",
      messageEn: "The real model manifest is missing modelVersion.",
      tags: ["model_version_missing"],
    })
  }

  if (!ALLOWED_LICENSES.includes(manifest.license)) {
    return buildManifestFailure({
      status: "real_model_manifest_license_invalid",
      message:
        "真实模型 manifest license 不合法，只允许 self_owned / cc0 / commercial_license。",
      messageEn:
        "The real model manifest license is invalid. Only self_owned / cc0 / commercial_license are allowed.",
      tags: ["license_invalid"],
    })
  }

  if (!ALLOWED_DATA_SOURCE_TYPES.includes(manifest.dataSourceType)) {
    return buildManifestFailure({
      status: "real_model_manifest_data_source_invalid",
      message:
        "真实模型 manifest dataSourceType 不合法，只允许 self_owned / cc0 / commercial_license / mixed_allowed_sources。",
      messageEn:
        "The real model manifest dataSourceType is invalid. Only self_owned / cc0 / commercial_license / mixed_allowed_sources are allowed.",
      tags: ["data_source_invalid"],
    })
  }

  if (manifest.commercialUseAllowed !== true) {
    return buildManifestFailure({
      status: "real_model_manifest_commercial_use_not_allowed",
      message: "真实模型 manifest 尚未确认 commercialUseAllowed=true。",
      messageEn:
        "The real model manifest has not confirmed commercialUseAllowed=true.",
      tags: ["commercial_use_not_allowed"],
    })
  }

  if (manifest.originalityConfirmed !== true) {
    return buildManifestFailure({
      status: "real_model_manifest_originality_not_confirmed",
      message: "真实模型 manifest 尚未确认 originalityConfirmed=true。",
      messageEn:
        "The real model manifest has not confirmed originalityConfirmed=true.",
      tags: ["originality_not_confirmed"],
    })
  }

  if (manifest.unlicensedThirdPartyArtworkAllowed !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_unlicensed_third_party_not_blocked",
      message:
        "真实模型 manifest 必须明确 unlicensedThirdPartyArtworkAllowed=false。",
      messageEn:
        "The real model manifest must explicitly set unlicensedThirdPartyArtworkAllowed=false.",
      tags: ["unlicensed_third_party_not_blocked"],
    })
  }

  if (!isRecord(manifest.outputCapabilities)) {
    return buildManifestFailure({
      status: "real_model_manifest_output_capabilities_missing",
      message: "真实模型 manifest 缺少 outputCapabilities。",
      messageEn: "The real model manifest is missing outputCapabilities.",
      tags: ["output_capabilities_missing"],
    })
  }

  const outputValidation = validateOutputCapabilities(manifest.outputCapabilities)

  if (!outputValidation.ok) {
    return outputValidation
  }

  return {
    ok: true,
    status: "real_model_manifest_valid",
    schemaVersion: manifest.schemaVersion,
    modelName: manifest.modelName,
    modelVersion: manifest.modelVersion,
    license: manifest.license,
    dataSourceType: manifest.dataSourceType,
    commercialUseAllowed: true,
    originalityConfirmed: true,
    unlicensedThirdPartyArtworkAllowed: false,
    outputCapabilities: outputValidation.outputCapabilities,
    canShowToPlayer: false,
    tags: [
      "real_model_manifest",
      "manifest_valid",
      "license_allowed",
      "originality_confirmed",
      "commercial_use_allowed",
      "unlicensed_third_party_blocked",
      "not_player_visible",
    ],
  }
}

function validateOutputCapabilities(outputCapabilities) {
  if (!Array.isArray(outputCapabilities.supportedImageFormats)) {
    return buildManifestFailure({
      status: "real_model_manifest_formats_missing",
      message: "真实模型 manifest 缺少 supportedImageFormats。",
      messageEn: "The real model manifest is missing supportedImageFormats.",
      tags: ["formats_missing"],
    })
  }

  const supportedImageFormats = outputCapabilities.supportedImageFormats.map((format) =>
    typeof format === "string" ? format.trim().toLowerCase() : ""
  )

  if (supportedImageFormats.length === 0) {
    return buildManifestFailure({
      status: "real_model_manifest_formats_empty",
      message: "真实模型 manifest supportedImageFormats 不能为空。",
      messageEn:
        "The real model manifest supportedImageFormats cannot be empty.",
      tags: ["formats_empty"],
    })
  }

  const invalidFormats = supportedImageFormats.filter(
    (format) => !ALLOWED_IMAGE_FORMATS.includes(format)
  )

  if (invalidFormats.length > 0) {
    return buildManifestFailure({
      status: "real_model_manifest_format_invalid",
      message: `真实模型 manifest 包含不允许的输出格式：${invalidFormats.join(", ")}。`,
      messageEn: `The real model manifest contains invalid output formats: ${invalidFormats.join(", ")}.`,
      tags: ["format_invalid"],
    })
  }

  if (!supportedImageFormats.some((format) => ALLOWED_IMAGE_FORMATS.includes(format))) {
    return buildManifestFailure({
      status: "real_model_manifest_no_supported_format",
      message: "真实模型 manifest 没有任何允许的输出格式。",
      messageEn:
        "The real model manifest does not contain any allowed output format.",
      tags: ["no_supported_format"],
    })
  }

  const minimumWidth = Number(outputCapabilities.minimumWidth)
  const minimumHeight = Number(outputCapabilities.minimumHeight)

  if (!Number.isFinite(minimumWidth) || minimumWidth < MINIMUM_IMAGE_WIDTH) {
    return buildManifestFailure({
      status: "real_model_manifest_minimum_width_invalid",
      message: `真实模型 manifest minimumWidth 必须大于等于 ${MINIMUM_IMAGE_WIDTH}。`,
      messageEn: `The real model manifest minimumWidth must be at least ${MINIMUM_IMAGE_WIDTH}.`,
      tags: ["minimum_width_invalid"],
    })
  }

  if (!Number.isFinite(minimumHeight) || minimumHeight < MINIMUM_IMAGE_HEIGHT) {
    return buildManifestFailure({
      status: "real_model_manifest_minimum_height_invalid",
      message: `真实模型 manifest minimumHeight 必须大于等于 ${MINIMUM_IMAGE_HEIGHT}。`,
      messageEn: `The real model manifest minimumHeight must be at least ${MINIMUM_IMAGE_HEIGHT}.`,
      tags: ["minimum_height_invalid"],
    })
  }

  if (outputCapabilities.canReturnPlaceholder !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_placeholder_not_blocked",
      message: "真实模型 manifest 必须明确 canReturnPlaceholder=false。",
      messageEn:
        "The real model manifest must explicitly set canReturnPlaceholder=false.",
      tags: ["placeholder_not_blocked"],
    })
  }

  if (outputCapabilities.canReturnSvg !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_svg_not_blocked",
      message: "真实模型 manifest 必须明确 canReturnSvg=false。",
      messageEn:
        "The real model manifest must explicitly set canReturnSvg=false.",
      tags: ["svg_not_blocked"],
    })
  }

  if (outputCapabilities.canReturnHtml !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_html_not_blocked",
      message: "真实模型 manifest 必须明确 canReturnHtml=false。",
      messageEn:
        "The real model manifest must explicitly set canReturnHtml=false.",
      tags: ["html_not_blocked"],
    })
  }

  if (outputCapabilities.canReturnJsonDebugImage !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_json_debug_image_not_blocked",
      message: "真实模型 manifest 必须明确 canReturnJsonDebugImage=false。",
      messageEn:
        "The real model manifest must explicitly set canReturnJsonDebugImage=false.",
      tags: ["json_debug_image_not_blocked"],
    })
  }

  if (outputCapabilities.canReturnProgrammaticRenderer !== false) {
    return buildManifestFailure({
      status: "real_model_manifest_programmatic_renderer_not_blocked",
      message:
        "真实模型 manifest 必须明确 canReturnProgrammaticRenderer=false。",
      messageEn:
        "The real model manifest must explicitly set canReturnProgrammaticRenderer=false.",
      tags: ["programmatic_renderer_not_blocked"],
    })
  }

  return {
    ok: true,
    outputCapabilities: {
      supportedImageFormats,
      minimumWidth,
      minimumHeight,
      canReturnPlaceholder: false,
      canReturnSvg: false,
      canReturnHtml: false,
      canReturnJsonDebugImage: false,
      canReturnProgrammaticRenderer: false,
    },
  }
}

function buildManifestFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message,
    messageEn: input.messageEn,
    canShowToPlayer: false,
    tags: [
      "real_model_manifest",
      ...input.tags,
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}