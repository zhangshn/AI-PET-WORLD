// 当前文件作用：启动 AI-PET-WORLD 本地真实图像 backend 命令服务，固定提供 /health、/generate 入口并只桥接真实 AI 出图命令。

import http from "node:http"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const SERVER_NAME = "ai-pet-world-local-image-backend-command-server"
const SERVER_VERSION = "backend-command-server-1"

const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 8188
const DEFAULT_TIMEOUT_MS = 600_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 3_600_000
const MAX_REQUEST_BYTES = 1024 * 1024
const MAX_STDOUT_BYTES = 32 * 1024 * 1024
const MAX_STDERR_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
const KILL_GRACE_MS = 1_000

const RUNTIME_ENV = loadRuntimeEnv()
const CONFIG = readServerConfig(RUNTIME_ENV)

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    writeJson(response, 500, {
      ok: false,
      status: "local_image_backend_command_server_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
      backend: SERVER_NAME,
      version: SERVER_VERSION,
      canShowToPlayer: false,
    })
  })
})

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(
    JSON.stringify({
      ok: true,
      status: "local_image_backend_command_server_listening",
      backend: SERVER_NAME,
      version: SERVER_VERSION,
      endpoint: `http://${CONFIG.host}:${CONFIG.port}/generate`,
      healthEndpoint: `http://${CONFIG.host}:${CONFIG.port}/health`,
      backendCommandConfigured: Boolean(CONFIG.command),
      backendArgsValid: CONFIG.argsValid,
      canGenerateRealBitmap: Boolean(CONFIG.command) && CONFIG.argsValid,
      envFilesLoaded: CONFIG.envFilesLoaded,
      canShowToPlayer: false,
    })
  )
})

