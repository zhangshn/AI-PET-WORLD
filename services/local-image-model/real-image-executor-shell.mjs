// 当前文件作用：定义 AI-PET-WORLD 自研真实图像推理执行器 shell；默认不执行命令、不生成图片、不返回假图。

import {
  buildRealImageExecutionContract,
  DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  MAX_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
  MIN_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
} from "./real-image-execution-contract.mjs"

export const REAL_IMAGE_EXECUTOR_SHELL_ENV = {
  enabled: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED",
  command: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND",
  argsJson: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON",
  timeoutMs: "AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS",
}

const EXECUTOR_SHELL_NAME = "ai-pet-world-real-image-executor-shell"
const EXECUTOR_SHELL_VERSION = "executor-shell-disabled-1"

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
      message:
        "真实图像推理执行器 shell 尚未启用，因此不会执行命令，也不会生成图片。",
      messageEn:
        "The real image executor shell is not enabled, so it will not execute commands and will not generate images.",
      tags: ["executor_shell_disabled"],
    })
  }

  if (!config.command) {
    return buildShellDisabledResponse({
      status: "real_image_executor_shell_command_missing",
      config,
      executionContract,
      message: `真实图像推理执行器 shell 已启用，但缺少 ${REAL_IMAGE_EXECUTOR_SHELL_ENV.command}。`,
      messageEn: `The real image executor shell is enabled, but ${REAL_IMAGE_EXECUTOR_SHELL_ENV.command} is missing.`,
      tags: ["executor_command_missing"],
    })
  }

  if (!config.argsValid) {
    return buildShellDisabledResponse({
      status: "real_image_executor_shell_args_invalid",
      config,
      executionContract,
      message: `${REAL_IMAGE_EXECUTOR_SHELL_ENV.argsJson} 必须是 JSON 字符串数组。`,
      messageEn: `${REAL_IMAGE_EXECUTOR_SHELL_ENV.argsJson} must be a JSON string array.`,
      tags: ["executor_args_invalid"],
    })
  }

  return {
    ok: false,
    status: "real_image_executor_shell_ready_but_execution_not_connected",
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: true,
    commandConfigured: true,
    argsValid: true,
    timeoutMs: config.timeoutMs,
    executorConnected: false,
    canExecuteCommand: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    executionContract,
    message:
      "真实图像推理执行器 shell 配置已就绪，但实际命令执行尚未接入。当前仍不会执行命令或生成图片。",
    messageEn:
      "The real image executor shell configuration is ready, but actual command execution is not connected yet. It still will not execute commands or generate images.",
    nextStep: {
      zh: "下一步才接入真实命令执行：通过 stdin 发送 JSON 请求，读取 stdout JSON，并经过 execution contract 校验。",
      en: "Next connect real command execution: send JSON request through stdin, read stdout JSON, and validate it through the execution contract.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      "executor_shell_ready",
      "execution_not_connected",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageExecutorShellDryRun(input = {}) {
  const health = readRealImageExecutorShellHealth(input)

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
    willWriteOutputFile: false,
    willReturnStdoutJson: false,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    executionContract: health.executionContract,
    message:
      "真实图像推理执行器 shell dry-run 只暴露配置与契约，不会执行命令，也不会声明会返回真实图片。",
    messageEn:
      "The real image executor shell dry-run only exposes configuration and contracts. It will not execute commands or declare real image output.",
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      "dry_run_blocked",
      ...health.tags,
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function executeRealImageWithExecutorShell(input = {}) {
  const health = readRealImageExecutorShellHealth(input)

  return {
    ok: false,
    status: "real_image_executor_shell_execution_not_connected",
    shell: EXECUTOR_SHELL_NAME,
    version: EXECUTOR_SHELL_VERSION,
    enabled: health.enabled,
    commandConfigured: health.commandConfigured,
    executorConnected: false,
    canExecuteCommand: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    didExecuteCommand: false,
    didWriteOutputFile: false,
    didReturnStdoutJson: false,
    executionContract: health.executionContract,
    message:
      "真实图像推理执行器 shell 尚未接入命令执行逻辑。不会执行任何命令，也不会生成图片或返回假图。",
    messageEn:
      "The real image executor shell has not connected command execution logic. It will not execute any command, generate images, or return fake images.",
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      "execution_not_connected",
      ...health.tags,
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
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
    message: input.message,
    messageEn: input.messageEn,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_shell",
      ...input.tags,
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
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

function readOptionalString(value) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function readArgsJson(value) {
  if (value === undefined || value === null || value === "") {
    return {
      ok: true,
      args: [],
    }
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return {
      ok: true,
      args: value,
    }
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      args: [],
    }
  }

  try {
    const parsed = JSON.parse(value)

    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return {
        ok: true,
        args: parsed,
      }
    }
  } catch {
    return {
      ok: false,
      args: [],
    }
  }

  return {
    ok: false,
    args: [],
  }
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