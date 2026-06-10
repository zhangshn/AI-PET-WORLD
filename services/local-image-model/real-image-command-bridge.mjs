// 当前文件作用：定义真实本地图像模型命令桥接层；只转发标准推理请求并校验真实模型 stdout，不生成假图或程序绘图。

import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

import {
  validateRealImageExecutionRequest,
  validateRealImageExecutionStdoutPayload,
} from "./real-image-execution-contract.mjs"

export const REAL_IMAGE_COMMAND_BRIDGE_NAME =
  "ai-pet-world-real-image-command-bridge"
export const REAL_IMAGE_COMMAND_BRIDGE_VERSION = "real-command-bridge-1"
export const REAL_IMAGE_COMMAND_BRIDGE_ENV = {
  command: "AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND",
  argsJson: "AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON",
  timeoutMs: "AI_PET_WORLD_REAL_IMAGE_MODEL_TIMEOUT_MS",
  outputDirectory: "AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR",
}

const MAX_STDOUT_BYTES = 1024 * 1024
const MAX_STDERR_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 600_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 3_600_000
const KILL_GRACE_MS = 1_000

if (isExecutedDirectly()) {
  main().catch((error) => {
    writeFailureAndExit({
      status: "real_image_command_bridge_unhandled_error",
      message: error instanceof Error ? error.message : String(error),
    })
  })
}

export function readRealImageCommandBridgeConfig(input = {}) {
  const argsResult = readArgsJson(
    input.argsJson ?? process.env[REAL_IMAGE_COMMAND_BRIDGE_ENV.argsJson]
  )

  return {
    command: readOptionalString(
      input.command ?? process.env[REAL_IMAGE_COMMAND_BRIDGE_ENV.command]
    ),
    args: argsResult.args,
    argsValid: argsResult.ok,
    argsJsonConfigured: Boolean(
      readOptionalString(
        input.argsJson ?? process.env[REAL_IMAGE_COMMAND_BRIDGE_ENV.argsJson]
      )
    ),
    timeoutMs: readTimeoutMs(
      input.timeoutMs ?? process.env[REAL_IMAGE_COMMAND_BRIDGE_ENV.timeoutMs]
    ),
    outputDirectory: readOptionalString(
      input.outputDirectory ??
        process.env[REAL_IMAGE_COMMAND_BRIDGE_ENV.outputDirectory]
    ),
  }
}

export function readRealImageCommandBridgeHealth(input = {}) {
  const config = readRealImageCommandBridgeConfig(input)

  if (!config.command) {
    return buildHealthFailure({
      status: "real_image_command_bridge_model_command_missing",
      config,
      tags: ["model_command_missing"],
    })
  }

  if (!config.argsValid) {
    return buildHealthFailure({
      status: "real_image_command_bridge_model_args_invalid",
      config,
      tags: ["model_args_invalid"],
    })
  }

  if (!config.outputDirectory) {
    return buildHealthFailure({
      status: "real_image_command_bridge_output_directory_missing",
      config,
      tags: ["output_directory_missing"],
    })
  }

  return {
    ok: true,
    status: "real_image_command_bridge_ready",
    bridge: REAL_IMAGE_COMMAND_BRIDGE_NAME,
    version: REAL_IMAGE_COMMAND_BRIDGE_VERSION,
    modelCommandConfigured: true,
    modelArgsValid: true,
    outputDirectoryConfigured: true,
    timeoutMs: config.timeoutMs,
    canBridgeRealModelCommand: true,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    willWriteOutputFile: false,
    canShowToPlayer: false,
    tags: [
      "real_image_command_bridge",
      "bridge_ready",
      "model_command_configured",
      "does_not_execute_on_health",
      "not_player_visible",
    ],
  }
}

