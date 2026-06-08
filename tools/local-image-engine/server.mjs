import { Buffer } from "node:buffer"
import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

const PORT = readIntegerEnv("AI_PET_WORLD_LOCAL_IMAGE_ENGINE_PORT", 7860)
const OUTPUT_ROOT = resolve(
  process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_OUTPUT_ROOT?.trim() ||
    join(process.cwd(), "..", "ai-pet-world-generated")
)
const PUBLIC_BASE_URL =
  process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_PUBLIC_BASE_URL?.trim() ||
  `http://localhost:${PORT}`
const UPSTREAM_ENDPOINT =
  process.env.AI_PET_WORLD_REAL_IMAGE_ENGINE_ENDPOINT?.trim() || null
const UPSTREAM_API_KEY =
  process.env.AI_PET_WORLD_REAL_IMAGE_ENGINE_API_KEY?.trim() || null
const UPSTREAM_TIMEOUT_MS = readIntegerEnv(
  "AI_PET_WORLD_REAL_IMAGE_ENGINE_TIMEOUT_MS",
  180000
)
const DEFAULT_LICENSE =
  readLicense(process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_LICENSE) ||
  "self_owned"
const DEFAULT_ORIGINALITY_CONFIRMED =
  process.env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ORIGINALITY_CONFIRMED === "true"

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", PUBLIC_BASE_URL)

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, UPSTREAM_ENDPOINT ? 200 : 503, {
        ok: Boolean(UPSTREAM_ENDPOINT),
        status: UPSTREAM_ENDPOINT
          ? "local_image_engine_ready"
          : "real_image_engine_upstream_missing",
        model: "ai-pet-world-local-image-engine-file-server",
        version: "mvp-file-server-1",
        endpoint: `${PUBLIC_BASE_URL}/generate`,
        generatedBaseUrl: `${PUBLIC_BASE_URL}/generated/`,
        outputRoot: OUTPUT_ROOT,
        upstreamConfigured: Boolean(UPSTREAM_ENDPOINT),
        upstreamEndpointConfigured: Boolean(UPSTREAM_ENDPOINT),
        supportsWorldVisualPainter: true,
        supportsResponseContract: true,
        supportsHiddenCandidateOutput: true,
        supportsPng: true,
        supportsWebp: true,
        supportsJpg: true,
        message: UPSTREAM_ENDPOINT
          ? "本地出图文件服务已就绪，会调用真实上游模型并保存图片文件。"
          : "本地出图文件服务已启动，但还没有配置 AI_PET_WORLD_REAL_IMAGE_ENGINE_ENDPOINT，所以不会生成假图。",
        messageEn: UPSTREAM_ENDPOINT
          ? "The local image file service is ready. It calls the real upstream model and persists image files."
          : "The local image file service is running, but AI_PET_WORLD_REAL_IMAGE_ENGINE_ENDPOINT is not configured, so it will not generate fake images.",
        canShowToPlayer: false,
        tags: [
          "local_image_engine_file_server",
          UPSTREAM_ENDPOINT ? "upstream_configured" : "upstream_missing",
          "persistent_image_files",
          "no_fake_image",
        ],
      })
    }

    if (request.method === "POST" && url.pathname === "/generate") {
      return handleGenerate(request, response)
    }

    if (request.method === "GET" && url.pathname.startsWith("/generated/")) {
      return serveGeneratedFile(url.pathname, response)
    }

    return sendJson(response, 404, {
      ok: false,
      status: "not_found",
      message: "未找到接口。",
      messageEn: "Endpoint not found.",
    })
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      status: "server_error",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(PORT, () => {
  console.log(`[ai-pet-world-image-engine] listening on ${PUBLIC_BASE_URL}`)
  console.log(`[ai-pet-world-image-engine] output root: ${OUTPUT_ROOT}`)
  console.log(
    `[ai-pet-world-image-engine] upstream: ${
      UPSTREAM_ENDPOINT || "missing"
    }`
  )
})

