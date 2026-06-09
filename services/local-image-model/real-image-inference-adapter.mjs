// 当前文件作用：定义真实推理命令 contract adapter；把内部 worker payload 转为外部真实模型命令的安全输入，并校验标准输出契约。

import { validateRealImageExecutionStdoutPayload } from "./real-image-execution-contract.mjs"
import { validateLocalImageOutputFileName } from "./output-storage.mjs"

export const REAL_IMAGE_INFERENCE_ADAPTER_NAME =
  "ai-pet-world-real-image-inference-adapter"
export const REAL_IMAGE_INFERENCE_ADAPTER_VERSION =
  "inference-command-contract-1"
export const REAL_IMAGE_INFERENCE_REQUEST_SCHEMA_VERSION =
  "ai-pet-world-real-image-inference-request-1"

export function readRealImageInferenceAdapterHealth() {
  return {
    ok: true,
    status: "real_image_inference_adapter_ready",
    adapter: REAL_IMAGE_INFERENCE_ADAPTER_NAME,
    version: REAL_IMAGE_INFERENCE_ADAPTER_VERSION,
    requestSchemaVersion: REAL_IMAGE_INFERENCE_REQUEST_SCHEMA_VERSION,
    canBuildInferenceRequest: true,
    canValidateInferenceStdout: true,
    canGenerateRealBitmap: false,
    willExecuteCommand: false,
    willWriteOutputFile: false,
    canShowToPlayer: false,
    tags: [
      "real_image_inference_adapter",
      "contract_adapter_ready",
      "does_not_generate_image",
      "not_player_visible",
    ],
  }
}

