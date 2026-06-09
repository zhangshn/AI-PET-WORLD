// 当前文件作用：定义 AI-PET-WORLD 自研 local image model implementation 接入口；读取运行配置并接入真实本地图像生成链路。

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

const IMPLEMENTATION_VERSION = "implementation-runtime-config-1"

export function readLocalImageModelImplementationHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const adapterHealth = readRealImageGenerationAdapterHealth({
    ...readLocalImageModelRuntimeConfig(input),
    requestBody: input.requestBody,
    requiredResponseFields,
  })

  if (!adapterHealth.ok || adapterHealth.adapterConnected !== true) {
    return attachAdapterResult(
      buildImplementationNotConnectedHealth({ requiredResponseFields }),
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
    adapter: adapterHealth,
    canShowToPlayer: false,
    tags: [
      "local_image_model_implementation",
      "implementation_connected",
      "adapter_connected",
      "not_player_visible",
    ],
  }
}

export async function runLocalImageModelImplementationDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const adapterDryRun = await runRealImageGenerationAdapterDryRun({
    ...readLocalImageModelRuntimeConfig(input),
    requestBody: input.requestBody,
    requestAudit: input.requestAudit,
    requiredResponseFields,
  })

  if (!adapterDryRun.ok || adapterDryRun.adapterConnected !== true) {
    return attachAdapterResult(
      buildImplementationNotConnectedDryRun({
        requestAudit: input.requestAudit,
        requiredResponseFields,
      }),
      adapterDryRun
    )
  }

  return attachAdapterResult(
    buildSuccessfulDryRunResponse({
      requestAudit: input.requestAudit,
      requiredResponseFields,
    }),
    adapterDryRun
  )
}

export async function generateLocalImageCandidate(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const adapterGenerateResult = await generateRealImageWithAdapter({
    ...readLocalImageModelRuntimeConfig(input),
    requestBody: input.requestBody,
    requestAudit: input.requestAudit,
    requiredResponseFields,
  })

  if (!adapterGenerateResult.ok || adapterGenerateResult.adapterConnected !== true) {
    return attachAdapterResult(
      buildImplementationNotConnectedGenerate({
        requestAudit: input.requestAudit,
        requiredResponseFields,
      }),
      adapterGenerateResult
    )
  }

  return attachAdapterResult(
    buildSuccessfulGenerateResponse({
      payload: adapterGenerateResult,
      requestAudit: input.requestAudit,
      requiredResponseFields,
    }),
    adapterGenerateResult
  )
}

export function readLocalImageModelRuntimeConfig(input = {}) {
  const realModelReadinessInput = input.realModelReadiness ?? {}
  const outputStorageInput = input.outputStorage ?? {}

  return {
    enabled: input.enabled ?? process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ENABLED,
    command: input.command ?? process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_COMMAND,
    argsJson:
      input.argsJson ?? process.env.AI_PET_WORLD_REAL_IMAGE_EXECUTOR_ARGS_JSON,
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
      outputDirectory:
        outputStorageInput.outputDirectory ??
        process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR,
      publicBaseUrl:
        outputStorageInput.publicBaseUrl ??
        process.env.AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_PUBLIC_BASE_URL,
    },
  }
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