server.on("error", (error) => {
  console.error(
    JSON.stringify({
      ok: false,
      status: "local_image_backend_command_server_listen_failed",
      message: error instanceof Error ? error.message : String(error),
      backend: SERVER_NAME,
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
    status: "local_image_backend_command_server_route_not_found",
    message: "本地真实图像 backend 命令服务只提供 GET /health、POST /generate。",
    backend: SERVER_NAME,
    version: SERVER_VERSION,
    canShowToPlayer: false,
  })
}

function buildHealthPayload() {
  return {
    ok: true,
    status: "local_image_backend_command_server_ready",
    backend: SERVER_NAME,
    version: SERVER_VERSION,
    host: CONFIG.host,
    port: CONFIG.port,
    endpoint: `http://${CONFIG.host}:${CONFIG.port}/generate`,
    backendCommandConfigured: Boolean(CONFIG.command),
    backendArgsValid: CONFIG.argsValid,
    timeoutMs: CONFIG.timeoutMs,
    canAcceptGenerateRequests: true,
    canGenerateRealBitmap: Boolean(CONFIG.command) && CONFIG.argsValid,
    envFilesLoaded: CONFIG.envFilesLoaded,
    requiredCommandEnv: "AI_PET_WORLD_LOCAL_IMAGE_BACKEND_COMMAND",
    optionalArgsEnv: "AI_PET_WORLD_LOCAL_IMAGE_BACKEND_ARGS_JSON",
    canShowToPlayer: false,
    tags: ["local_image_backend_command_server", "health", "not_player_visible"],
  }
}

async function handleGenerate(payload) {
  const request = readRecord(payload)

  if (request.canShowToPlayer !== false) {
    return {
      httpStatus: 400,
      body: buildFailure({
        status: "local_image_backend_command_visibility_invalid",
        message: "backend generate 请求必须保持 canShowToPlayer=false。",
      }),
    }
  }

  if (!CONFIG.command) {
    return {
      httpStatus: 503,
      body: buildFailure({
        status: "local_image_backend_command_missing",
        message:
          "8188 backend 已启动，但尚未配置真实 AI 出图命令。请配置 AI_PET_WORLD_LOCAL_IMAGE_BACKEND_COMMAND。",
        detail: buildRequestSummary(request),
      }),
    }
  }

  if (!CONFIG.argsValid) {
    return {
      httpStatus: 503,
      body: buildFailure({
        status: "local_image_backend_command_args_invalid",
        message:
          "AI_PET_WORLD_LOCAL_IMAGE_BACKEND_ARGS_JSON 必须是字符串数组 JSON。",
        detail: buildRequestSummary(request),
      }),
    }
  }

  const commandResult = await runBackendCommand(request)
  return {
    httpStatus: commandResult.ok ? 200 : 502,
    body: commandResult,
  }
}

async function runBackendCommand(request) {
  const stdoutCapture = createTextCapture(MAX_STDOUT_BYTES)
  const stderrCapture = createTextCapture(MAX_STDERR_BYTES)
  let childProcess
  let timeoutHandle
  let killHandle
  let timedOut = false
  let settled = false

  return new Promise((resolve) => {
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      clearTimeout(killHandle)
      resolve(result)
    }

    try {
      childProcess = spawn(CONFIG.command, CONFIG.args, {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          AI_PET_WORLD_LOCAL_IMAGE_BACKEND_REQUEST_ID: String(
            request.requestId ?? ""
          ),
          AI_PET_WORLD_LOCAL_IMAGE_BACKEND_OUTPUT_FILE_NAME: String(
            request.outputFileName ?? ""
          ),
          AI_PET_WORLD_LOCAL_IMAGE_BACKEND_OUTPUT_FORMAT: String(
            request.imageFormat ?? "png"
          ),
          AI_PET_WORLD_LOCAL_IMAGE_BACKEND_OUTPUT_WIDTH: String(
            request.width ?? ""
          ),
          AI_PET_WORLD_LOCAL_IMAGE_BACKEND_OUTPUT_HEIGHT: String(
            request.height ?? ""
          ),
        },
      })
    } catch (error) {
      finish(
        buildFailure({
          status: "local_image_backend_command_spawn_failed",
          message: error instanceof Error ? error.message : String(error),
          detail: buildRequestSummary(request),
        })
      )
      return
    }

    timeoutHandle = setTimeout(() => {
      timedOut = true
      childProcess.kill("SIGTERM")
      killHandle = setTimeout(() => childProcess.kill("SIGKILL"), KILL_GRACE_MS)
    }, CONFIG.timeoutMs)

    childProcess.stdout.on("data", (chunk) => appendTextCapture(stdoutCapture, chunk))
    childProcess.stderr.on("data", (chunk) => appendTextCapture(stderrCapture, chunk))
    childProcess.on("error", (error) => {
      finish(
        buildFailure({
          status: "local_image_backend_command_spawn_error",
          message: error instanceof Error ? error.message : String(error),
          detail: buildRequestSummary(request),
        })
      )
    })
    childProcess.on("close", (exitCode, signal) => {
      if (timedOut) {
        finish(
          buildFailure({
            status: "local_image_backend_command_timeout",
            message: "真实 AI 出图命令执行超时。",
            detail: {
              ...buildRequestSummary(request),
              exitCode,
              signal,
              stderrCaptured: stderrCapture.text.length > 0,
              stderrTruncated: stderrCapture.truncated,
              stderrPreview: stderrCapture.text.slice(0, 4096) || null,
            },
          })
        )
        return
      }

      if (exitCode !== 0) {
        finish(
          buildFailure({
            status: "local_image_backend_command_exit_non_zero",
            message: "真实 AI 出图命令非零退出。",
            detail: {
              ...buildRequestSummary(request),
              exitCode,
              signal,
              stderrCaptured: stderrCapture.text.length > 0,
              stderrTruncated: stderrCapture.truncated,
              stderrPreview: stderrCapture.text.slice(0, 4096) || null,
              stdoutPreview: stdoutCapture.text.slice(0, 4096) || null,
            },
          })
        )
        return
      }

      if (stdoutCapture.truncated) {
        finish(
          buildFailure({
            status: "local_image_backend_command_stdout_too_large",
            message: "真实 AI 出图命令 stdout 超过限制。",
            detail: buildRequestSummary(request),
          })
        )
        return
      }

      const stdoutResult = parseStdoutJson(stdoutCapture.text)
      if (!stdoutResult.ok) {
        finish(stdoutResult)
        return
      }

      const normalized = normalizeCommandPayload(stdoutResult.payload)
      finish(normalized)
    })

    childProcess.stdin.on("error", () => {})
    childProcess.stdin.end(JSON.stringify(request))
  })
}

