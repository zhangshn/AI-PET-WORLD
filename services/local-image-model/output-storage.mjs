// 当前文件作用：定义 AI-PET-WORLD 自研 local image model 的本地图片输出目录、公开 URL 与文件名安全规则。

import path from "node:path"

import { ALLOWED_IMAGE_FORMATS } from "./contracts.mjs"

export const LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX = "/generated"

export const DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY = path.resolve(
  process.cwd(),
  "data",
  "local-image-model",
  "generated"
)

export const DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL = "http://localhost:7001"

export const MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES = 25 * 1024 * 1024

const SAFE_FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}\.(png|webp|jpg)$/i

const RESERVED_WINDOWS_FILE_BASENAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
])

export function readLocalImageOutputStorageStatus(input = {}) {
  const outputDirectory = readOutputDirectory(input)
  const publicBaseUrl = readPublicBaseUrl(input)

  return {
    ok: true,
    status: "local_image_output_storage_rules_ready",
    outputDirectory,
    publicBaseUrl,
    publicRoutePrefix: LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX,
    defaultPublicUrlExample: buildPublicUrl({
      fileName: "example.png",
      publicBaseUrl,
    }),
    maxFileBytes: MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    mustStoreUnderOutputDirectory: true,
    mustReturnPublicHttpUrl: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    mustNotUsePathTraversal: true,
    mustNotOverwriteUnsafePath: true,
    canShowToPlayer: false,
    tags: [
      "local_image_output_storage",
      "storage_rules_ready",
      "file_path_forbidden",
      "public_url_required",
      "not_player_visible",
    ],
  }
}

export function createSafeLocalImageOutputFileName(input = {}) {
  const imageFormatResult = normalizeImageFormat(input.imageFormat)

  if (!imageFormatResult.ok) {
    return imageFormatResult
  }

  const seed = sanitizeFileStem(
    input.seed ?? input.candidateId ?? input.requestId,
    "ai-pet-world-image"
  )
  const uniqueSuffix = sanitizeFileStem(input.uniqueSuffix, "pending")
  const fileName = `${seed}-${uniqueSuffix}.${imageFormatResult.imageFormat}`

  return validateLocalImageOutputFileName({
    fileName,
    imageFormat: imageFormatResult.imageFormat,
  })
}

export function buildLocalImageOutputReference(input = {}) {
  const validation = validateLocalImageOutputFileName(input)

  if (!validation.ok) {
    return validation
  }

  const outputDirectory = readOutputDirectory(input)
  const internalFilePath = path.resolve(outputDirectory, validation.fileName)

  if (!isPathInsideDirectory(internalFilePath, outputDirectory)) {
    return buildStorageFailure({
      zh: "本地图片输出路径越过了允许的输出目录。",
      en: "The local image output path escapes the allowed output directory.",
      tags: ["output_path_escape_forbidden"],
    })
  }

  return {
    ok: true,
    fileName: validation.fileName,
    imageFormat: validation.imageFormat,
    internalFilePath,
    imageUrl: buildPublicUrl({
      fileName: validation.fileName,
      publicBaseUrl: readPublicBaseUrl(input),
    }),
    maxFileBytes: MAX_LOCAL_IMAGE_OUTPUT_FILE_BYTES,
    canShowToPlayer: false,
    tags: [
      "local_image_output_reference_valid",
      "public_http_url_ready",
      "local_file_path_internal_only",
      "not_player_visible",
    ],
  }
}

