// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner 边界；真实推理未接入前不生成图片、不返回假图。

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
const RUNNER_VERSION = "runner-not-connected-2"

export function readRealImageRunnerHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = readRealImageRunnerImplementationHealth({
    readiness,
    outputStorage,
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_generation_runner_not_connected",
    runner: RUNNER_NAME,
    version: RUNNER_VERSION,
    runnerConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    acceptsReadinessGate: true,
    acceptsPromptPackage: true,
    acceptsControlSketch: true,
    acceptsVisualFixHints: true,
    acceptsWorldFactLockedRequest: true,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildRunnerInputContract(requiredResponseFields),
    outputContract: buildRunnerOutputContract(requiredResponseFields),
    readiness,
    outputStorage,
    implementation,
    message:
      "真实图像生成 runner 已连接 implementation 文件入口，但尚未接入自研推理实现。当前不能生成图片，也不会返回假图。",
    messageEn:
      "The real image generation runner is connected to the implementation entry, but no in-house inference implementation is connected yet. It cannot generate images and will not return fake images.",
    nextStep: {
      zh: "下一步在 runner implementation 中接入真实自研推理流程；接入后必须写入 output-storage，并返回 public imageUrl 与 6 个正式字段。",
      en: "Next connect the real in-house inference flow inside the runner implementation. After connection, it must write into output-storage and return a public imageUrl plus the six formal fields.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      ...readiness.tags,
      ...implementation.tags,
      "output_storage_ready",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageRunnerDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = await runRealImageRunnerImplementationDryRun({
    requestAudit: input.requestAudit,
    readiness,
    outputStorage,
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_generation_runner_not_connected",
    runner: RUNNER_NAME,
    version: RUNNER_VERSION,
    runnerConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildRunnerInputContract(requiredResponseFields),
    outputContract: buildRunnerOutputContract(requiredResponseFields),
    readiness,
    outputStorage,
    implementation,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willWriteOutputFile: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实图像生成 runner 已连接 implementation 文件入口，但 implementation 尚未接入推理实现，因此 dry-run 不能声明会返回真实图片字段。",
    messageEn:
      "The real image generation runner is connected to the implementation entry, but the implementation has not connected inference yet, so dry-run cannot declare real image fields.",
    nextStep: {
      zh: "接入真实推理实现后，dry-run 才能返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting real inference, dry-run may return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      "dry_run_blocked",
      ...readiness.tags,
      ...implementation.tags,
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateRealImageWithRunner(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)
  const implementation = await generateRealImageWithRunnerImplementation({
    requestAudit: input.requestAudit,
    readiness,
    outputStorage,
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_generation_runner_not_connected",
    runner: RUNNER_NAME,
    version: RUNNER_VERSION,
    runnerConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildRunnerInputContract(requiredResponseFields),
    outputContract: buildRunnerOutputContract(requiredResponseFields),
    readiness,
    outputStorage,
    implementation,
    message:
      "真实图像生成 runner 已连接 implementation 文件入口，但 implementation 尚未接入推理实现。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real image generation runner is connected to the implementation entry, but the implementation has not connected inference yet. It will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步在 runner implementation 中接入真实自研推理实现，使它写入 PNG/WebP/JPG 文件，并返回正式 6 字段。",
      en: "Next connect the real in-house inference implementation inside the runner implementation so it writes PNG/WebP/JPG files and returns the six formal fields.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      "generate_blocked",
      ...readiness.tags,
      ...implementation.tags,
      "does_not_generate",
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
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustNotRewriteWorldFacts: true,
    mustNotDisplayDirectly: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
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
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}