async function handleGenerate(request, response) {
  if (!UPSTREAM_ENDPOINT) {
    return sendJson(response, 503, {
      ok: false,
      status: "real_image_engine_upstream_missing",
      message:
        "缺少 AI_PET_WORLD_REAL_IMAGE_ENGINE_ENDPOINT，不能生成图片。不会返回假图或占位图。",
      messageEn:
        "AI_PET_WORLD_REAL_IMAGE_ENGINE_ENDPOINT is missing, so no image can be generated. Fake images and placeholders will not be returned.",
      canShowToPlayer: false,
      tags: [
        "local_image_engine_file_server",
        "upstream_missing",
        "does_not_generate",
        "fake_image_forbidden",
      ],
    })
  }

  const requestBody = await readJsonRequest(request)
  const upstreamResult = await callUpstreamImageEngine(requestBody)

  if (!upstreamResult.ok) {
    return sendJson(response, 502, {
      ok: false,
      status: "upstream_image_engine_failed",
      error: upstreamResult.error,
      canShowToPlayer: false,
      tags: ["local_image_engine_file_server", "upstream_failed"],
    })
  }

  const imagePayload = await normalizeUpstreamImagePayload(upstreamResult)

  if (!imagePayload.ok) {
    return sendJson(response, 502, {
      ok: false,
      status: "upstream_image_payload_invalid",
      error: imagePayload.error,
      rawContentType: upstreamResult.contentType,
      canShowToPlayer: false,
      tags: ["local_image_engine_file_server", "payload_invalid"],
    })
  }

  const savedImage = await saveGeneratedImage({
    bytes: imagePayload.bytes,
    imageFormat: imagePayload.imageFormat,
  })

  return sendJson(response, 200, {
    imageUrl: savedImage.imageUrl,
    imageFormat: imagePayload.imageFormat,
    width: imagePayload.width,
    height: imagePayload.height,
    license: imagePayload.license || DEFAULT_LICENSE,
    originalityConfirmed:
      imagePayload.originalityConfirmed ?? DEFAULT_ORIGINALITY_CONFIRMED,
    file: {
      relativePath: savedImage.relativePath,
      sha256: savedImage.sha256,
      byteLength: imagePayload.bytes.length,
    },
  })
}

