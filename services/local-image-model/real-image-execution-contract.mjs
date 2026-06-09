// 当前文件作用：定义 AI-PET-WORLD 自研真实图像推理执行器契约；真实执行器未接入前只校验输入输出边界，不执行命令、不生成图片。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"

export const REAL_IMAGE_EXECUTION_CONTRACT_VERSION =
  "ai-pet-world-real-image-execution-contract-v1"

export const DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS = 120_000
export const MIN_REAL_IMAGE_EXECUTION_TIMEOUT_MS = 1_000
export const MAX_REAL_IMAGE_EXECUTION_TIMEOUT_MS = 600_000

export const REQUIRED_EXECUTION_STDOUT_FIELDS = [
  "ok",
  "status",
  "imageFileName",
  "imageFormat",
  "width",
  "height",
  "license",
  "originalityConfirmed",
]

export function buildRealImageExecutionContract(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)

  return {
    ok: true,
    status: "real_image_execution_contract_ready",
    contractVersion: REAL_IMAGE_EXECUTION_CONTRACT_VERSION,
    requiredResponseShape: requiredResponseFields,
    requiredStdoutFields: REQUIRED_EXECUTION_STDOUT_FIELDS,
    timeout: buildExecutionTimeout(input.timeoutMs),
    inputContract: buildExecutionInputContract(requiredResponseFields),
    stdoutContract: buildExecutionStdoutContract(),
    outputContract: buildExecutionOutputContract(requiredResponseFields),
    failureContract: buildExecutionFailureContract(),
    canShowToPlayer: false,
    tags: [
      "real_image_execution_contract",
      "execution_contract_ready",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function validateRealImageExecutionRequest(request = {}) {
  if (!isRecord(request)) {
    return buildExecutionFailure({
      status: "real_image_execution_request_invalid",
      message: "真实图像推理执行请求必须是对象。",
      messageEn: "The real image execution request must be an object.",
      tags: ["request_not_object"],
    })
  }

  if (!isRecord(request.readiness) || request.readiness.ok !== true) {
    return buildExecutionFailure({
      status: "real_image_execution_readiness_not_ready",
      message: "真实图像推理执行请求缺少已通过的 readiness gate。",
      messageEn:
        "The real image execution request is missing a passed readiness gate.",
      tags: ["readiness_not_ready"],
    })
  }

  if (!isRecord(request.outputStorage) || request.outputStorage.ok !== true) {
    return buildExecutionFailure({
      status: "real_image_execution_output_storage_not_ready",
      message: "真实图像推理执行请求缺少已通过的 output-storage 状态。",
      messageEn:
        "The real image execution request is missing a ready output-storage status.",
      tags: ["output_storage_not_ready"],
    })
  }

  if (!isRecord(request.modelTask)) {
    return buildExecutionFailure({
      status: "real_image_execution_model_task_missing",
      message: "真实图像推理执行请求缺少 modelTask。",
      messageEn: "The real image execution request is missing modelTask.",
      tags: ["model_task_missing"],
    })
  }

  if (!isRecord(request.promptPackage)) {
    return buildExecutionFailure({
      status: "real_image_execution_prompt_package_missing",
      message: "真实图像推理执行请求缺少 promptPackage。",
      messageEn: "The real image execution request is missing promptPackage.",
      tags: ["prompt_package_missing"],
    })
  }

  if (!isRecord(request.responseContract)) {
    return buildExecutionFailure({
      status: "real_image_execution_response_contract_missing",
      message: "真实图像推理执行请求缺少 responseContract。",
      messageEn:
        "The real image execution request is missing responseContract.",
      tags: ["response_contract_missing"],
    })
  }

  return {
    ok: true,
    status: "real_image_execution_request_valid",
    contractVersion: REAL_IMAGE_EXECUTION_CONTRACT_VERSION,
    canExecute: false,
    message:
      "真实图像推理执行请求契约有效，但当前执行器尚未接入，因此不会执行命令或生成图片。",
    messageEn:
      "The real image execution request contract is valid, but the executor is not connected yet, so no command will run and no image will be generated.",
    canShowToPlayer: false,
    tags: [
      "real_image_execution_contract",
      "execution_request_valid",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function validateRealImageExecutionStdoutPayload(payload = {}) {
  if (!isRecord(payload)) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_invalid",
      message: "真实图像推理 stdout 必须是 JSON 对象。",
      messageEn: "The real image execution stdout must be a JSON object.",
      tags: ["stdout_not_object"],
    })
  }

  for (const field of REQUIRED_EXECUTION_STDOUT_FIELDS) {
    if (!Object.hasOwn(payload, field)) {
      return buildExecutionFailure({
        status: "real_image_execution_stdout_field_missing",
        message: `真实图像推理 stdout 缺少字段：${field}。`,
        messageEn: `The real image execution stdout is missing field: ${field}.`,
        tags: ["stdout_field_missing", `missing_${field}`],
      })
    }
  }

  if (payload.ok !== true) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_not_ok",
      message: "真实图像推理 stdout ok 必须是 true。",
      messageEn: "The real image execution stdout ok must be true.",
      tags: ["stdout_not_ok"],
    })
  }

  if (payload.status !== "real_image_generated") {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_status_invalid",
      message: "真实图像推理 stdout status 必须是 real_image_generated。",
      messageEn:
        "The real image execution stdout status must be real_image_generated.",
      tags: ["stdout_status_invalid"],
    })
  }

  const imageFormat =
    typeof payload.imageFormat === "string"
      ? payload.imageFormat.trim().toLowerCase()
      : ""

  if (!ALLOWED_IMAGE_FORMATS.includes(imageFormat)) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_image_format_invalid",
      message: "真实图像推理 stdout imageFormat 不合法。",
      messageEn: "The real image execution stdout imageFormat is invalid.",
      tags: ["image_format_invalid"],
    })
  }

  const fileNameValidation = validateGeneratedImageFileName(
    payload.imageFileName,
    imageFormat
  )

  if (!fileNameValidation.ok) {
    return fileNameValidation
  }

  const width = Number(payload.width)
  const height = Number(payload.height)

  if (!Number.isFinite(width) || width < MINIMUM_IMAGE_WIDTH) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_width_invalid",
      message: `真实图像推理 stdout width 必须大于等于 ${MINIMUM_IMAGE_WIDTH}。`,
      messageEn: `The real image execution stdout width must be at least ${MINIMUM_IMAGE_WIDTH}.`,
      tags: ["width_invalid"],
    })
  }

  if (!Number.isFinite(height) || height < MINIMUM_IMAGE_HEIGHT) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_height_invalid",
      message: `真实图像推理 stdout height 必须大于等于 ${MINIMUM_IMAGE_HEIGHT}。`,
      messageEn: `The real image execution stdout height must be at least ${MINIMUM_IMAGE_HEIGHT}.`,
      tags: ["height_invalid"],
    })
  }

  if (!ALLOWED_LICENSES.includes(payload.license)) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_license_invalid",
      message: "真实图像推理 stdout license 不合法。",
      messageEn: "The real image execution stdout license is invalid.",
      tags: ["license_invalid"],
    })
  }

  if (payload.originalityConfirmed !== true) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_originality_not_confirmed",
      message: "真实图像推理 stdout 必须确认 originalityConfirmed=true。",
      messageEn:
        "The real image execution stdout must confirm originalityConfirmed=true.",
      tags: ["originality_not_confirmed"],
    })
  }

  return {
    ok: true,
    status: "real_image_execution_stdout_valid",
    imageFileName: payload.imageFileName,
    imageFormat,
    width,
    height,
    license: payload.license,
    originalityConfirmed: true,
    canShowToPlayer: false,
    tags: [
      "real_image_execution_contract",
      "stdout_valid",
      "bitmap_output_claim_valid",
      "not_player_visible",
    ],
  }
}

