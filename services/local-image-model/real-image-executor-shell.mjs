// 当前文件作用：定义 AI-PET-WORLD 自研真实图像推理执行器 shell；通过显式环境开关接入 child_process 命令执行边界。

import { spawn } from "node:child_process"
import fs from "node:fs/promises"

import {
  buildRealImageExecutionContract,
  DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  MAX_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  MIN_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  validateRealImageExecutionRequest,
  validateRealImageExecutionStdoutPayload,
} from "./real-image-execution-contract.mjs"
import { buildLocalImageOutputReference } from "./output-storage.mjs"

export const REAL_IMAGE_EXECUTOR_SHELL_ENV = {
  enabled: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED",
  command: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND",
  argsJson: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON",
  timeoutMs: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS",
}

const EXECUTOR_SHELL_NAME = "ai-pet-world-real-image-executor-shell"
const EXECUTOR_SHELL_VERSION = "executor-shell-child-process-connected-1"

const MAX_EXECUTOR_STDOUT_BYTES = 1024 * 1024
const MAX_EXECUTOR_STDERR_BYTES = 64 * 1024
const EXECUTOR_KILL_GRACE_MS = 1_000

export function readRealImageExecutorShellHealth(input = {}) {
  const config = readRealImageExecutorShellConfig(input)
  const executionContract = buildRealImageExecutionContract({
    timeoutMs: config.timeoutMs,
    requiredResponseFields: input.requiredResponseFields,
  })

  if (!config.enabled) {
    return buildShellDisabledResponse({
      status: "real_image_executor_shell_disabled",
      config,
      executionContract,
      tags: ["executor_shell_disabled"],
    })
  }

  if (!config.command) {
    return buildShellDisabledResponse({
      status: "real_image_executor_shell_command_missing",
      config,
      executionContract,
      tags: ["executor_command_missing"],
    })
  }

  if (!config.argsValid) {
    return buildShellDisabledResponse({
      status: "real_image_executor_shell_args_invalid",
      config,
      executionContract,
      tags: ["executor_args_invalid"],
    })
  }

  return {
    ok: true,
    status: "real_image_executor_shell_ready",
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: true,
    commandConfigured: true,
    argsValid: true,
    timeoutMs: config.timeoutMs,
    executorConnected: true,
    canExecuteCommand: true,
    canRunInference: true,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    executionContract,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      "executor_shell_ready",
      "child_process_connected",
      "stdin_json_required",
      "stdout_json_required",
      "not_player_visible",
    ],
  }
}

export async function runRealImageExecutorShellDryRun(input = {}) {
  const health = readRealImageExecutorShellHealth(input)

  if (health.canExecuteCommand !== true) {
    return {
      ok: false,
      status: health.status,
      shell: EXECUTOR_SHELL_NAME,
      version: EXECUTOR_SHELL_VERSION,
      enabled: health.enabled,
      commandConfigured: health.commandConfigured,
      executorConnected: false,
      canExecuteCommand: false,
      canRunInference: false,
      canGenerateRealBitmap: false,
      willExecuteCommand: false,
      wouldExecuteCommand: false,
      willWriteOutputFile: false,
      willReturnStdoutJson: false,
      willReturnImageUrl: false,
      willReturnImageFormat: false,
      willReturnWidth: false,
      willReturnHeight: false,
      willReturnLicense: false,
      willReturnOriginalityConfirmed: false,
      executionContract: health.executionContract,
      canShowToPlayer: false,
      tags: ["real_image_executor_shell", "dry_run_blocked", "not_player_visible"],
    }
  }

  return {
    ok: true,
    status: "real_image_executor_shell_dry_run_ready",
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: health.enabled,
    commandConfigured: health.commandConfigured,
    executorConnected: true,
    canExecuteCommand: true,
    canRunInference: true,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    wouldExecuteCommand: true,
    willWriteOutputFile: false,
    willReturnStdoutJson: true,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    executionContract: health.executionContract,
    canShowToPlayer: false,
    tags: ["real_image_executor_shell", "dry_run_ready", "not_player_visible"],
  }
}

