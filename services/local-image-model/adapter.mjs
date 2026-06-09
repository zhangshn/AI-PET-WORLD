// 当前文件作用：定义 AI-PET-WORLD 自研真实出图 adapter 边界；转发 runner 通过契约校验后的 6 字段结果。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import {
  generateRealImageWithRunner,
  readRealImageRunnerHealth,
  runRealImageRunnerDryRun,
} from "./real-image-runner.mjs"

const ADAPTER_NAME = "ai-pet-world-real-image-generation-adapter"
const ADAPTER_VERSION = "adapter-result-forwarding-1"

export function readRealImageGenerationAdapterHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = readRealImageRunnerHealth({
    ...pickRunnerInput(input),
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requestBody: input.requestBody,
    requiredResponseFields,
  })

  return {
    ok: runner.ok === true,
    status:
      runner.ok === true
        ? "real_image_generation_adapter_ready"
        : "real_image_generation_adapter_blocked",
    adapter: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    adapterConnected: runner.ok === true,
    canGenerateRealBitmap: false,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildAdapterInputContract(requiredResponseFields),
    outputContract: buildAdapterOutputContract(requiredResponseFields),
    readiness: runner.readiness,
    runner,
    canShowToPlayer: false,
    tags: ["real_image_generation_adapter", "not_player_visible"],
  }
}

export async function runRealImageGenerationAdapterDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = await runRealImageRunnerDryRun({
    ...pickRunnerInput(input),
    requestAudit: input.requestAudit,
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requestBody: input.requestBody,
    requiredResponseFields,
  })

  if (runner.ok === true) {
    return {
      ...runner,
      status: "real_image_generation_adapter_dry_run_passed",
      adapter: ADAPTER_NAME,
      version: ADAPTER_VERSION,
      adapterConnected: true,
      runner,
      readiness: runner.readiness,
      canShowToPlayer: false,
    }
  }

  return buildBlockedAdapterResponse({
    status: "real_image_generation_adapter_blocked",
    input,
    runner,
    requiredResponseFields,
    dryRun: true,
  })
}

export async function generateRealImageWithAdapter(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const runner = await generateRealImageWithRunner({
    ...pickRunnerInput(input),
    requestAudit: input.requestAudit,
    realModelReadiness: input.realModelReadiness,
    outputStorage: input.outputStorage,
    requestBody: input.requestBody,
    requiredResponseFields,
  })

  if (runner.ok === true) {
    return {
      ok: true,
      status: "real_image_generation_adapter_generate_passed",
      adapter: ADAPTER_NAME,
      version: ADAPTER_VERSION,
      adapterConnected: true,
      canGenerateRealBitmap: true,
      ...(input.requestAudit ?? {}),
      imageUrl: runner.imageUrl,
      imageFormat: runner.imageFormat,
      width: runner.width,
      height: runner.height,
      license: runner.license,
      originalityConfirmed: runner.originalityConfirmed,
      requiredResponseShape: requiredResponseFields,
      inputContract: buildAdapterInputContract(requiredResponseFields),
      outputContract: buildAdapterOutputContract(requiredResponseFields),
      readiness: runner.readiness,
      runner,
      canShowToPlayer: false,
      tags: ["real_image_generation_adapter", "hidden_candidate_only"],
    }
  }

  return buildBlockedAdapterResponse({
    status: "real_image_generation_adapter_blocked",
    input,
    runner,
    requiredResponseFields,
    dryRun: false,
  })
}

function buildBlockedAdapterResponse(input) {
  return {
    ok: false,
    status: input.status,
    adapter: ADAPTER_NAME,
    version: ADAPTER_VERSION,
    adapterConnected: false,
    canGenerateRealBitmap: false,
    ...(input.input.requestAudit ?? {}),
    requiredResponseShape: input.requiredResponseFields,
    inputContract: buildAdapterInputContract(input.requiredResponseFields),
    outputContract: buildAdapterOutputContract(input.requiredResponseFields),
    readiness: input.runner.readiness,
    runner: input.runner,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willPersistOnlyAsHiddenCandidate: false,
    canShowToPlayer: false,
    tags: [
      "real_image_generation_adapter",
      input.dryRun ? "dry_run_blocked" : "generate_blocked",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildAdapterInputContract(requiredResponseFields) {
  return {
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustUseRunnerBoundary: true,
    requiredResponseFields,
  }
}

function buildAdapterOutputContract(requiredResponseFields) {
  return {
    requiredFields: requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    mustReturnBitmap: true,
    mustReturnHttpHttpsOrDataImageUrl: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function pickRunnerInput(input = {}) {
  return {
    enabled: input.enabled,
    command: input.command,
    argsJson: input.argsJson,
    timeoutMs: input.timeoutMs,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}