export function validateLocalImageOutputFileName(input = {}) {
  const rawFileName =
    typeof input.fileName === "string" ? input.fileName.trim() : ""

  if (!rawFileName) {
    return buildStorageFailure({
      zh: "本地图片输出文件名不能为空。",
      en: "The local image output file name cannot be empty.",
      tags: ["empty_output_file_name"],
    })
  }

  if (
    rawFileName.includes("/") ||
    rawFileName.includes("\\") ||
    rawFileName.includes(":")
  ) {
    return buildStorageFailure({
      zh: "本地图片输出文件名不能包含路径分隔符或磁盘符。",
      en: "The local image output file name must not contain path separators or drive letters.",
      tags: ["path_segment_forbidden"],
    })
  }

  if (rawFileName.includes("..")) {
    return buildStorageFailure({
      zh: "本地图片输出文件名不能包含路径穿越片段。",
      en: "The local image output file name must not contain path traversal segments.",
      tags: ["path_traversal_forbidden"],
    })
  }

  if (!SAFE_FILE_NAME_PATTERN.test(rawFileName)) {
    return buildStorageFailure({
      zh: "本地图片输出文件名格式不安全，只允许字母、数字、点、下划线、短横线，并且扩展名必须是 png/webp/jpg。",
      en: "The local image output file name is unsafe. Only letters, numbers, dot, underscore, hyphen, and png/webp/jpg extensions are allowed.",
      tags: ["unsafe_output_file_name"],
    })
  }

  const extension = path.extname(rawFileName).slice(1).toLowerCase()
  const imageFormatResult = normalizeImageFormat(extension)

  if (!imageFormatResult.ok) {
    return imageFormatResult
  }

  if (input.imageFormat) {
    const expectedImageFormat = normalizeImageFormat(input.imageFormat)

    if (!expectedImageFormat.ok) {
      return expectedImageFormat
    }

    if (expectedImageFormat.imageFormat !== imageFormatResult.imageFormat) {
      return buildStorageFailure({
        zh: "本地图片输出文件名扩展名与 imageFormat 不一致。",
        en: "The local image output file extension does not match imageFormat.",
        tags: ["output_extension_format_mismatch"],
      })
    }
  }

  const basename = path.basename(rawFileName, path.extname(rawFileName)).toLowerCase()

  if (RESERVED_WINDOWS_FILE_BASENAMES.has(basename)) {
    return buildStorageFailure({
      zh: "本地图片输出文件名不能使用系统保留名称。",
      en: "The local image output file name must not use a reserved system name.",
      tags: ["reserved_output_file_name"],
    })
  }

  return {
    ok: true,
    fileName: rawFileName,
    imageFormat: imageFormatResult.imageFormat,
    canShowToPlayer: false,
    tags: ["safe_output_file_name"],
  }
}

function buildPublicUrl(input = {}) {
  const publicBaseUrl = readPublicBaseUrl(input)
  const encodedFileName = encodeURIComponent(input.fileName)
  const url = new URL(
    `${LOCAL_IMAGE_OUTPUT_ROUTE_PREFIX}/${encodedFileName}`,
    `${publicBaseUrl}/`
  )

  return url.toString()
}

function readOutputDirectory(input = {}) {
  const rawDirectory =
    typeof input.outputDirectory === "string" && input.outputDirectory.trim()
      ? input.outputDirectory.trim()
      : process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR ||
        DEFAULT_LOCAL_IMAGE_OUTPUT_DIRECTORY

  return path.resolve(rawDirectory)
}

function readPublicBaseUrl(input = {}) {
  const rawPublicBaseUrl =
    typeof input.publicBaseUrl === "string" && input.publicBaseUrl.trim()
      ? input.publicBaseUrl.trim()
      : process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL ||
        DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL

  try {
    const url = new URL(rawPublicBaseUrl)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL
    }

    url.search = ""
    url.hash = ""

    return url.toString().replace(/\/$/, "")
  } catch {
    return DEFAULT_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL
  }
}

function normalizeImageFormat(imageFormat) {
  const normalized =
    typeof imageFormat === "string"
      ? imageFormat.trim().toLowerCase().replace(/^\./, "")
      : ""

  if (!ALLOWED_IMAGE_FORMATS.includes(normalized)) {
    return buildStorageFailure({
      zh: `本地图片输出格式不被允许：${String(imageFormat)}。`,
      en: `The local image output format is not allowed: ${String(imageFormat)}.`,
      tags: ["invalid_output_image_format"],
    })
  }

  return {
    ok: true,
    imageFormat: normalized,
    canShowToPlayer: false,
    tags: ["safe_output_image_format"],
  }
}

function sanitizeFileStem(value, fallback) {
  const sanitized = String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return sanitized || fallback
}

function isPathInsideDirectory(filePath, directory) {
  const relativePath = path.relative(directory, filePath)

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  )
}

function buildStorageFailure(input) {
  return {
    ok: false,
    error: {
      zh: input.zh,
      en: input.en,
    },
    canShowToPlayer: false,
    tags: ["local_image_output_storage_invalid", ...input.tags],
  }
}