// 当前文件作用：把 AI-PET-WORLD 真实推理 stdin 请求转发给本地 HTTP 图像引擎，并把真实位图写入指定输出目录。

import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const REAL_IMAGE_HTTP_ENGINE_COMMAND_NAME =
  "ai-pet-world-real-image-http-engine-command"
export const REAL_IMAGE_HTTP_ENGINE_COMMAND_VERSION = "http-engine-command-localhost-fallback-3"

const DEFAULT_TIMEOUT_MS = 180_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 3_600_000
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

if (isExecutedDirectly()) {
  main().catch((error) => {
    writeFailureAndExit({
      status: "real_image_http_engine_command_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
      detail: buildFetchErrorDetail(error),
    })
  })
}

async function main() {
  const stdinResult = await readStdinJson()
  if (!stdinResult.ok) return writeFailureAndExit(stdinResult)

  const config = readHttpEngineCommandConfig()
  if (!config.ok) return writeFailureAndExit(config)

  const request = buildHttpEngineRequest({
    payload: stdinResult.payload,
    config,
  })
  if (!request.ok) return writeFailureAndExit(request)

  const engineResult = await callHttpEngine({ config, request: request.body })
  if (!engineResult.ok) return writeFailureAndExit(engineResult)

  const imageResult = await resolveEngineImageBytes({
    enginePayload: engineResult.payload,
    config,
  })
  if (!imageResult.ok) return writeFailureAndExit(imageResult)

  const writeResult = await writeOutputImage({
    payload: stdinResult.payload,
    config,
    imageBytes: imageResult.imageBytes,
    imageFormat: imageResult.imageFormat ?? request.body.imageFormat,
  })
  if (!writeResult.ok) return writeFailureAndExit(writeResult)

  process.stdout.write(
    JSON.stringify({
      ok: true,
      status: "real_image_generated",
      imageFileName: stdinResult.payload.outputFileName,
      imageFormat: writeResult.imageFormat,
      width: writeResult.width,
      height: writeResult.height,
      license: config.license,
      originalityConfirmed: config.originalityConfirmed,
    })
  )
}

async function readStdinJson() {
  const chunks = []

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()

  if (!text) {
    return buildFailure({
      status: "real_image_http_engine_command_stdin_empty",
      message: "HTTP engine command stdin 不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)

    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "real_image_http_engine_command_stdin_not_object",
          message: "HTTP engine command stdin 必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "real_image_http_engine_command_stdin_json_invalid",
      message: "HTTP engine command stdin 不是合法 JSON。",
    })
  }
}

export function readHttpEngineCommandConfig(input = {}) {
  const endpoint = readOptionalString(
    input.endpoint ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT
  )
  const outputDirectory = readOptionalString(
    input.outputDirectory ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR
  )
  const license = readLicense(
    input.license ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE
  )
  const originalityConfirmed = readBoolean(
    input.originalityConfirmed ??
      process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED
  )
  const requestMode = readRequestMode(
    input.requestMode ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_REQUEST_MODE
  )
  const timeoutMs = readTimeoutMs(
    input.timeoutMs ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS
  )

  if (!endpoint) {
    return buildFailure({
      status: "real_image_http_engine_command_endpoint_missing",
      message: "缺少 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT。",
    })
  }

  const endpointValidation = validateHttpUrl(endpoint)
  if (!endpointValidation.ok) return endpointValidation

  if (!outputDirectory) {
    return buildFailure({
      status: "real_image_http_engine_command_output_directory_missing",
      message: "缺少 AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR。",
    })
  }

  if (originalityConfirmed !== true) {
    return buildFailure({
      status: "real_image_http_engine_command_originality_not_confirmed",
      message:
        "AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED 必须为 true。",
    })
  }

  return {
    ok: true,
    endpoint,
    outputDirectory,
    license,
    originalityConfirmed,
    requestMode,
    timeoutMs,
    canShowToPlayer: false,
  }
}