function normalizeCommandPayload(payload) {
  const imageBase64 = readOptionalString(
    payload.imageBase64 ?? payload.base64 ?? payload.image
  )
  const dataUrl = readOptionalString(payload.dataUrl ?? payload.imageDataUrl)
  const imageUrl = readOptionalString(
    payload.imageUrl ?? payload.url ?? payload.outputUrl ?? payload.publicUrl
  )

  if (!imageBase64 && !dataUrl && !imageUrl) {
    return buildFailure({
      status: "local_image_backend_command_image_missing",
      message: "真实 AI 出图命令 stdout 缺少 imageBase64 / dataUrl / imageUrl。",
      detail: {
        returnedKeys: Object.keys(readRecord(payload)).slice(0, 30),
      },
    })
  }

  return {
    ok: true,
    status: "local_image_backend_command_generated",
    imageBase64: imageBase64 || undefined,
    dataUrl: dataUrl || undefined,
    imageUrl: imageUrl || undefined,
    imageFormat: payload.imageFormat,
    width: payload.width,
    height: payload.height,
    license: payload.license ?? "self_owned",
    originalityConfirmed: payload.originalityConfirmed === true,
    backend: SERVER_NAME,
    version: SERVER_VERSION,
    canShowToPlayer: false,
    tags: ["local_image_backend_command_server", "generated", "not_player_visible"],
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
        status: "local_image_backend_command_request_too_large",
        message: "请求体超过本地 backend 命令服务限制。",
      })
    }

    chunks.push(buffer)
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()

  if (!text) {
    return buildFailure({
      status: "local_image_backend_command_request_empty",
      message: "请求体不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "local_image_backend_command_request_not_object",
          message: "请求体必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "local_image_backend_command_request_json_invalid",
      message: "请求体不是合法 JSON。",
    })
  }
}

function parseStdoutJson(stdoutText) {
  const text = typeof stdoutText === "string" ? stdoutText.trim() : ""

  if (!text) {
    return buildFailure({
      status: "local_image_backend_command_stdout_empty",
      message: "真实 AI 出图命令 stdout 不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({
          status: "local_image_backend_command_stdout_not_object",
          message: "真实 AI 出图命令 stdout 必须是 JSON 对象。",
        })
  } catch {
    return buildFailure({
      status: "local_image_backend_command_stdout_json_invalid",
      message: "真实 AI 出图命令 stdout 不是合法 JSON。",
      detail: { stdoutPreview: text.slice(0, 4096) },
    })
  }
}

function readServerConfig(env) {
  const host =
    readOptionalString(env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_HOST) ||
    DEFAULT_HOST
  const port =
    readPositiveInteger(env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_PORT) ?? DEFAULT_PORT
  const command = readOptionalString(env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_COMMAND)
  const argsResult = readArgsJson(env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_ARGS_JSON)
  const timeoutMs = readTimeoutMs(
    env.AI_PET_WORLD_LOCAL_IMAGE_BACKEND_TIMEOUT_MS ??
      env.AI_PET_WORLD_LOCAL_IMAGE_ENGINE_TIMEOUT_MS
  )

  return {
    host,
    port,
    command,
    args: argsResult.args,
    argsValid: argsResult.ok,
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

function buildRequestSummary(request) {
  return {
    requestId: request.requestId ?? null,
    outputFileName: request.outputFileName ?? null,
    imageFormat: request.imageFormat ?? null,
    width: request.width ?? null,
    height: request.height ?? null,
    promptPackageConfigured: isRecord(request.promptPackage),
    modelTaskConfigured: isRecord(request.modelTask),
  }
}

function readArgsJson(value) {
  if (typeof value !== "string" || !value.trim()) return { ok: true, args: [] }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? { ok: true, args: parsed }
      : { ok: false, args: [] }
  } catch {
    return { ok: false, args: [] }
  }
}

function readTimeoutMs(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric)
    ? Math.min(Math.max(Math.floor(numeric), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS
}

function createTextCapture(limitBytes) {
  return {
    text: "",
    bytes: 0,
    limitBytes,
    truncated: false,
  }
}

function appendTextCapture(capture, chunk) {
  if (capture.truncated) return

  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
  const nextBytes = capture.bytes + Buffer.byteLength(text)

  if (nextBytes > capture.limitBytes) {
    const remaining = Math.max(capture.limitBytes - capture.bytes, 0)
    capture.text += Buffer.from(text).subarray(0, remaining).toString("utf8")
    capture.bytes = capture.limitBytes
    capture.truncated = true
    return
  }

  capture.text += text
  capture.bytes = nextBytes
}

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message ?? null,
    detail: input.detail ?? null,
    backend: SERVER_NAME,
    version: SERVER_VERSION,
    canShowToPlayer: false,
    tags: ["local_image_backend_command_server", "failed", "not_player_visible"],
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
