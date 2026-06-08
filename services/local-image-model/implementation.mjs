// 当前文件作用：定义 AI-PET-WORLD 自研 local image model implementation 接入口；通过 adapter 接入真实图像生成能力，未接入前不生成图片、不返回假图。

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

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

export function readLocalImageModelImplementationHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const adapterHealth = readRealImageGenerationAdapterHealth({
    requiredResponseFields,
  })

  if (!adapterHealth.ok || adapterHealth.adapterConnected !== true) {
    return attachAdapterResult(
      buildImplementationNotConnectedHealth({
        requiredResponseFields,
      }),
      adapterHealth
    )
  }

  return {
    ok: true,
    status: "local_image_model_implementation_connected",
    model: LOCAL_IMAGE_MODEL_IMPLEMENTATION_NAME,
    version: "implementation-connected",
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
    message: "local image model implementation 已连接真实自研图像生成能力。",
    messageEn:
      "The local image model implementation has connected a real in-house image generation capability.",
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

  const generateResponse = buildSuccessfulGenerateResponse({
    payload: adapterGenerateResult.payload ?? adapterGenerateResult,
    requestAudit: input.requestAudit,
    requiredResponseFields,
  })

  return attachAdapterResult(generateResponse, adapterGenerateResult)
}

function attachAdapterResult(result, adapterResult) {
  return {
    ...result,
    adapter: adapterResult,
    tags: mergeTags(result.tags, adapterResult?.tags),
  }
}

function mergeTags(...tagGroups) {
  return [
    ...new Set(
      tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : []))
    ),
  ]
}