export function buildHttpEngineRequest(input = {}) {
  const payload = readRecord(input.payload)
  const config = input.config

  if (!isRecord(payload)) {
    return buildFailure({
      status: "real_image_http_engine_command_payload_invalid",
      message: "HTTP engine command stdin payload 必须是对象。",
    })
  }

  if (payload.canShowToPlayer !== false) {
    return buildFailure({
      status: "real_image_http_engine_command_visibility_invalid",
      message: "HTTP engine command payload 必须保持 canShowToPlayer=false。",
    })
  }

  const outputFileName = readOptionalString(payload.outputFileName)
  if (!isSafeImageFileName(outputFileName)) {
    return buildFailure({
      status: "real_image_http_engine_command_output_file_name_invalid",
      message: "HTTP engine command outputFileName 不安全。",
    })
  }

  const imageFormat = readImageFormat(payload.imageFormat)
  const width = readPositiveInteger(payload.width) ?? 1536
  const height = readPositiveInteger(payload.height) ?? 1024

  return {
    ok: true,
    body: {
      schemaVersion: "ai-pet-world-http-engine-request-v1",
      requestMode: config.requestMode,
      requestId: payload.requestId,
      outputFileName,
      imageFormat,
      width,
      height,
      promptPackage: readRecord(payload.promptPackage),
      modelTask: readRecord(payload.modelTask),
      controlSketch: readRecord(payload.controlSketch),
      visualFixHints: Array.isArray(payload.visualFixHints)
        ? payload.visualFixHints
        : [],
      worldFactMetadata: readRecord(payload.worldFactMetadata),
      responseContract: readRecord(payload.responseContract),
      constraints: {
        ...readRecord(payload.constraints),
        mustReturnRealBitmap: true,
        mustNotReturnPlaceholder: true,
        mustNotReturnSvg: true,
        mustNotReturnHtml: true,
        mustNotReturnJsonDebugImage: true,
        canShowToPlayer: false,
      },
      canShowToPlayer: false,
    },
  }
}

async function callHttpEngine(input = {}) {
  const attempts = []

  for (const endpoint of buildHttpEndpointCandidates(input.config.endpoint)) {
    const result = await postJsonToHttpEndpoint({
      endpoint,
      request: input.request,
      timeoutMs: input.config.timeoutMs,
    })

    if (result.ok) return result

    attempts.push(buildEndpointAttempt({ endpoint, result }))

    if (!shouldRetryEndpointFailure(result)) {
      return attachEndpointAttempts(result, attempts)
    }
  }

  const lastAttempt = attempts.at(-1)

  return buildFailure({
    status: lastAttempt?.status ?? "real_image_http_engine_command_fetch_failed",
    message: lastAttempt?.message ?? "HTTP engine 请求失败。",
    detail: { endpointAttempts: attempts },
  })
}