export async function executeRealImageWithExecutorShell(input = {}) {
  const config = readRealImageExecutorShellConfig(input)
  const health = readRealImageExecutorShellHealth(input)

  if (health.canExecuteCommand !== true) {
    return buildShellExecutionBlocked({
      status: health.status,
      health,
      tags: ["executor_shell_not_ready"],
    })
  }

  const executorStdinPayload = readRecord(input.executorStdinPayload)

  if (Object.keys(executorStdinPayload).length === 0) {
    return buildShellExecutionBlocked({
      status: "real_image_executor_shell_payload_missing",
      health,
      tags: ["executor_stdin_payload_missing"],
    })
  }

  const executionRequestValidation = validateRealImageExecutionRequest({
    readiness: executorStdinPayload.readiness,
    outputStorage: executorStdinPayload.outputStorage,
    modelTask: executorStdinPayload.modelTask,
    promptPackage: executorStdinPayload.promptPackage,
    responseContract: executorStdinPayload.responseContract,
  })

  if (!executionRequestValidation.ok) {
    return buildShellExecutionBlocked({
      status: "real_image_executor_shell_execution_request_invalid",
      health,
      executionRequestValidation,
      tags: ["execution_request_invalid"],
    })
  }

  const commandResult = await runCommandWithStdinJson({
    config,
    payload: executorStdinPayload,
    outputDirectory: input.outputStorage?.outputDirectory,
  })

  if (!commandResult.ok) {
    return buildShellExecutionFailure({
      status: commandResult.status,
      health,
      executionRequestValidation,
      commandResult,
      tags: commandResult.tags,
    })
  }

  const parsedStdout = parseExecutorStdoutJson(commandResult.stdoutText)

  if (!parsedStdout.ok) {
    return buildShellExecutionFailure({
      status: parsedStdout.status,
      health,
      executionRequestValidation,
      commandResult,
      didReturnStdoutJson: false,
      tags: parsedStdout.tags,
    })
  }

  const stdoutValidation = validateRealImageExecutionStdoutPayload(
    parsedStdout.payload
  )

  if (!stdoutValidation.ok) {
    return buildShellExecutionFailure({
      status: "real_image_executor_shell_stdout_contract_invalid",
      health,
      executionRequestValidation,
      commandResult,
      stdoutValidation,
      didReturnStdoutJson: true,
      tags: ["stdout_contract_invalid"],
    })
  }

  const outputReference = await buildVerifiedShellOutputReference({
    stdoutValidation,
    executorStdinPayload,
    outputStorage: input.outputStorage,
  })

  if (!outputReference.ok) {
    return buildShellExecutionFailure({
      status: outputReference.status,
      health,
      executionRequestValidation,
      commandResult,
      stdoutValidation,
      didReturnStdoutJson: true,
      tags: outputReference.tags,
    })
  }

  return {
    ok: true,
    status: "real_image_executor_shell_execution_succeeded",
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: health.enabled,
    commandConfigured: health.commandConfigured,
    executorConnected: true,
    canExecuteCommand: true,
    canRunInference: true,
    canGenerateRealBitmap: true,
    didExecuteCommand: true,
    didWriteOutputFile: true,
    didReturnStdoutJson: true,
    didAcceptStdoutJson: true,
    executionContract: health.executionContract,
    executionRequestValidation,
    stdoutValidation,
    imageUrl: outputReference.imageUrl,
    imageFileName: outputReference.imageFileName,
    imageFormat: stdoutValidation.imageFormat,
    width: stdoutValidation.width,
    height: stdoutValidation.height,
    license: stdoutValidation.license,
    originalityConfirmed: stdoutValidation.originalityConfirmed,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      "child_process_executed",
      "stdout_contract_valid",
      "output_storage_valid",
      "hidden_candidate_source_only",
      "visual_judge_required",
      "approved_frame_required",
      "not_player_visible",
    ],
  }
}

export function readRealImageExecutorShellConfig(input = {}) {
  const enabled = readBoolean(
    input.enabled ?? process.env[REAL_IMAGE_EXECUTOR_SHELL_ENV.enabled]
  )
  const command = readOptionalString(
    input.command ?? process.env[REAL_IMAGE_EXECUTOR_SHELL_ENV.command]
  )
  const argsResult = readArgsJson(
    input.argsJson ?? process.env[REAL_IMAGE_EXECUTOR_SHELL_ENV.argsJson]
  )
  const timeoutMs = readTimeoutMs(
    input.timeoutMs ?? process.env[REAL_IMAGE_EXECUTOR_SHELL_ENV.timeoutMs]
  )

  return {
    enabled,
    command,
    args: argsResult.args,
    argsValid: argsResult.ok,
    timeoutMs,
  }
}