export async function runRealImageCommandBridge(input = {}) {
  const request = readRecord(input.request)
  const config = readRealImageCommandBridgeConfig(input.config ?? {})

  if (!config.command) {
    return buildFailure({
      status: "real_image_command_bridge_model_command_missing",
      message: "缺少 AI_PET_WORLD_REAL_IMAGE_MODEL_COMMAND。",
    })
  }

  if (!config.argsValid) {
    return buildFailure({
      status: "real_image_command_bridge_model_args_invalid",
      message: "AI_PET_WORLD_REAL_IMAGE_MODEL_ARGS_JSON 必须是字符串数组 JSON。",
    })
  }

  if (!config.outputDirectory) {
    return buildFailure({
      status: "real_image_command_bridge_output_directory_missing",
      message: "缺少 AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR。",
    })
  }

  const requestValidation = validateRealImageExecutionRequest(request)
  if (!requestValidation.ok) {
    return buildFailure({
      status: "real_image_command_bridge_request_invalid",
      detail: requestValidation,
    })
  }

  if (request.canShowToPlayer !== false) {
    return buildFailure({
      status: "real_image_command_bridge_request_visibility_invalid",
      message: "真实模型桥接请求必须保持 canShowToPlayer=false。",
    })
  }

  const commandResult = await runModelCommand({ config, request })
  if (!commandResult.ok) return commandResult

  const stdoutResult = parseStdoutJson(commandResult.stdoutText)
  if (!stdoutResult.ok) return stdoutResult

  const stdoutValidation = validateRealImageExecutionStdoutPayload(
    stdoutResult.payload
  )
  if (!stdoutValidation.ok) {
    return buildFailure({
      status: "real_image_command_bridge_stdout_contract_invalid",
      detail: stdoutValidation,
    })
  }

  if (stdoutValidation.imageFileName !== request.outputFileName) {
    return buildFailure({
      status: "real_image_command_bridge_output_file_name_mismatch",
      message: "真实模型 stdout imageFileName 必须等于 request.outputFileName。",
      detail: {
        expectedOutputFileName: request.outputFileName,
        actualOutputFileName: stdoutValidation.imageFileName,
      },
    })
  }

  return {
    ok: true,
    status: "real_image_command_bridge_completed",
    imageFileName: stdoutValidation.imageFileName,
    imageFormat: stdoutValidation.imageFormat,
    width: stdoutValidation.width,
    height: stdoutValidation.height,
    license: stdoutValidation.license,
    originalityConfirmed: stdoutValidation.originalityConfirmed,
    canShowToPlayer: false,
    bridge: REAL_IMAGE_COMMAND_BRIDGE_NAME,
    version: REAL_IMAGE_COMMAND_BRIDGE_VERSION,
    tags: [
      "real_image_command_bridge",
      "model_command_completed",
      "stdout_contract_valid",
      "not_player_visible",
    ],
  }
}

async function main() {
  const stdinResult = await readStdinJson()
  if (!stdinResult.ok) {
    writeFailureAndExit(stdinResult)
    return
  }

  const result = await runRealImageCommandBridge({ request: stdinResult.payload })
  if (!result.ok) {
    writeFailureAndExit(result)
    return
  }

  process.stdout.write(
    JSON.stringify({
      ok: true,
      status: "real_image_generated",
      imageFileName: result.imageFileName,
      imageFormat: result.imageFormat,
      width: result.width,
      height: result.height,
      license: result.license,
      originalityConfirmed: result.originalityConfirmed,
      canShowToPlayer: false,
    })
  )
}

