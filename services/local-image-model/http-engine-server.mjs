// 当前文件作用：启动 AI-PET-WORLD 本地 HTTP 图像引擎适配服务，固定提供 /health、/dry-run、/generate 入口。

import http from "node:http"
import { Buffer } from "node:buffer"
import { existsSync, readFileSync } from "node:fs"

const SERVER_NAME = "ai-pet-world-local-http-image-engine"
const SERVER_VERSION = "http-engine-server-env-files-2"

const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 7860
const DEFAULT_TIMEOUT_MS = 180_000
const MAX_REQUEST_BYTES = 1024 * 1024
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024

const RUNTIME_ENV = loadRuntimeEnv()
const CONFIG = readServerConfig(RUNTIME_ENV)

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    writeJson(response, 500, {
      ok: false,
      status: "local_http_image_engine_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
      engine: SERVER_NAME,
      version: SERVER_VERSION,
      canShowToPlayer: false,
    })
  })
})

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(
    JSON.stringify({
      ok: true,
      status: "local_http_image_engine_listening",
      engine: SERVER_NAME,
      version: SERVER_VERSION,
      endpoint: `http://${CONFIG.host}:${CONFIG.port}/generate`,
      healthEndpoint: `http://${CONFIG.host}:${CONFIG.port}/health`,
      backendEndpointConfigured: Boolean(CONFIG.backendEndpoint),
      canGenerateRealBitmap: Boolean(CONFIG.backendEndpoint),
      envFilesLoaded: CONFIG.envFilesLoaded,
      canShowToPlayer: false,
    })
  )
})

server.on("error", (error) => {
  console.error(
    JSON.stringify({
      ok: false,
      status: "local_http_image_engine_listen_failed",
      message: error instanceof Error ? error.message : String(error),
      engine: SERVER_NAME,
      version: SERVER_VERSION,
      canShowToPlayer: false,
    })
  )
  process.exitCode = 1
})

async function handleRequest(request, response) {
  const method = request.method ?? "GET"
  const url = new URL(request.url ?? "/", `http://${CONFIG.host}:${CONFIG.port}`)

  if (method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, buildHealthPayload())
    return
  }

  if (method === "POST" && url.pathname === "/dry-run") {
    const bodyResult = await readJsonBody(request)
    if (!bodyResult.ok) {
      writeJson(response, 400, bodyResult)
      return
    }

    writeJson(response, 200, {
      ok: true,
      status: "local_http_image_engine_dry_run_ready",
      engine: SERVER_NAME,
      version: SERVER_VERSION,
      receivedRequestKeys: Object.keys(readRecord(bodyResult.payload)).slice(0, 30),
      backendEndpointConfigured: Boolean(CONFIG.backendEndpoint),
      wouldForwardToBackend: Boolean(CONFIG.backendEndpoint),
      canGenerateRealBitmap: Boolean(CONFIG.backendEndpoint),
      canShowToPlayer: false,
      tags: ["local_http_image_engine", "dry_run", "not_player_visible"],
    })
    return
  }

  if (method === "POST" && url.pathname === "/generate") {
    const bodyResult = await readJsonBody(request)
    if (!bodyResult.ok) {
      writeJson(response, 400, bodyResult)
      return
    }

    const result = await handleGenerate(bodyResult.payload)
    writeJson(response, result.httpStatus, result.body)
    return
  }

  writeJson(response, 404, {
    ok: false,
    status: "local_http_image_engine_route_not_found",
    message: "本地 HTTP 图像引擎只提供 GET /health、POST /dry-run、POST /generate。",
    engine: SERVER_NAME,
    version: SERVER_VERSION,
    canShowToPlayer: false,
  })
}

async function handleGenerate(payload) {
  const request = readRecord(payload)

  if (request.canShowToPlayer !== false) {
    return {
      httpStatus: 400,
      body: buildFailure({
        status: "local_http_image_engine_visibility_invalid",
        message: "generate 请求必须保持 canShowToPlayer=false。",
      }),
    }
  }

  if (!CONFIG.backendEndpoint) {
    return {
      httpStatus: 503,
      body: buildFailure({
        status: "local_http_image_engine_backend_missing",
        message:
          "7860 HTTP engine 已启动，但尚未配置真实图像 backend。请配置 AI_PET_WORLD_LOCAL_IMAGE_ENGINE_BACKEND_ENDPOINT 后再执行真实出图。",
        detail: {
          expectedBackendResponseFields: ["imageBase64", "dataUrl", "imageUrl"],
          receivedRequestId: request.requestId ?? null,
          receivedImageFormat: request.imageFormat ?? null,
          receivedWidth: request.width ?? null,
          receivedHeight: request.height ?? null,
        },
      }),
    }
  }

  const backendResult = await forwardToBackend(request)
  return {
    httpStatus: backendResult.ok ? 200 : 502,
    body: backendResult,
  }
}