async function postJsonToHttpEndpoint(input = {}) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(input.request),
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      return buildFailure({
        status: "real_image_http_engine_command_http_failed",
        message: `HTTP engine 返回非 2xx：${response.status}。`,
        detail: {
          endpoint: input.endpoint,
          statusCode: response.status,
          bodyPreview: text.slice(0, 512),
        },
      })
    }

    try {
      const payload = JSON.parse(text)
      return isRecord(payload)
        ? { ok: true, payload }
        : buildFailure({
            status: "real_image_http_engine_command_response_not_object",
            message: "HTTP engine 必须返回 JSON 对象。",
            detail: { endpoint: input.endpoint },
          })
    } catch {
      return buildFailure({
        status: "real_image_http_engine_command_response_json_invalid",
        message: "HTTP engine 返回内容不是合法 JSON。",
        detail: { endpoint: input.endpoint, bodyPreview: text.slice(0, 512) },
      })
    }
  } catch (error) {
    return buildFailure({
      status:
        error?.name === "AbortError"
          ? "real_image_http_engine_command_timeout"
          : "real_image_http_engine_command_fetch_failed",
      message: error instanceof Error ? error.message : String(error),
      detail: {
        endpoint: input.endpoint,
        ...buildFetchErrorDetail(error),
      },
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function resolveEngineImageBytes(input = {}) {
  const payload = readRecord(input.enginePayload)
  const directImage = await readDirectImageBytes(payload)
  if (directImage.ok) return directImage

  const imageUrl = readOptionalString(
    payload.imageUrl ?? payload.url ?? payload.outputUrl ?? payload.publicUrl
  )
  if (imageUrl) return fetchImageUrl(imageUrl, input.config.timeoutMs)

  return buildFailure({
    status: "real_image_http_engine_command_image_missing",
    message:
      "HTTP engine 返回中没有 imageBase64 / dataUrl / imageUrl，无法写入真实图片。",
    detail: {
      returnedKeys: Object.keys(payload).slice(0, 30),
    },
  })
}

async function readDirectImageBytes(payload = {}) {
  const dataUrl = readOptionalString(payload.dataUrl ?? payload.imageDataUrl)
  if (dataUrl) return decodeDataUrl(dataUrl)

  const imageBase64 = readOptionalString(
    payload.imageBase64 ?? payload.base64 ?? payload.image
  )
  if (imageBase64) {
    try {
      const imageBytes = Buffer.from(stripBase64Prefix(imageBase64), "base64")
      return validateImageBytes(imageBytes)
    } catch {
      return buildFailure({
        status: "real_image_http_engine_command_base64_invalid",
        message: "HTTP engine 返回的 base64 图片无法解码。",
      })
    }
  }

  return { ok: false }
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/(png|webp|jpeg|jpg);base64,(.+)$/i.exec(dataUrl)
  if (!match) {
    return buildFailure({
      status: "real_image_http_engine_command_data_url_invalid",
      message: "HTTP engine 返回的 dataUrl 必须是 png/webp/jpeg base64。",
    })
  }

  try {
    const imageBytes = Buffer.from(match[2], "base64")
    return validateImageBytes(imageBytes)
  } catch {
    return buildFailure({
      status: "real_image_http_engine_command_data_url_base64_invalid",
      message: "HTTP engine 返回的 dataUrl base64 无法解码。",
    })
  }
}

async function fetchImageUrl(imageUrl, timeoutMs) {
  const urlValidation = validateHttpUrl(imageUrl)
  if (!urlValidation.ok) return urlValidation

  const attempts = []

  for (const endpoint of buildHttpEndpointCandidates(imageUrl)) {
    const result = await fetchImageEndpoint({ endpoint, timeoutMs })
    if (result.ok) return result

    attempts.push(buildEndpointAttempt({ endpoint, result }))

    if (!shouldRetryEndpointFailure(result)) {
      return attachEndpointAttempts(result, attempts)
    }
  }

  const lastAttempt = attempts.at(-1)

  return buildFailure({
    status: lastAttempt?.status ?? "real_image_http_engine_command_image_fetch_error",
    message: lastAttempt?.message ?? "HTTP engine 图片地址拉取失败。",
    detail: { endpointAttempts: attempts },
  })
}

async function fetchImageEndpoint(input = {}) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await fetch(input.endpoint, {
      method: "GET",
      signal: controller.signal,
    })

    if (!response.ok) {
      return buildFailure({
        status: "real_image_http_engine_command_image_fetch_failed",
        message: `HTTP engine 图片地址返回非 2xx：${response.status}。`,
        detail: {
          endpoint: input.endpoint,
          statusCode: response.status,
        },
      })
    }

    const imageBytes = Buffer.from(await response.arrayBuffer())
    return validateImageBytes(imageBytes)
  } catch (error) {
    return buildFailure({
      status:
        error?.name === "AbortError"
          ? "real_image_http_engine_command_image_fetch_timeout"
          : "real_image_http_engine_command_image_fetch_error",
      message: error instanceof Error ? error.message : String(error),
      detail: {
        endpoint: input.endpoint,
        ...buildFetchErrorDetail(error),
      },
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function writeOutputImage(input = {}) {
  const outputDirectory = path.resolve(input.config.outputDirectory)
  const outputFilePath = path.resolve(outputDirectory, input.payload.outputFileName)

  if (!isPathInsideDirectory(outputFilePath, outputDirectory)) {
    return buildFailure({
      status: "real_image_http_engine_command_output_path_escape_forbidden",
      message: "HTTP engine command 输出路径越过允许目录。",
    })
  }

  const metadata = validateImageBytes(input.imageBytes)
  if (!metadata.ok) return metadata

  const expectedFormat = readImageFormat(input.payload.imageFormat)
  if (metadata.imageFormat !== expectedFormat) {
    return buildFailure({
      status: "real_image_http_engine_command_image_format_mismatch",
      message: "HTTP engine 图片格式与请求 imageFormat 不一致。",
      detail: {
        expectedFormat,
        actualFormat: metadata.imageFormat,
      },
    })
  }

  await fs.mkdir(outputDirectory, { recursive: true })
  await fs.writeFile(outputFilePath, input.imageBytes)

  return {
    ok: true,
    imageFormat: metadata.imageFormat,
    width: metadata.width,
    height: metadata.height,
  }
}

function validateImageBytes(imageBytes) {
  if (!Buffer.isBuffer(imageBytes) || imageBytes.length <= 0) {
    return buildFailure({
      status: "real_image_http_engine_command_image_empty",
      message: "HTTP engine 返回的图片为空。",
    })
  }

  if (imageBytes.length > MAX_IMAGE_BYTES) {
    return buildFailure({
      status: "real_image_http_engine_command_image_too_large",
      message: "HTTP engine 返回的图片超过大小限制。",
    })
  }

  return (
    readPngMetadata(imageBytes) ??
    readWebpMetadata(imageBytes) ??
    readJpegMetadata(imageBytes) ??
    buildFailure({
      status: "real_image_http_engine_command_image_signature_invalid",
      message: "HTTP engine 返回的内容不是合法 PNG/WebP/JPG 位图。",
    })
  )
}

function readPngMetadata(buffer) {
  if (
    buffer.length < 24 ||
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  ) {
    return null
  }

  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return buildFailure({
      status: "real_image_http_engine_command_png_ihdr_missing",
      message: "PNG 缺少 IHDR。",
    })
  }

  return {
    ok: true,
    imageFormat: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function readWebpMetadata(buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii")

  if (chunkType === "VP8X") {
    return {
      ok: true,
      imageFormat: "webp",
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    }
  }

  if (chunkType === "VP8L" && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21)
    return {
      ok: true,
      imageFormat: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }

  if (chunkType === "VP8 ") {
    return {
      ok: true,
      imageFormat: "webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }

  return buildFailure({
    status: "real_image_http_engine_command_webp_header_invalid",
    message: "WEBP 头信息不合法。",
  })
}

function readJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const segmentLength = buffer.readUInt16BE(offset + 2)
    if (segmentLength < 2) {
      return buildFailure({
        status: "real_image_http_engine_command_jpeg_segment_invalid",
        message: "JPEG segment 不合法。",
      })
    }

    if (isJpegStartOfFrameMarker(marker)) {
      return {
        ok: true,
        imageFormat: "jpg",
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    offset += 2 + segmentLength
  }

  return buildFailure({
    status: "real_image_http_engine_command_jpeg_sof_missing",
    message: "JPEG 缺少 SOF 尺寸信息。",
  })
}

function isJpegStartOfFrameMarker(marker) {
  return [
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ].includes(marker)
}

function readHttpEngineCommandRequestMode(input = {}) {
  return readRequestMode(input.value)
}

function readRequestMode(value) {
  const mode = readOptionalString(value)
  return mode || "prompt_package"
}

function readLicense(value) {
  return ["self_owned", "cc0", "commercial_license"].includes(value)
    ? value
    : "self_owned"
}

function readImageFormat(value) {
  return ["png", "webp", "jpg"].includes(value) ? value : "png"
}

function readPositiveInteger(value) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function readTimeoutMs(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS

  return Math.min(Math.max(Math.floor(numeric), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
}

function readBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase())
}

function validateHttpUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return buildFailure({
        status: "real_image_http_engine_command_url_protocol_invalid",
        message: "HTTP engine 地址必须是 http/https。",
      })
    }
    return { ok: true }
  } catch {
    return buildFailure({
      status: "real_image_http_engine_command_url_invalid",
      message: "HTTP engine 地址不是合法 URL。",
    })
  }
}

function buildHttpEndpointCandidates(endpoint) {
  const candidates = [endpoint]

  try {
    const url = new URL(endpoint)
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1"
      candidates.push(url.toString())
    }
  } catch {
    return candidates
  }

  return [...new Set(candidates)]
}

function shouldRetryEndpointFailure(result) {
  return [
    "real_image_http_engine_command_fetch_failed",
    "real_image_http_engine_command_timeout",
    "real_image_http_engine_command_image_fetch_error",
    "real_image_http_engine_command_image_fetch_timeout",
  ].includes(result.status)
}

function buildEndpointAttempt(input = {}) {
  const detail = readRecord(input.result?.detail)

  return {
    endpoint: input.endpoint,
    status: input.result?.status ?? null,
    message: input.result?.message ?? null,
    causeCode: detail.causeCode ?? null,
    causeMessage: detail.causeMessage ?? null,
    causeAddress: detail.causeAddress ?? null,
    causePort: detail.causePort ?? null,
    statusCode: detail.statusCode ?? null,
  }
}

function attachEndpointAttempts(result, attempts) {
  return {
    ...result,
    detail: {
      ...readRecord(result.detail),
      endpointAttempts: attempts,
    },
  }
}

function buildFetchErrorDetail(error) {
  const cause = error?.cause

  return {
    errorName: error?.name ?? null,
    causeName: cause?.name ?? null,
    causeCode: cause?.code ?? null,
    causeMessage: cause?.message ?? null,
    causeAddress: cause?.address ?? null,
    causePort: cause?.port ?? null,
  }
}

function isSafeImageFileName(value) {
  return /^[a-z0-9][a-z0-9._-]{0,119}\.(png|webp|jpg)$/i.test(value)
}

function stripBase64Prefix(value) {
  const commaIndex = value.indexOf(",")
  return value.startsWith("data:image/") && commaIndex >= 0
    ? value.slice(commaIndex + 1)
    : value
}

function isPathInsideDirectory(filePath, directoryPath) {
  const relative = path.relative(directoryPath, filePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    command: REAL_IMAGE_HTTP_ENGINE_COMMAND_NAME,
    version: REAL_IMAGE_HTTP_ENGINE_COMMAND_VERSION,
    message: input.message ?? null,
    detail: input.detail ?? null,
    canShowToPlayer: false,
    tags: [
      "real_image_http_engine_command",
      "failed",
      "does_not_return_fake_image",
      "not_player_visible",
    ],
  }
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function readRecord(value) {
  return isRecord(value) ? value : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function writeFailureAndExit(payload) {
  process.stderr.write(JSON.stringify(payload, null, 2))
  process.exitCode = 1
}

function isExecutedDirectly() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false
}

export const __internalRealImageHttpEngineCommand = {
  buildHttpEngineRequest,
  readHttpEngineCommandRequestMode,
  readHttpEngineCommandConfig,
}