export function buildRealImageInferenceCommandRequest(input = {}) {
  const workerPayload = readRecord(input.workerPayload)
  const outputFileName = readString(workerPayload.outputFileName)
  const outputFileNameValidation = validateLocalImageOutputFileName({
    fileName: outputFileName,
  })

  if (!outputFileNameValidation.ok) {
    return buildRequestFailure({
      status: "real_image_inference_request_output_file_name_invalid",
      detail: outputFileNameValidation,
    })
  }

  const modelTask = readRecord(workerPayload.modelTask)
  const promptPackage = readRecord(workerPayload.promptPackage)
  const responseContract = readRecord(workerPayload.responseContract)
  const readiness = readRecord(workerPayload.readiness)
  const outputStorage = readRecord(workerPayload.outputStorage)
  const worldFactMetadata = readRecord(workerPayload.worldFactMetadata)
  const audit = readRecord(workerPayload.audit)
  const requestBody = readRecord(workerPayload.requestBody)

  if (modelTask.taskKind !== "generate_hidden_world_bitmap_candidate") {
    return buildRequestFailure({
      status: "real_image_inference_request_model_task_invalid",
    })
  }

  if (modelTask.canShowToPlayer !== false) {
    return buildRequestFailure({
      status: "real_image_inference_request_model_task_visibility_invalid",
    })
  }

  if (!promptPackage.packageId) {
    return buildRequestFailure({
      status: "real_image_inference_request_prompt_package_missing",
    })
  }

  if (responseContract.canShowToPlayer !== false) {
    return buildRequestFailure({
      status: "real_image_inference_request_response_contract_visibility_invalid",
    })
  }

  const imageFormat = readImageFormat(
    workerPayload.imageFormat ?? requestBody.imageFormat
  )
  const width = readPositiveInteger(workerPayload.width ?? requestBody.width)
  const height = readPositiveInteger(workerPayload.height ?? requestBody.height)

  return {
    ok: true,
    status: "real_image_inference_request_ready",
    adapter: REAL_IMAGE_INFERENCE_ADAPTER_NAME,
    version: REAL_IMAGE_INFERENCE_ADAPTER_VERSION,
    request: {
      schemaVersion: REAL_IMAGE_INFERENCE_REQUEST_SCHEMA_VERSION,
      taskKind: modelTask.taskKind,
      outputPurpose: "hidden_ai_image_candidate",
      outputFileName: outputFileNameValidation.fileName,
      imageFormat,
      width,
      height,
      promptPackage,
      modelTask,
      responseContract,
      controlSketch: readRecord(workerPayload.controlSketch),
      visualFixHints: Array.isArray(workerPayload.visualFixHints)
        ? workerPayload.visualFixHints
        : [],
      worldFactMetadata,
      readiness: buildReadinessSummary(readiness),
      outputStorage: buildOutputStorageSummary(outputStorage),
      audit: {
        ...audit,
        adapter: REAL_IMAGE_INFERENCE_ADAPTER_NAME,
        adapterVersion: REAL_IMAGE_INFERENCE_ADAPTER_VERSION,
      },
      constraints: {
        ...readRecord(workerPayload.constraints),
        mustWriteOutputFile: true,
        mustWriteUnderOutputDirectoryEnv: true,
        mustReturnStdoutJson: true,
        mustReturnRealBitmapFile: true,
        mustNotReturnPlaceholder: true,
        mustNotReturnSvg: true,
        mustNotReturnHtml: true,
        mustNotReturnJsonDebugImage: true,
        mustNotReturnProgrammaticRenderer: true,
        mustNotCopyUnlicensedThirdPartyWorks: true,
        canShowToPlayer: false,
      },
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
    tags: [
      "real_image_inference_adapter",
      "inference_request_ready",
      "hidden_candidate_only",
      "not_player_visible",
    ],
  }
}

export function validateRealImageInferenceStdout(input = {}) {
  const expectedOutputFileName = readString(input.expectedOutputFileName)
  const stdoutValidation = validateRealImageExecutionStdoutPayload(input.stdoutPayload)

  if (!stdoutValidation.ok) {
    return {
      ok: false,
      status: "real_image_inference_stdout_contract_invalid",
      stdoutValidation,
      canShowToPlayer: false,
      tags: ["real_image_inference_adapter", "stdout_contract_invalid"],
    }
  }

  if (
    expectedOutputFileName &&
    stdoutValidation.imageFileName !== expectedOutputFileName
  ) {
    return {
      ok: false,
      status: "real_image_inference_stdout_output_file_name_mismatch",
      expectedOutputFileName,
      actualOutputFileName: stdoutValidation.imageFileName,
      canShowToPlayer: false,
      tags: ["real_image_inference_adapter", "output_file_name_mismatch"],
    }
  }

  return {
    ok: true,
    status: "real_image_inference_stdout_valid",
    imageFileName: stdoutValidation.imageFileName,
    imageFormat: stdoutValidation.imageFormat,
    width: stdoutValidation.width,
    height: stdoutValidation.height,
    license: stdoutValidation.license,
    originalityConfirmed: stdoutValidation.originalityConfirmed,
    stdoutValidation,
    canShowToPlayer: false,
    tags: [
      "real_image_inference_adapter",
      "stdout_contract_valid",
      "not_player_visible",
    ],
  }
}

function buildRequestFailure(input = {}) {
  return {
    ok: false,
    status: input.status,
    adapter: REAL_IMAGE_INFERENCE_ADAPTER_NAME,
    version: REAL_IMAGE_INFERENCE_ADAPTER_VERSION,
    detail: input.detail ?? null,
    canShowToPlayer: false,
    tags: [
      "real_image_inference_adapter",
      "inference_request_invalid",
      "not_player_visible",
    ],
  }
}

function buildReadinessSummary(readiness = {}) {
  return {
    ok: readiness.ok === true,
    status: readiness.status ?? null,
    license: readiness.license ?? null,
    originalityConfirmed: readiness.originalityConfirmed === true,
    manifestConfigured: readiness.manifestConfigured === true,
    canShowToPlayer: false,
  }
}

function buildOutputStorageSummary(outputStorage = {}) {
  return {
    ok: outputStorage.ok === true,
    status: outputStorage.status ?? null,
    publicBaseUrlConfigured: Boolean(outputStorage.publicBaseUrl),
    outputDirectoryProvidedByEnv: true,
    canShowToPlayer: false,
  }
}

function readImageFormat(value) {
  return ["png", "webp", "jpg"].includes(value) ? value : "png"
}

function readPositiveInteger(value) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function readString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function readRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {}
}