async function forwardToBackend(request) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), CONFIG.timeoutMs)

  try {
    const response = await fetch(CONFIG.backendEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        ...request,
        forwardedBy: SERVER_NAME,
        forwarderVersion: SERVER_VERSION,
        canShowToPlayer: false,
      }),
      signal: controller.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      return buildFailure({
        status: "local_http_image_engine_backend_http_failed",
        message: `真实图像 backend 返回非 2xx：${response.status}。`,
        detail: {
          backendEndpoint: CONFIG.backendEndpoint,
          statusCode: response.status,
          bodyPreview: text.slice(0, 512),
        },
      })
    }

    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      return buildFailure({
        status: "local_http_image_engine_backend_response_json_invalid",
        message: "真实图像 backend 返回内容不是合法 JSON。",
        detail: {
          backendEndpoint: CONFIG.backendEndpoint,
          bodyPreview: text.slice(0, 512),
        },
      })
    }

    if (!isRecord(payload)) {
      return buildFailure({
        status: "local_http_image_engine_backend_response_not_object",
        message: "真实图像 backend 必须返回 JSON 对象。",
      })
    }

    const normalized = normalizeBackendPayload(payload)
    if (!normalized.ok) return normalized

    return normalized
  } catch (error) {
    return buildFailure({
      status:
        error?.name === "AbortError"
          ? "local_http_image_engine_backend_timeout"
          : "local_http_image_engine_backend_fetch_failed",
      message: error instanceof Error ? error.message : String(error),
      detail: {
        backendEndpoint: CONFIG.backendEndpoint,
        errorName: error?.name ?? null,
        causeCode: error?.cause?.code ?? null,
        causeMessage: error?.cause?.message ?? null,
      },
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function normalizeBackendPayload(payload) {
  const imageBase64 = readOptionalString(
    payload.imageBase64 ?? payload.base64 ?? payload.image
  )
  const dataUrl = readOptionalString(payload.dataUrl ?? payload.imageDataUrl)
  const imageUrl = readOptionalString(
    payload.imageUrl ?? payload.url ?? payload.outputUrl ?? payload.publicUrl
  )

  if (!imageBase64 && !dataUrl && !imageUrl) {
    return buildFailure({
      status: "local_http_image_engine_backend_image_missing",
      message:
        "真实图像 backend 返回中没有 imageBase64 / dataUrl / imageUrl。",
      detail: {
        returnedKeys: Object.keys(payload).slice(0, 30),
      },
    })
  }

  return {
    ok: true,
    status: "local_http_image_engine_generated",
    imageBase64: imageBase64 || undefined,
    dataUrl: dataUrl || undefined,
    imageUrl: imageUrl || undefined,
    width: payload.width,
    height: payload.height,
    imageFormat: payload.imageFormat,
    license: payload.license,
    originalityConfirmed: payload.originalityConfirmed,
    canShowToPlayer: false,
    engine: SERVER_NAME,
    version: SERVER_VERSION,
    tags: ["local_http_image_engine", "backend_forwarded", "not_player_visible"],
  }
}

function buildHealthPayload() {
  return {
    ok: true,
    status: "local_http_image_engine_ready",
    engine: SERVER_NAME,
    version: SERVER_VERSION,
    host: CONFIG.host,
    port: CONFIG.port,
    endpoint: `http://${CONFIG.host}:${CONFIG.port}/generate`,
    backendEndpointConfigured: Boolean(CONFIG.backendEndpoint),
    backendEndpoint: CONFIG.backendEndpoint || null,
    envFilesLoaded: CONFIG.envFilesLoaded,
    canAcceptGenerateRequests: true,
    canGenerateRealBitmap: Boolean(CONFIG.backendEndpoint),
    canShowToPlayer: false,
    tags: ["local_http_image_engine", "health", "not_player_visible"],
  }
}

async function readJsonBody(request) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    totalBytes += buffer.length

    if (totalBytes > MAX_REQUEST_BYTES) {
      return buildFailure({
        status: "local_http_image_engine_request_too_large",
        message: "请求体超过本地 HTTP 图像引擎限制。",
      })
    }

    chunks.push(buffer)
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()

  if (!text) {
    return buildFailure({
      status: "local_http_image_engine_request_empty",
      message: "请求体不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "local_http_image_engine_request_not_object",
          message: "请求体必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "local_http_image_engine_request_json_invalid",
      message: "请求体不是合法 JSON。",
    })
  }
}

function readServerConfig(env) {
  const host =
    readOptionalString(env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_HOST) ||
    DEFAULT_HOST
  const endpoint = readOptionalString(env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_ENDPOINT)
  const portFromEndpoint = readPortFromEndpoint(endpoint)
  const port =
    readPositiveInteger(env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_PORT) ??
    portFromEndpoint ??
    DEFAULT_PORT
  const backendEndpoint = readOptionalString(
    env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_BACKEND_ENDPOINT
  )
  const timeoutMs =
    readPositiveInteger(env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS) ??
    DEFAULT_TIMEOUT_MS

  return {
    host,
    port,
    backendEndpoint,
    timeoutMs,
    envFilesLoaded: env.__envFilesLoaded,
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
    __envFilesLoaded: parsedFiles
      .filter((file) => Object.keys(file.entries).length > 0)
      .map((file) => file.filePath),
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

function readPortFromEndpoint(endpoint) {
  if (!endpoint) return null

  try {
    const url = new URL(endpoint)
    return readPositiveInteger(url.port)
  } catch {
    return null
  }
}

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message ?? null,
    detail: input.detail ?? null,
    engine: SERVER_NAME,
    version: SERVER_VERSION,
    canShowToPlayer: false,
    tags: ["local_http_image_engine", "failed", "not_player_visible"],
  }
}

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)
  const bodyBytes = Buffer.byteLength(body)

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": String(Math.min(bodyBytes, MAX_RESPONSE_BYTES)),
  })

  response.end(bodyBytes > MAX_RESPONSE_BYTES ? body.slice(0, MAX_RESPONSE_BYTES) : body)
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function readPositiveInteger(value) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function readRecord(value) {
  return isRecord(value) ? value : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
