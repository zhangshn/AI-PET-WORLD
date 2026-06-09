// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner implementation 入口；真实推理未接入前不生成图片、不返回假图。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import { buildRealImageExecutionContract } from "./real-image-execution-contract.mjs"

const RUNNER_IMPLEMENTATION_NAME =
  "ai-pet-world-real-image-runner-implementation"
const RUNNER_IMPLEMENTATION_VERSION = "implementation-not-connected-2"

export function readRealImageRunnerImplementationHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    message:
      "真实 runner implementation 文件入口已建立，并已定义 execution contract，但尚未接入自研图像推理执行器。当前不能生成图片，也不会返回假图。",
    messageEn:
      "The real runner implementation entry is created and the execution contract is defined, but no in-house image inference executor is connected yet. It cannot generate images and will not return fake images.",
    nextStep: {
      zh: "下一步接入真实自研推理执行器：读取 PromptPackage，生成 PNG/WebP/JPG，写入 output-storage，并返回正式 6 字段。",
      en: "Next connect the real in-house inference executor: read PromptPackage, generate PNG/WebP/JPG, write into output-storage, and return the six formal fields.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_not_connected",
      "runner_implementation_not_connected",
      "execution_contract_ready",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageRunnerImplementationDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willWriteOutputFile: false,
    willExecuteCommand: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实 runner implementation 尚未接入自研推理执行器，因此 dry-run 不能声明会执行命令或返回真实图片字段。",
    messageEn:
      "The real runner implementation has not connected the in-house inference executor yet, so dry-run cannot declare command execution or real image fields.",
    nextStep: {
      zh: "接入真实推理执行器后，dry-run 才能返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting the real inference executor, dry-run may return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_not_connected",
      "runner_implementation_not_connected",
      "execution_contract_ready",
      "dry_run_blocked",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateRealImageWithRunnerImplementation(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    message:
      "真实 runner implementation 尚未接入自研推理执行器。不会执行命令，也不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real runner implementation has not connected the in-house inference executor yet. It will not execute commands and will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实推理执行器：执行成功后必须写入 output-storage，并返回 public imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect the real inference executor: after successful execution it must write into output-storage and return public imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_not_connected",
      "runner_implementation_not_connected",
      "execution_contract_ready",
      "generate_blocked",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildImplementationInputContract(requiredResponseFields) {
  return {
    mustReceiveReadinessGate: true,
    mustReceiveOutputStorage: true,
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustUseExecutionContract: true,
    mustNotRewriteWorldFacts: true,
    mustNotDisplayDirectly: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    requiredResponseFields,
  }
}

function buildImplementationOutputContract(requiredResponseFields) {
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