function validateGeneratedImageFileName(imageFileName, imageFormat) {
  if (typeof imageFileName !== "string" || !imageFileName.trim()) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_file_name_missing",
      message: "真实图像推理 stdout 缺少 imageFileName。",
      messageEn: "The real image execution stdout is missing imageFileName.",
      tags: ["file_name_missing"],
    })
  }

  const trimmed = imageFileName.trim()

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes(":")) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_file_name_path_forbidden",
      message: "真实图像推理 stdout imageFileName 不能包含路径分隔符或磁盘符。",
      messageEn:
        "The real image execution stdout imageFileName must not contain path separators or drive letters.",
      tags: ["file_name_path_forbidden"],
    })
  }

  if (trimmed.includes("..")) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_file_name_traversal_forbidden",
      message: "真实图像推理 stdout imageFileName 不能包含路径穿越。",
      messageEn:
        "The real image execution stdout imageFileName must not contain path traversal.",
      tags: ["file_name_traversal_forbidden"],
    })
  }

  const lower = trimmed.toLowerCase()

  if (!lower.endsWith(`.${imageFormat}`)) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_file_name_extension_mismatch",
      message: "真实图像推理 stdout imageFileName 扩展名必须与 imageFormat 一致。",
      messageEn:
        "The real image execution stdout imageFileName extension must match imageFormat.",
      tags: ["file_name_extension_mismatch"],
    })
  }

  if (!/^[a-z0-9][a-z0-9._-]{0,119}\.(png|webp|jpg)$/i.test(trimmed)) {
    return buildExecutionFailure({
      status: "real_image_execution_stdout_file_name_unsafe",
      message: "真实图像推理 stdout imageFileName 格式不安全。",
      messageEn:
        "The real image execution stdout imageFileName format is unsafe.",
      tags: ["file_name_unsafe"],
    })
  }

  return {
    ok: true,
  }
}

