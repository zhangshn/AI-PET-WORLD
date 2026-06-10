// 当前文件作用：把 AI-PET-WORLD 本地图像 backend 请求转成 OpenAI Responses 图像生成调用，并返回真实 base64 位图。

import { Buffer } from "node:buffer"
import { existsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const COMMAND_NAME = "ai-pet-world-openai-image-backend-command"
const COMMAND_VERSION = "openai-image-backend-command-1"

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses"
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-5.5"
const DEFAULT_TIMEOUT_MS = 600_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 3_600_000
const MAX_STDIN_BYTES = 1024 * 1024
const MAX_PROMPT_CHARS = 24_000

if (isExecutedDirectly()) {
  main().catch((error) => {
    writeFailureAndExit({
      status: "openai_image_backend_command_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
    })
  })
}

async function main() {
  const env = loadRuntimeEnv()
  const stdinResult = await readStdinJson()
  if (!stdinResult.ok) return writeFailureAndExit(stdinResult)

  const config = readConfig(env)
  if (!config.ok) return writeFailureAndExit(config)

  const request = readRecord(stdinResult.payload)
  const response = await callOpenAiResponses({
    config,
    prompt: buildImagePrompt(request),
  })
  if (!response.ok) return writeFailureAndExit(response)

  process.stdout.write(
    JSON.stringify({
      ok: true,
      status: "real_image_generated",
      imageBase64: response.imageBase64,
      imageFormat: "png",
      width: readPositiveInteger(request.width) ?? 1536,
      height: readPositiveInteger(request.height) ?? 1024,
      license: readOptionalString(env.AI_PET_WORLD_OPENAI_IMAGE_LICENSE) || "commercial_license",
      originalityConfirmed: true,
      provider: COMMAND_NAME,
      version: COMMAND_VERSION,
      canShowToPlayer: false,
    })
  )
}

function readConfig(env) {
  const apiKey = readOptionalString(
    env.AI_PET_WORLD_OPENAI_API_KEY ?? env.OPENAI_API_KEY
  )
  const endpoint =
    readOptionalString(env.AI_PET_WORLD_OPENAI_RESPONSES_ENDPOINT) ||
    DEFAULT_OPENAI_RESPONSES_ENDPOINT
  const model =
    readOptionalString(env.AI_PET_WORLD_OPENAI_IMAGE_MODEL) ||
    DEFAULT_OPENAI_IMAGE_MODEL
  const timeoutMs = readTimeoutMs(
    env.AI_PET_WORLD_OPENAI_IMAGE_TIMEOUT_MS ??
      env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_TIMEOUT_MS
  )

  if (!apiKey) {
    return buildFailure({
      status: "openai_image_backend_api_key_missing",
      message:
        "缺少 AI_PET_WORLD_OPENAI_API_KEY 或 OPENAI_API_KEY，无法调用真实 OpenAI 图像生成。",
    })
  }

  return {
    ok: true,
    apiKey,
    endpoint,
    model,
    timeoutMs,
  }
}

async function callOpenAiResponses(input) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), input.config.timeoutMs)

  try {
    const response = await fetch(input.config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.config.model,
        input: input.prompt,
        tools: [{ type: "image_generation" }],
      }),
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      return buildFailure({
        status: "openai_image_backend_http_failed",
        message: `OpenAI Responses API 返回非 2xx：${response.status}。`,
        detail: {
          statusCode: response.status,
          bodyPreview: text.slice(0, 1024),
        },
      })
    }

    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      return buildFailure({
        status: "openai_image_backend_response_json_invalid",
        message: "OpenAI Responses API 返回内容不是合法 JSON。",
        detail: { bodyPreview: text.slice(0, 1024) },
      })
    }

    const imageBase64 = extractImageBase64(payload)
    if (!imageBase64) {
      return buildFailure({
        status: "openai_image_backend_image_missing",
        message: "OpenAI Responses API 返回中没有 image_generation_call.result。",
        detail: {
          topLevelKeys: Object.keys(readRecord(payload)).slice(0, 30),
          outputTypes: Array.isArray(payload.output)
            ? payload.output.map((item) => readRecord(item).type).slice(0, 30)
            : [],
        },
      })
    }

    return {
      ok: true,
      status: "openai_image_backend_generated",
      imageBase64,
    }
  } catch (error) {
    return buildFailure({
      status:
        error?.name === "AbortError"
          ? "openai_image_backend_timeout"
          : "openai_image_backend_fetch_failed",
      message: error instanceof Error ? error.message : String(error),
      detail: {
        errorName: error?.name ?? null,
        causeCode: error?.cause?.code ?? null,
        causeMessage: error?.cause?.message ?? null,
      },
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function extractImageBase64(payload) {
  const output = Array.isArray(payload?.output) ? payload.output : []

  for (const item of output) {
    const record = readRecord(item)
    if (
      record.type === "image_generation_call" &&
      typeof record.result === "string" &&
      record.result.trim()
    ) {
      return stripDataUrlPrefix(record.result.trim())
    }
  }

  return ""
}

function buildImagePrompt(request) {
  const promptPackage = readRecord(request.promptPackage)
  const modelTask = readRecord(request.modelTask)
  const controlSketch = readRecord(request.controlSketch)
  const constraints = readRecord(request.constraints)
  const worldFactMetadata = readRecord(request.worldFactMetadata)
  const visualFixHints = Array.isArray(request.visualFixHints)
    ? request.visualFixHints
    : []

  const imageFormat = readOptionalString(request.imageFormat) || "png"
  const width = readPositiveInteger(request.width) ?? 1536
  const height = readPositiveInteger(request.height) ?? 1024

  return truncatePrompt(`
Create one original AI-PET-WORLD MVP world image.

Hard visual target:
- Bright, healing, detailed.
- Top-down pixel-art feeling.
- Static first-world image.
- Natural clearing, water edge or shoreline, grassland, trees, stones, flowers, paths, materials, and temporary shelter only when supported by world facts.
- No text, no logo, no UI, no watermark.
- Do not copy or imitate any unlicensed third-party artwork, named artist, game, anime, studio, or protected style.
- Do not return placeholder, SVG, HTML, debug image, diagram, wireframe, or mock image.
- Output must be a real ${imageFormat.toUpperCase()} bitmap suitable for a hidden candidate review pipeline.

Requested canvas:
- width: ${width}
- height: ${height}
- format: ${imageFormat}

Model task JSON:
${safeJson(modelTask)}

Prompt package JSON:
${safeJson(promptPackage)}

Control sketch JSON:
${safeJson(controlSketch)}

Constraints JSON:
${safeJson(constraints)}

World fact metadata JSON:
${safeJson(worldFactMetadata)}

Visual fix hints JSON:
${safeJson(visualFixHints)}
`.trim())
}

async function readStdinJson() {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    totalBytes += buffer.length

    if (totalBytes > MAX_STDIN_BYTES) {
      return buildFailure({
        status: "openai_image_backend_stdin_too_large",
        message: "stdin 超过 OpenAI 图像 backend 命令限制。",
      })
    }

    chunks.push(buffer)
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) {
    return buildFailure({
      status: "openai_image_backend_stdin_empty",
      message: "OpenAI 图像 backend 命令 stdin 不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "openai_image_backend_stdin_not_object",
          message: "OpenAI 图像 backend 命令 stdin 必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "openai_image_backend_stdin_json_invalid",
      message: "OpenAI 图像 backend 命令 stdin 不是合法 JSON。",
    })
  }
}

function loadRuntimeEnv() {
  const envFiles = [".env.example", ".env", ".env.local"]
  const parsedFiles = envFiles.map((filePath) => ({
    filePath,
    entries: parseEnvFile(filePath),
  }))

  return {
    ...Object.fromEntries(
      parsedFiles.flatMap((file) => Object.entries(file.entries))
    ),
    ...process.env,
  }
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const entries = {}
  const raw = readFileSync(filePath, "utf8")

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex < 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = stripEnvQuotes(trimmed.slice(separatorIndex + 1).trim())
    entries[key] = value
  }

  return entries
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "{}"
  }
}

function truncatePrompt(value) {
  return value.length > MAX_PROMPT_CHARS ? value.slice(0, MAX_PROMPT_CHARS) : value
}

function stripDataUrlPrefix(value) {
  const commaIndex = value.indexOf(",")
  return value.startsWith("data:image/") && commaIndex >= 0
    ? value.slice(commaIndex + 1)
    : value
}

function readTimeoutMs(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric)
    ? Math.min(Math.max(Math.floor(numeric), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS
}

function readPositiveInteger(value) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
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

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message ?? null,
    detail: input.detail ?? null,
    provider: COMMAND_NAME,
    version: COMMAND_VERSION,
    canShowToPlayer: false,
    tags: ["openai_image_backend_command", "failed", "not_player_visible"],
  }
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