async function runModelCommand(input) {
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
      childProcess = spawn(input.config.command, input.config.args, {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: input.config.outputDirectory,
          AI_PET_WORLD_REAL_IMAGE_OUTPUT_FILE_NAME: input.request.outputFileName,
          AI_PET_WORLD_REAL_IMAGE_OUTPUT_FORMAT: input.request.imageFormat,
          AI_PET_WORLD_REAL_IMAGE_OUTPUT_WIDTH: String(input.request.width),
          AI_PET_WORLD_REAL_IMAGE_OUTPUT_HEIGHT: String(input.request.height),
        },
      })
    } catch {
      return finish(buildFailure({ status: "real_image_command_bridge_spawn_failed" }))
    }

    timeoutHandle = setTimeout(() => {
      timedOut = true
      childProcess.kill("SIGTERM")
      killHandle = setTimeout(() => childProcess.kill("SIGKILL"), KILL_GRACE_MS)
    }, input.config.timeoutMs)

    childProcess.stdout.on("data", (chunk) => appendTextCapture(stdoutCapture, chunk))
    childProcess.stderr.on("data", (chunk) => appendTextCapture(stderrCapture, chunk))
    childProcess.on("error", () => {
      finish(buildFailure({ status: "real_image_command_bridge_spawn_error" }))
    })
    childProcess.on("close", (exitCode, signal) => {
      if (timedOut) {
        finish(
          buildFailure({
            status: "real_image_command_bridge_timeout",
            detail: {
              exitCode,
              signal,
              stdoutTruncated: stdoutCapture.truncated,
              stderrCaptured: stderrCapture.text.length > 0,
              stderrTruncated: stderrCapture.truncated,
            },
          })
        )
        return
      }

      if (exitCode !== 0) {
        finish(
          buildFailure({
            status: "real_image_command_bridge_exit_non_zero",
            detail: {
              exitCode,
              signal,
              stderrCaptured: stderrCapture.text.length > 0,
              stderrTruncated: stderrCapture.truncated,
            },
          })
        )
        return
      }

      if (stdoutCapture.truncated) {
        finish(buildFailure({ status: "real_image_command_bridge_stdout_too_large" }))
        return
      }

      finish({
        ok: true,
        status: "real_image_command_bridge_process_completed",
        stdoutText: stdoutCapture.text,
      })
    })

    childProcess.stdin.on("error", () => {})
    childProcess.stdin.end(JSON.stringify(input.request))
  })
}

async function readStdinJson() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) {
    return buildFailure({
      status: "real_image_command_bridge_stdin_empty",
      message: "真实模型命令桥接 stdin 不能为空。",
    })
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({ status: "real_image_command_bridge_stdin_not_object" })
  } catch {
    return buildFailure({ status: "real_image_command_bridge_stdin_json_invalid" })
  }
}

function parseStdoutJson(stdoutText) {
  const text = typeof stdoutText === "string" ? stdoutText.trim() : ""
  if (!text) return buildFailure({ status: "real_image_command_bridge_stdout_empty" })

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : buildFailure({ status: "real_image_command_bridge_stdout_not_object" })
  } catch {
    return buildFailure({ status: "real_image_command_bridge_stdout_json_invalid" })
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

function buildHealthFailure(input) {
  return {
    ok: false,
    status: input.status,
    bridge: REAL_IMAGE_COMMAND_BRIDGE_NAME,
    version: REAL_IMAGE_COMMAND_BRIDGE_VERSION,
    modelCommandConfigured: Boolean(input.config.command),
    modelArgsValid: input.config.argsValid,
    outputDirectoryConfigured: Boolean(input.config.outputDirectory),
    timeoutMs: input.config.timeoutMs,
    canBridgeRealModelCommand: false,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    willWriteOutputFile: false,
    canShowToPlayer: false,
    tags: ["real_image_command_bridge", ...input.tags, "not_player_visible"],
  }
}

function buildFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message ?? null,
    detail: input.detail ?? null,
    bridge: REAL_IMAGE_COMMAND_BRIDGE_NAME,
    version: REAL_IMAGE_COMMAND_BRIDGE_VERSION,
    canShowToPlayer: false,
    tags: ["real_image_command_bridge", "failed", "not_player_visible"],
  }
}

function writeFailureAndExit(input) {
  process.stderr.write(JSON.stringify(input))
  process.exitCode = 1
}

function createTextCapture(maxBytes) {
  return { text: "", bytes: 0, maxBytes, truncated: false }
}

function appendTextCapture(capture, chunk) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
  const remaining = capture.maxBytes - capture.bytes
  if (remaining <= 0) {
    capture.truncated = true
    return
  }

  const piece = buffer.subarray(0, remaining)
  capture.text += piece.toString("utf8")
  capture.bytes += piece.length
  if (piece.length < buffer.length) capture.truncated = true
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function readRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isExecutedDirectly() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false
}