function buildShellDisabledResponse(input) {
  return {
    ok: false,
    status: input.status,
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: input.config.enabled,
    commandConfigured: Boolean(input.config.command),
    argsValid: input.config.argsValid,
    timeoutMs: input.config.timeoutMs,
    executorConnected: false,
    canExecuteCommand: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    executionContract: input.executionContract,
    canShowToPlayer: false,
    tags: ["real_image_executor_shell", ...input.tags, "not_player_visible"],
  }
}

function buildShellExecutionBlocked(input) {
  return {
    ok: false,
    status: input.status,
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: input.health.enabled,
    commandConfigured: input.health.commandConfigured,
    executorConnected: input.health.executorConnected === true,
    canExecuteCommand: input.health.canExecuteCommand === true,
    canRunInference: false,
    canGenerateRealBitmap: false,
    didExecuteCommand: false,
    didWriteOutputFile: false,
    didReturnStdoutJson: false,
    executionContract: input.health.executionContract,
    executionRequestValidation: input.executionRequestValidation,
    canShowToPlayer: false,
    tags: ["real_image_executor_shell", ...input.tags, "not_player_visible"],
  }
}

function buildShellExecutionFailure(input) {
  return {
    ok: false,
    status: input.status,
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: input.health.enabled,
    commandConfigured: input.health.commandConfigured,
    executorConnected: input.health.executorConnected === true,
    canExecuteCommand: input.health.canExecuteCommand === true,
    canRunInference: true,
    canGenerateRealBitmap: false,
    didExecuteCommand: input.commandResult?.didExecuteCommand === true,
    didWriteOutputFile: false,
    didReturnStdoutJson: input.didReturnStdoutJson === true,
    didAcceptStdoutJson: false,
    executionContract: input.health.executionContract,
    executionRequestValidation: input.executionRequestValidation,
    stdoutValidation: input.stdoutValidation,
    exitCode: input.commandResult?.exitCode,
    signal: input.commandResult?.signal,
    timedOut: input.commandResult?.timedOut === true,
    stdoutTruncated: input.commandResult?.stdoutTruncated === true,
    stderrCaptured: input.commandResult?.stderrCaptured === true,
    stderrTruncated: input.commandResult?.stderrTruncated === true,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      ...input.tags,
      "does_not_return_image",
      "not_player_visible",
    ],
  }
}

async function runCommandWithStdinJson(input) {
  const stdoutCapture = createTextCapture(MAX_EXECUTOR_STDOUT_BYTES)
  const stderrCapture = createTextCapture(MAX_EXECUTOR_STDERR_BYTES)
  let childProcess
  let timeoutHandle
  let killHandle
  let timedOut = false
  let settled = false

  return new Promise((resolve) => {
    function finish(result) {
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
          AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR:
            input.outputDirectory ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
        },
      })
    } catch (error) {
      finish({
        ok: false,
        status: "real_image_executor_shell_spawn_failed",
        didExecuteCommand: false,
        errorName: error?.name,
        tags: ["spawn_failed"],
      })
      return
    }

    timeoutHandle = setTimeout(() => {
      timedOut = true
      childProcess.kill("SIGTERM")
      killHandle = setTimeout(() => {
        childProcess.kill("SIGKILL")
      }, EXECUTOR_KILL_GRACE_MS)
    }, input.config.timeoutMs)

    childProcess.stdout.on("data", (chunk) => appendTextCapture(stdoutCapture, chunk))
    childProcess.stderr.on("data", (chunk) => appendTextCapture(stderrCapture, chunk))

    childProcess.on("error", (error) => {
      finish({
        ok: false,
        status: "real_image_executor_shell_spawn_error",
        didExecuteCommand: false,
        errorName: error?.name,
        tags: ["spawn_error"],
      })
    })

    childProcess.on("close", (exitCode, signal) => {
      if (timedOut) {
        finish({
          ok: false,
          status: "real_image_executor_shell_timeout",
          didExecuteCommand: true,
          exitCode,
          signal,
          timedOut: true,
          stdoutTruncated: stdoutCapture.truncated,
          stderrCaptured: stderrCapture.text.length > 0,
          stderrTruncated: stderrCapture.truncated,
          tags: ["executor_timeout"],
        })
        return
      }

      if (exitCode !== 0) {
        finish({
          ok: false,
          status: "real_image_executor_shell_exit_non_zero",
          didExecuteCommand: true,
          exitCode,
          signal,
          timedOut: false,
          stdoutTruncated: stdoutCapture.truncated,
          stderrCaptured: stderrCapture.text.length > 0,
          stderrTruncated: stderrCapture.truncated,
          tags: ["executor_exit_non_zero"],
        })
        return
      }

      if (stdoutCapture.truncated) {
        finish({
          ok: false,
          status: "real_image_executor_shell_stdout_too_large",
          didExecuteCommand: true,
          exitCode,
          signal,
          stdoutTruncated: true,
          stderrCaptured: stderrCapture.text.length > 0,
          stderrTruncated: stderrCapture.truncated,
          tags: ["stdout_too_large"],
        })
        return
      }

      finish({
        ok: true,
        status: "real_image_executor_shell_process_completed",
        didExecuteCommand: true,
        exitCode,
        signal,
        timedOut: false,
        stdoutText: stdoutCapture.text,
        stdoutTruncated: false,
        stderrCaptured: stderrCapture.text.length > 0,
        stderrTruncated: stderrCapture.truncated,
        tags: ["process_completed"],
      })
    })

    childProcess.stdin.on("error", () => {})
    childProcess.stdin.end(JSON.stringify(input.payload))
  })
}

