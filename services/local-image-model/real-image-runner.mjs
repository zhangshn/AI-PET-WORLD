// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner 边界；真实推理未接入前不生成图片、不返回假图。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import { readLocalImageOutputStorageStatus } from "./output-storage.mjs"
import { readRealImageModelReadiness } from "./real-model-readiness.mjs"

const RUNNER_NAME = "ai-pet-world-real-image-generation-runner"
const RUNNER_VERSION = "runner-not-connected-1"

export function readRealImageRunnerHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const readiness = readRealImageModelReadiness(input.realModelReadiness)
  const outputStorage = readLocalImageOutputStorageStatus(input.outputStorage)

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
    message:
      "真实图像生成 runner 边界已定义，但尚未接入自研推理实现。当前不能生成图片，也不会返回假图。",
    messageEn:
      "The real image generation runner boundary is defined, but no in-house inference implementation is connected yet. It cannot generate images and will not return fake images.",
    nextStep: {
      zh: "下一步接入真实自研推理实现；接入后必须把图片写入 output-storage，并返回 public imageUrl 与 6 个正式字段。",
      en: "Next connect the real in-house inference implementation. After connection, it must write images into output-storage and return a public imageUrl plus the six formal fields.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      ...readiness.tags,
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
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willWriteOutputFile: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实图像生成 runner 尚未接入推理实现，因此 dry-run 不能声明会返回真实图片字段。",
    messageEn:
      "The real image generation runner has not connected an inference implementation, so dry-run cannot declare real image fields yet.",
    nextStep: {
      zh: "接入真实推理实现后，dry-run 才能返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting the real inference implementation, dry-run may return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      "dry_run_blocked",
      ...readiness.tags,
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
    message:
      "真实图像生成 runner 尚未接入推理实现。不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real image generation runner has not connected an inference implementation. It will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实自研推理实现，使 runner 写入 PNG/WebP/JPG 文件，并返回正式 6 字段。",
      en: "Next connect the real in-house inference implementation so the runner writes PNG/WebP/JPG files and returns the six formal fields.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_generation_runner",
      "runner_not_connected",
      "generate_blocked",
      ...readiness.tags,
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