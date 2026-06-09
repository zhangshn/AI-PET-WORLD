// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner 边界；转发 implementation 的正式 6 字段结果。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import { readLocalImageOutputStorageStatus } from "./output-storage.mjs"
import {
  generateRealImageWithRunnerImplementation,
  readRealImageRunnerImplementationHealth,
  runRealImageRunnerImplementationDryRun,
} from "./real-image-runner-implementation.mjs"
import { readRealImageModelReadiness } from "./real-model-readiness.mjs"

const RUNNER_NAME = "ai-pet-world-real-image-generation-runner"
const RUNNER_VERSION = "runner-result-forwarding-2"

export function readRealImageRunnerHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = readRealImageRunnerImplementationHealth({
    ...pickExecutorInput(input),
    readiness,
    outputStorage,
    requiredResponseFields,
    requestBody: input.requestBody,
  })

  return {
    ok: implementation.ok === true,
    status:
      implementation.ok === true
        ? "real_image_generation_runner_ready"
        : "real_image_generation_runner_blocked",
    runner: RUNNER_NAME,
    version: RUNNER_VERSION,
    runnerConnected: implementation.ok === true,
    canRunInference: implementation.ok === true,
    canGenerateRealBitmap: false,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildRunnerInputContract(requiredResponseFields),
    outputContract: buildRunnerOutputContract(requiredResponseFields),
    readiness,
    outputStorage,
    implementation,
    canShowToPlayer: false,
    tags: ["real_image_generation_runner", "not_player_visible"],
  }
}

export async function runRealImageRunnerDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = await runRealImageRunnerImplementationDryRun({
    ...pickExecutorInput(input),
    requestAudit: input.requestAudit,
    readiness,
    outputStorage,
    requiredResponseFields,
    requestBody: input.requestBody,
  })

  if (implementation.ok === true) {
    return {
      ...implementation,
      status: "real_image_generation_runner_dry_run_passed",
      runner: RUNNER_NAME,
      version: RUNNER_VERSION,
      runnerConnected: true,
      readiness,
      outputStorage,
      implementation,
      canShowToPlayer: false,
    }
  }

  return buildBlockedRunnerResponse({
    status: "real_image_generation_runner_blocked",
    input,
    readiness,
    outputStorage,
    implementation,
    requiredResponseFields,
    dryRun: true,
  })
}

export async function generateRealImageWithRunner(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = await generateRealImageWithRunnerImplementation({
    ...pickExecutorInput(input),
    requestAudit: input.requestAudit,
    readiness,
    outputStorage,
    requiredResponseFields,
    requestBody: input.requestBody,
  })

  if (implementation.ok === true) {
    return {
      ok: true,
      status: "real_image_generation_runner_generate_passed",
      runner: RUNNER_NAME,
      version: RUNNER_VERSION,
      runnerConnected: true,
      canRunInference: true,
      canGenerateRealBitmap: true,
      ...(input.requestAudit ?? {}),
      imageUrl: implementation.imageUrl,
      imageFormat: implementation.imageFormat,
      width: implementation.width,
      height: implementation.height,
      license: implementation.license,
      originalityConfirmed: implementation.originalityConfirmed,
      requiredResponseShape: requiredResponseFields,
      inputContract: buildRunnerInputContract(requiredResponseFields),
      outputContract: buildRunnerOutputContract(requiredResponseFields),
      readiness,
      outputStorage,
      implementation,
      canShowToPlayer: false,
      tags: ["real_image_generation_runner", "hidden_candidate_only"],
    }
  }

  return buildBlockedRunnerResponse({
    status: "real_image_generation_runner_blocked",
    input,
    readiness,
    outputStorage,
    implementation,
    requiredResponseFields,
    dryRun: false,
  })
}

function buildBlockedRunnerResponse(input) {
  return {
    ok: false,
    status: input.status,
    runner: RUNNER_NAME,
    version: RUNNER_VERSION,
    runnerConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    ...(input.input.requestAudit ?? {}),
    requiredResponseShape: input.requiredResponseFields,
    inputContract: buildRunnerInputContract(input.requiredResponseFields),
    outputContract: buildRunnerOutputContract(input.requiredResponseFields),
    readiness: input.readiness,
    outputStorage: input.outputStorage,
    implementation: input.implementation,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willWriteOutputFile: false,
    willPersistOnlyAsHiddenCandidate: false,
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      input.dryRun ? "dry_run_blocked" : "generate_blocked",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildRunnerInputContract(requiredResponseFields) {
  return {
    mustReceiveReadinessGate: true,
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustUseOutputStorage: true,
    mustUseRunnerImplementation: true,
    requiredResponseFields,
  }
}

function buildRunnerOutputContract(requiredResponseFields) {
  return {
    requiredFields: requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    mustReturnBitmap: true,
    mustWriteFileUnderOutputStorage: true,
    mustReturnPublicHttpUrl: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function pickExecutorInput(input = {}) {
  return {
    enabled: input.enabled,
    command: input.command,
    argsJson: input.argsJson,
    timeoutMs: input.timeoutMs,
    workerEnv: input.workerEnv,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}