function buildExecutionInputContract(requiredResponseFields) {
  return {
    mustReceiveReadinessGate: true,
    mustReceiveOutputStorage: true,
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustNotRewriteWorldFacts: true,
    mustNotDisplayDirectly: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    requiredResponseFields,
  }
}

function buildExecutionStdoutContract() {
  return {
    mustBeJsonObject: true,
    requiredFields: REQUIRED_EXECUTION_STDOUT_FIELDS,
    okMustBeTrue: true,
    statusMustBe: "real_image_generated",
    imageFileNameMustBeSafeFileNameOnly: true,
    imageFileNameMustNotContainLocalPath: true,
    imageFileNameMustNotContainPathTraversal: true,
    imageFormatMustBeAllowed: ALLOWED_IMAGE_FORMATS,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    licenseMustBeAllowed: ALLOWED_LICENSES,
    originalityConfirmedMustBeTrue: true,
    mustNotReturnImageUrlDirectly: true,
    mustNotReturnFileUrl: true,
    mustNotReturnLocalFilePath: true,
    canShowToPlayer: false,
  }
}

function buildExecutionOutputContract(requiredResponseFields) {
  return {
    requiredResponseFields,
    mustWriteFileUnderOutputStorage: true,
    mustReturnPublicHttpUrlOnlyAfterStorageReference: true,
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

function buildExecutionFailureContract() {
  return {
    failureMustReturnJson: true,
    failureMustNotReturnImageUrl: true,
    failureMustNotWriteFakeImage: true,
    failureMustNotReturnPlaceholder: true,
    failureCanShowToPlayer: false,
  }
}

function buildExecutionTimeout(timeoutMs) {
  const normalized = Number(timeoutMs)

  if (
    Number.isFinite(normalized) &&
    normalized >= MIN_REAL_IMAGE_EXECUTION_TIMEOUT_MS &&
    normalized <= MAX_REAL_IMAGE_EXECUTION_TIMEOUT_MS
  ) {
    return {
      timeoutMs: normalized,
      isDefault: false,
    }
  }

  return {
    timeoutMs: DEFAULT_REAL_IMAGE_EXECUTION_TIMEOUT_MS,
    isDefault: true,
  }
}

function buildExecutionFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message,
    messageEn: input.messageEn,
    canShowToPlayer: false,
    tags: [
      "real_image_execution_contract",
      ...input.tags,
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}