async function callUpstreamImageEngine(requestBody) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const response = await fetch(UPSTREAM_ENDPOINT, {
      method: "POST",
      headers: buildUpstreamHeaders(),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type") || ""

    if (!response.ok) {
      return {
        ok: false,
        error: {
          zh: `真实上游模型返回失败状态：${response.status}`,
          en: `The real upstream model returned status ${response.status}.`,
        },
      }
    }

    if (contentType.includes("application/json")) {
      return {
        ok: true,
        contentType,
        kind: "json",
        payload: await response.json(),
      }
    }

    if (isSupportedImageContentType(contentType)) {
      return {
        ok: true,
        contentType,
        kind: "binary",
        bytes: new Uint8Array(await response.arrayBuffer()),
      }
    }

    return {
      ok: false,
      error: {
        zh: "真实上游模型没有返回 JSON 或 PNG/WebP/JPG 图片二进制。",
        en: "The real upstream model did not return JSON or PNG/WebP/JPG image bytes.",
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        zh: `真实上游模型请求失败：${
          error instanceof Error ? error.message : String(error)
        }`,
        en: `The real upstream model request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function normalizeUpstreamImagePayload(upstreamResult) {
  if (upstreamResult.kind === "binary") {
    const imageFormat = readImageFormatFromContentType(upstreamResult.contentType)
    const dimensions = parseImageDimensions(upstreamResult.bytes, imageFormat)

    if (!dimensions) {
      return {
        ok: false,
        error: {
          zh: "上游返回了图片二进制，但无法解析宽高。",
          en: "The upstream returned image bytes, but width and height could not be parsed.",
        },
      }
    }

    return {
      ok: true,
      bytes: upstreamResult.bytes,
      imageFormat,
      width: dimensions.width,
      height: dimensions.height,
      license: null,
      originalityConfirmed: null,
    }
  }

  const pickedPayload = pickImagePayload(upstreamResult.payload)

  if (!pickedPayload) {
    return {
      ok: false,
      error: {
        zh: "上游 JSON 里找不到 imageUrl、url、imageBase64、base64 或 b64_json。",
        en: "The upstream JSON does not contain imageUrl, url, imageBase64, base64, or b64_json.",
      },
    }
  }

  const imageFormat = pickedPayload.imageFormat
  let bytes

  if (pickedPayload.imageBase64) {
    bytes = decodeBase64Image(pickedPayload.imageBase64)
  } else if (pickedPayload.imageUrl?.startsWith("data:image/")) {
    bytes = decodeDataImageUrl(pickedPayload.imageUrl)
  } else if (pickedPayload.imageUrl?.startsWith("http://") || pickedPayload.imageUrl?.startsWith("https://")) {
    const downloaded = await downloadImageBytes(pickedPayload.imageUrl)
    if (!downloaded.ok) return downloaded
    bytes = downloaded.bytes
  } else {
    return {
      ok: false,
      error: {
        zh: "上游返回的图片 URL 协议不支持。只支持 http、https 或 data:image。",
        en: "The upstream image URL scheme is unsupported. Only http, https, or data:image is supported.",
      },
    }
  }

  const finalFormat = imageFormat || detectImageFormat(bytes)
  if (!finalFormat) {
    return {
      ok: false,
      error: {
        zh: "无法识别图片格式。",
        en: "Image format could not be detected.",
      },
    }
  }

  const dimensions =
    pickedPayload.width && pickedPayload.height
      ? { width: pickedPayload.width, height: pickedPayload.height }
      : parseImageDimensions(bytes, finalFormat)

  if (!dimensions) {
    return {
      ok: false,
      error: {
        zh: "无法解析图片宽高。",
        en: "Image width and height could not be parsed.",
      },
    }
  }

  return {
    ok: true,
    bytes,
    imageFormat: finalFormat,
    width: dimensions.width,
    height: dimensions.height,
    license: pickedPayload.license,
    originalityConfirmed: pickedPayload.originalityConfirmed,
  }
}

function pickImagePayload(payload) {
  const candidates = collectPayloadCandidates(payload)

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue

    const imageUrl =
      readString(candidate.imageUrl) ||
      readString(candidate.image_url) ||
      readString(candidate.url)

    const imageBase64 =
      readString(candidate.imageBase64) ||
      readString(candidate.base64) ||
      readString(candidate.b64_json)

    const imageFormat =
      readImageFormat(candidate.imageFormat) ||
      readImageFormat(candidate.image_format) ||
      readImageFormat(candidate.format) ||
      readImageFormat(candidate.mimeType) ||
      readImageFormat(candidate.mime_type) ||
      readImageFormat(candidate.contentType) ||
      readImageFormat(candidate.content_type)

    if (!imageUrl && !imageBase64) continue

    return {
      imageUrl,
      imageBase64,
      imageFormat,
      width:
        readNumber(candidate.width) ||
        readNumber(candidate.w) ||
        readNestedNumber(candidate.size, ["width", "w"]) ||
        readNestedNumber(candidate.dimensions, ["width", "w"]) ||
        null,
      height:
        readNumber(candidate.height) ||
        readNumber(candidate.h) ||
        readNestedNumber(candidate.size, ["height", "h"]) ||
        readNestedNumber(candidate.dimensions, ["height", "h"]) ||
        null,
      license:
        readLicense(candidate.license) ||
        readLicense(candidate.licence) ||
        null,
      originalityConfirmed:
        readBoolean(candidate.originalityConfirmed) ??
        readBoolean(candidate.originality_confirmed) ??
        readBoolean(candidate.original) ??
        null,
    }
  }

  return null
}

function collectPayloadCandidates(payload) {
  const collected = [payload]

  if (isRecord(payload)) {
    for (const key of [
      "result",
      "image",
      "output",
      "data",
      "images",
      "outputs",
      "metadata",
    ]) {
      const value = payload[key]
      if (Array.isArray(value)) {
        collected.push(...value)
      } else if (value) {
        collected.push(value)
      }
    }
  }

  return collected
}

async function saveGeneratedImage(input) {
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `candidate-${Date.now()}-${randomUUID()}.${input.imageFormat}`
  const relativePath = `candidates/${date}/${fileName}`
  const absolutePath = join(OUTPUT_ROOT, relativePath)

  await mkdir(join(OUTPUT_ROOT, "candidates", date), { recursive: true })
  await writeFile(absolutePath, input.bytes)

  const sha256 = createHash("sha256").update(input.bytes).digest("hex")
  const imageUrl = `${PUBLIC_BASE_URL}/generated/${relativePath.replaceAll("\\", "/")}`

  return {
    relativePath,
    absolutePath,
    imageUrl,
    sha256,
  }
}

async function serveGeneratedFile(pathname, response) {
  const relativePath = pathname.replace(/^\/generated\//, "")
  const absolutePath = normalize(join(OUTPUT_ROOT, relativePath))

  if (!absolutePath.startsWith(OUTPUT_ROOT)) {
    return sendJson(response, 403, {
      ok: false,
      status: "forbidden",
    })
  }

  try {
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) throw new Error("not file")

    response.writeHead(200, {
      "content-type": readContentTypeFromFilePath(absolutePath),
      "cache-control": "public, max-age=31536000, immutable",
    })
    createReadStream(absolutePath).pipe(response)
  } catch {
    return sendJson(response, 404, {
      ok: false,
      status: "generated_file_not_found",
    })
  }
}

async function downloadImageBytes(imageUrl) {
  const response = await fetch(imageUrl)
  const contentType = response.headers.get("content-type") || ""

  if (!response.ok || !isSupportedImageContentType(contentType)) {
    return {
      ok: false,
      error: {
        zh: "无法下载上游返回的图片 URL，或 Content-Type 不是 PNG/WebP/JPG。",
        en: "Failed to download the upstream image URL, or Content-Type is not PNG/WebP/JPG.",
      },
    }
  }

  return {
    ok: true,
    bytes: new Uint8Array(await response.arrayBuffer()),
  }
}

async function readJsonRequest(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")
  return rawBody ? JSON.parse(rawBody) : {}
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body, null, 2))
}

function buildUpstreamHeaders() {
  const headers = {
    accept: "application/json, image/png, image/webp, image/jpeg",
    "content-type": "application/json",
  }

  if (UPSTREAM_API_KEY) {
    headers.authorization = `Bearer ${UPSTREAM_API_KEY}`
  }

  return headers
}

function isSupportedImageContentType(contentType) {
  return (
    contentType.includes("image/png") ||
    contentType.includes("image/webp") ||
    contentType.includes("image/jpeg") ||
    contentType.includes("image/jpg")
  )
}

function readImageFormatFromContentType(contentType) {
  if (contentType.includes("image/png")) return "png"
  if (contentType.includes("image/webp")) return "webp"
  return "jpg"
}

function readContentTypeFromFilePath(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (extension === ".png") return "image/png"
  if (extension === ".webp") return "image/webp"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  return "application/octet-stream"
}

function decodeBase64Image(value) {
  const base64 = value.includes(",") ? value.split(",").at(-1) : value
  return new Uint8Array(Buffer.from(base64, "base64"))
}

function decodeDataImageUrl(value) {
  return decodeBase64Image(value)
}

function detectImageFormat(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg"
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return "webp"
  }
  return null
}

function parseImageDimensions(bytes, imageFormat) {
  if (imageFormat === "png") return parsePngDimensions(bytes)
  if (imageFormat === "jpg") return parseJpegDimensions(bytes)
  if (imageFormat === "webp") return parseWebpDimensions(bytes)
  return null
}

function parsePngDimensions(bytes) {
  if (bytes.length < 24) return null
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null

  return {
    width: readUInt32BE(bytes, 16),
    height: readUInt32BE(bytes, 20),
  }
}

function parseJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  let offset = 2

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]
    const segmentLength = readUInt16BE(bytes, offset + 2)

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: readUInt16BE(bytes, offset + 5),
        width: readUInt16BE(bytes, offset + 7),
      }
    }

    if (!Number.isFinite(segmentLength) || segmentLength <= 0) return null
    offset += 2 + segmentLength
  }

  return null
}

function parseWebpDimensions(bytes) {
  if (bytes.length < 30) return null
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") {
    return null
  }

  let offset = 12

  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4)
    const chunkSize = readUInt32LE(bytes, offset + 4)
    const chunkDataOffset = offset + 8

    if (chunkType === "VP8X" && chunkDataOffset + 10 <= bytes.length) {
      return {
        width: readUInt24LE(bytes, chunkDataOffset + 4) + 1,
        height: readUInt24LE(bytes, chunkDataOffset + 7) + 1,
      }
    }

    if (chunkType === "VP8 " && chunkDataOffset + 10 <= bytes.length) {
      return {
        width: readUInt16LE(bytes, chunkDataOffset + 6) & 0x3fff,
        height: readUInt16LE(bytes, chunkDataOffset + 8) & 0x3fff,
      }
    }

    if (chunkType === "VP8L" && chunkDataOffset + 5 <= bytes.length) {
      const b0 = bytes[chunkDataOffset + 1]
      const b1 = bytes[chunkDataOffset + 2]
      const b2 = bytes[chunkDataOffset + 3]
      const b3 = bytes[chunkDataOffset + 4]

      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      }
    }

    offset += 8 + chunkSize + (chunkSize % 2)
  }

  return null
}

function readAscii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function readUInt16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUInt16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUInt24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readUInt32BE(bytes, offset) {
  return (
    bytes[offset] * 16_777_216 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  )
}

function readUInt32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  )
}

function readString(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function readNestedNumber(value, keys) {
  if (!isRecord(value)) return null

  for (const key of keys) {
    const nested = readNumber(value[key])
    if (nested !== null) return nested
  }

  return null
}

function readBoolean(value) {
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return null
}

function readImageFormat(value) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : null

  if (normalized === "png" || normalized === "image/png") return "png"
  if (normalized === "webp" || normalized === "image/webp") return "webp"
  if (
    normalized === "jpg" ||
    normalized === "jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/jpeg"
  ) {
    return "jpg"
  }

  return null
}

function readLicense(value) {
  if (
    value === "self_owned" ||
    value === "cc0" ||
    value === "commercial_license"
  ) {
    return value
  }

  return null
}

function readIntegerEnv(name, fallback) {
  const rawValue = process.env[name]?.trim()
  const parsed = rawValue ? Number(rawValue) : fallback
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}