function parseExecutorStdoutJson(stdoutText) {
  const trimmed = typeof stdoutText === "string" ? stdoutText.trim() : ""

  if (!trimmed) {
    return {
      ok: false,
      status: "real_image_executor_shell_stdout_empty",
      tags: ["stdout_empty"],
    }
  }

  try {
    const payload = JSON.parse(trimmed)
    return isRecord(payload)
      ? { ok: true, payload }
      : {
          ok: false,
          status: "real_image_executor_shell_stdout_not_object",
          tags: ["stdout_json_not_object"],
        }
  } catch {
    return {
      ok: false,
      status: "real_image_executor_shell_stdout_json_invalid",
      tags: ["stdout_json_invalid"],
    }
  }
}

async function buildVerifiedShellOutputReference(input) {
  const reference = buildLocalImageOutputReference({
    fileName: input.stdoutValidation.imageFileName,
    imageFormat: input.stdoutValidation.imageFormat,
    outputDirectory: input.outputStorage?.outputDirectory,
    publicBaseUrl:
      input.outputStorage?.publicBaseUrl ??
      input.executorStdinPayload.outputStorage?.publicBaseUrl,
  })

  if (!reference.ok) {
    return {
      ok: false,
      status: "real_image_executor_shell_output_reference_invalid",
      tags: reference.tags ?? ["output_reference_invalid"],
    }
  }

  let fileStat

  try {
    fileStat = await fs.stat(reference.internalFilePath)
  } catch {
    return {
      ok: false,
      status: "real_image_executor_shell_output_file_missing",
      tags: ["output_file_missing"],
    }
  }

  if (!fileStat.isFile()) {
    return { ok: false, status: "real_image_executor_shell_output_not_file", tags: ["output_not_file"] }
  }

  if (fileStat.size <= 0) {
    return { ok: false, status: "real_image_executor_shell_output_file_empty", tags: ["output_file_empty"] }
  }

  if (fileStat.size > reference.maxFileBytes) {
    return { ok: false, status: "real_image_executor_shell_output_file_too_large", tags: ["output_file_too_large"] }
  }

  return {
    ok: true,
    imageFileName: reference.fileName,
    imageUrl: reference.imageUrl,
    canShowToPlayer: false,
    tags: ["output_file_verified", "public_http_url_ready", "not_player_visible"],
  }
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

function readBoolean(value) {
  if (typeof value === "boolean") return value
  if (typeof value !== "string") return false
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase())
}

function readOptionalString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function readArgsJson(value) {
  if (value === undefined || value === null || value === "") return { ok: true, args: [] }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return { ok: true, args: value }
  if (typeof value !== "string") return { ok: false, args: [] }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return { ok: true, args: parsed }
    }
  } catch {
    return { ok: false, args: [] }
  }

  return { ok: false, args: [] }
}

function readTimeoutMs(value) {
  const normalized = Number(value)

  if (
    Number.isFinite(normalized) &&
    normalized >= MIN_REAL_IMAGE_EXECUTION_TIMEOUT_MS &&
    normalized <= MAX_REAL_IMAGE_EXECUTION_TIMEOUT_MS
  ) {
    return normalized
  }

  return DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS
}

function readRecord(value) {
  return isRecord(value) ? JSON.parse(JSON.stringify(value)) : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
