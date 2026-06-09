// 当前文件作用：定义 AI-PET-WORLD 自研 local image model implementation 接入口；读取运行配置并接入真实本地图像生成链路。

import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildImplementationNotConnectedDryRun,
  buildImplementationNotConnectedGenerate,
  buildImplementationNotConnectedHealth,
  buildSuccessfulDryRunResponse,
  buildSuccessfulGenerateResponse,
  LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import {
  generateRealImageWithAdapter,
  readRealImageGenerationAdapterHealth,
  runRealImageGenerationAdapterDryRun,
} from "./adapter.mjs"
import { readRealImageModelWorkerHealth } from "./real-image-model-worker.mjs"

const IMPLEMENTATION_VERSION = "implementation-worker-default-1"
const CURRENT_FILE_PATH = fileURLToPath(import.meta.url)
const CURRENT_DIRECTORY = path.dirname(CURRENT_FILE_PATH)
const DEFAULT_WORKER_ENTRY_PATH = path.join(
  CURRENT_DIRECTORY,
  "real-image-model-worker.mjs"
)

export function readLocalImageModelImplementationHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runtimeConfig = readLocalImageModelRuntimeConfig(input)
  const adapterHealth = readRealImageGenerationAdapterHealth({
    ...runtimeConfig,
    requestBody: input.requestBody,
    requiredResponseFields,
  })

  if (!adapterHealth.ok || adapterHealth.adapterConnected !== true) {
    return attachAdapterResult(
      {
        ...buildImplementationNotConnectedHealth({ requiredResponseFields }),
        worker: runtimeConfig.workerHealth,
      },
      adapterHealth
    )
  }

  return {
    ok: true,
    status: "local_image_model_implementation_connected",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: IMPLEMENTATION_VERSION,
    implementationConnected: true,
    supportsWorldVisualPainter: true,
    supportsResponseContract: true,
    supportsHiddenCandidateOutput: true,
    supportsPng: true,
    supportsWebp: true,
    supportsJpg: true,
    requiredResponseShape: requiredResponseFields,
    outputContract: adapterHealth.outputContract ?? null,
    worker: runtimeConfig.workerHealth,
    adapter: adapterHealth,
    canShowToPlayer: false,
    tags: [
      "local_image_model_implementation",
      "implementation_connected",
      "worker_default_executor",
      "adapter_connected",
      "not_player_visible",
    ],
  }
}

export async function runLocalImageModelImplementationDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runtimeConfig = readLocalImageModelRuntimeConfig(input)
  const adapterDryRun = await runRealImageGenerationAdapterDryRun({
    ...runtimeConfig,
    requestBody: input.requestBody,
    requestAudit: input.requestAudit,
    requiredResponseFields,
  })

  if (!adapterDryRun.ok || adapterDryRun.adapterConnected !== true) {
    return attachAdapterResult(
      {
        ...buildImplementationNotConnectedDryRun({
          requestAudit: input.requestAudit,
          requiredResponseFields,
        }),
        worker: runtimeConfig.workerHealth,
      },
      adapterDryRun
    )
  }

  return attachAdapterResult(
    {
      ...buildSuccessfulDryRunResponse({
        requestAudit: input.requestAudit,
        requiredResponseFields,
      }),
      worker: runtimeConfig.workerHealth,
    },
    adapterDryRun
  )
}

export async function generateLocalImageCandidate(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runtimeConfig = readLocalImageModelRuntimeConfig(input)
  const adapterGenerateResult = await generateRealImageWithAdapter({
    ...runtimeConfig,
    requestBody: input.requestBody,
    requestAudit: input.requestAudit,
    requiredResponseFields,
  })

  if (!adapterGenerateResult.ok || adapterGenerateResult.adapterConnected !== true) {
    return attachAdapterResult(
      {
        ...buildImplementationNotConnectedGenerate({
          requestAudit: input.requestAudit,
          requiredResponseFields,
        }),
        worker: runtimeConfig.workerHealth,
      },
      adapterGenerateResult
    )
  }

  return attachAdapterResult(
    {
      ...buildSuccessfulGenerateResponse({
        payload: adapterGenerateResult,
        requestAudit: input.requestAudit,
        requiredResponseFields,
      }),
      worker: runtimeConfig.workerHealth,
    },
    adapterGenerateResult
  )
}

export function readLocalImageModelRuntimeConfig(input = {}) {
  const realModelReadinessInput = input.realModelReadiness ?? {}
  const outputStorageInput = input.outputStorage ?? {}
  const workerInput = input.worker ?? {}
  const command = readExecutorCommand(input)
  const argsJson = readExecutorArgsJson(input)
  const outputDirectory =
    outputStorageInput.outputDirectory ?? process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR
  const publicBaseUrl =
    outputStorageInput.publicBaseUrl ??
    process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL
  const workerHealth = readRealImageModelWorkerHealth({
    command: workerInput.command ?? process.env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND,
    argsJson:
      workerInput.argsJson ?? process.env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON,
    timeoutMs:
      workerInput.timeoutMs ??
      process.env.AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS,
    outputDirectory,
  })

  return {
    enabled: input.enabled ?? process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED,
    command,
    argsJson,
    timeoutMs:
      input.timeoutMs ?? process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_TIMEOUT_MS,
    realModelReadiness: {
      enabled:
        realModelReadinessInput.enabled ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ENABLED,
      assetDirectory:
        realModelReadinessInput.assetDirectory ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ASSET_DIR,
      manifestPath:
        realModelReadinessInput.manifestPath ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_MANIFEST_PATH,
      license:
        realModelReadinessInput.license ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_LICENSE,
      originalityConfirmed:
        realModelReadinessInput.originalityConfirmed ??
        process.env.AI_PET_WORLD_REAL_IMAGE_MODEL_ORIGINALITY_CONFIRMED,
    },
    outputStorage: {
      outputDirectory,
      publicBaseUrl,
    },
    workerHealth,
  }
}

function readExecutorCommand(input = {}) {
  if (typeof input.command === "string" && input.command.trim()) {
    return input.command.trim()
  }

  if (process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND) {
    return process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND
  }

  return process.execPath
}

function readExecutorArgsJson(input = {}) {
  if (typeof input.argsJson === "string" && input.argsJson.trim()) {
    return input.argsJson.trim()
  }

  if (process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON) {
    return process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON
  }

  return JSON.stringify([DEFAULT_WORKER_ENTRY_PATH])
}

function attachAdapterResult(result, adapterResult) {
  return {
    ...result,
    adapter: adapterResult,
    tags: mergeTags(result.tags, adapterResult?.tags),
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

function mergeTags(...tagGroups) {
  return [
    ...new Set(
      tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : []))
    ),
  ]
}
