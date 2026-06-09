// 当前文件作用：定义 AI-PET-WORLD 自研真实图像推理执行器未来 stdin JSON payload；只生成请求契约，不执行命令、不生成图片、不返回假图。

import { randomUUID } from "node:crypto"

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import {
  createSafeLocalImageOutputFileName,
  readLocalImageOutputStorageStatus,
  validateLocalImageOutputFileName,
} from "./output-storage.mjs"
import {
  buildRealImageExecutionContract,
  validateRealImageExecutionRequest,
} from "./real-image-execution-contract.mjs"

export const REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION =
  "ai-pet-world-real-image-executor-stdin-payload-v1"

export const REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_KIND =
  "future_executor_stdin_json_only"

export const REQUIRED_REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_FIELDS = [
  "requestId",
  "modelTask",
  "promptPackage",
  "outputStorage",
  "outputFileName",
  "manifest",
  "responseContract",
  "executionContract",
  "controlSketch",
  "visualFixHints",
  "worldFactMetadata",
  "audit",
  "constraints",
]

export const FORMAL_VISUAL_CHAIN_FOR_EXECUTOR_PAYLOAD = [
  "WorldRuntimeSaveRecord",
  "VisualFactManifest",
  "SceneIntent",
  "AI Painter Director",
  "CompositionPlan",
  "TerrainPlan",
  "AssetPlan",
  "MotionPlan",
  "PromptPackage",
  "AI Image Generation Model",
  "AiImageCandidate",
  "VisualJudge",
  "VisualFix",
  "ApprovedFrame",
  "Runtime Render",
  "Player View",
]

export function buildRealImageExecutorStdinPayload(input = {}) {
  const requestBody = readRecord(input.requestBody)
  const requiredResponseFields = readRequiredResponseFields(input)
  const requestId = readRequestId(
    input.requestId ?? input.requestAudit?.requestId ?? requestBody.requestId
  )
  const imageFormat = readImageFormat(
    input.imageFormat ??
      input.outputSize?.imageFormat ??
      requestBody.imageFormat ??
      requestBody.outputSize?.imageFormat
  )
  const safeOutputFileName = resolveSafeOutputFileName({
    outputFileName: input.outputFileName ?? requestBody.outputFileName,
    requestId,
    imageFormat,
  })

  if (!safeOutputFileName.ok) {
    return buildPayloadFailure({
      status: "real_image_executor_stdin_payload_output_file_name_invalid",
      message: "真实推理 stdin payload 的 outputFileName 不安全。",
      messageEn:
        "The real inference stdin payload outputFileName is not safe.",
      tags: safeOutputFileName.tags,
    })
  }

  const outputStorageStatus = readLocalImageOutputStorageStatus(
    readRecord(input.outputStorage)
  )
  const outputStorage = buildPayloadOutputStorage({
    outputStorageStatus,
    outputFileName: safeOutputFileName.fileName,
    imageFormat: safeOutputFileName.imageFormat,
  })
  const readiness = buildReadinessGate(input.readiness ?? input.realModelReadiness)
  const manifest = buildPayloadManifest(
    input.manifest ?? readiness.manifest ?? requestBody.manifest
  )
  const modelTask = buildPayloadModelTask(input.modelTask ?? requestBody.modelTask)
  const promptPackage = buildLockedPromptPackage(
    input.promptPackage ?? requestBody.promptPackage
  )
  const responseContract = buildPayloadResponseContract({
    source: input.responseContract ?? requestBody.responseContract,
    requiredResponseFields,
  })
  const executionContract = buildPayloadExecutionContract({
    source: input.executionContract,
    requiredResponseFields,
    timeoutMs: input.timeoutMs,
  })
  const controlSketch = buildPayloadControlSketch(
    input.controlSketch ?? requestBody.controlSketch
  )
  const visualFixHints = buildPayloadVisualFixHints(
    input.visualFixHints ?? requestBody.visualFixHints
  )
  const worldFactMetadata = buildLockedWorldFactMetadata(
    input.worldFactMetadata ?? requestBody.worldFactMetadata ?? requestBody.metadata
  )
  const audit = buildPayloadAudit({
    source: input.audit ?? input.requestAudit ?? requestBody.audit,
    requestId,
  })
  const constraints = buildPayloadConstraints(input.constraints)

  const payload = {
    schemaVersion: REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION,
    payloadKind: REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_KIND,
    requestId,
    modelTask,
    promptPackage,
    outputStorage,
    outputFileName: safeOutputFileName.fileName,
    manifest,
    responseContract,
    executionContract,
    controlSketch,
    visualFixHints,
    worldFactMetadata,
    audit,
    constraints,
    readiness,
    canShowToPlayer: false,
  }

  const validation = validateRealImageExecutorStdinPayload(payload)
  const executionRequestValidation = validateRealImageExecutionRequest({
    readiness,
    outputStorage,
    modelTask,
    promptPackage,
    responseContract,
  })

  if (!validation.ok) {
    return buildPayloadFailure({
      status: validation.status,
      message: validation.message,
      messageEn: validation.messageEn,
      tags: validation.tags,
      payload,
      validation,
      executionRequestValidation,
    })
  }

  return {
    ok: true,
    status: "real_image_executor_stdin_payload_ready",
    payload,
    outputFileName: safeOutputFileName.fileName,
    validation,
    executionRequestValidation,
    canExecuteCommand: false,
    willExecuteCommand: false,
    willGenerateImage: false,
    willWriteOutputFile: false,
    willReturnImageUrl: false,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_stdin_payload",
      "payload_ready",
      "future_stdin_json_only",
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export function validateRealImageExecutorStdinPayload(payload = {}) {
  if (!isRecord(payload)) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_invalid",
      message: "真实推理 stdin payload 必须是 JSON 对象。",
      messageEn: "The real inference stdin payload must be a JSON object.",
      tags: ["payload_not_object"],
    })
  }

  if (payload.schemaVersion !== REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_schema_invalid",
      message: `真实推理 stdin payload schemaVersion 必须是 ${REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION}。`,
      messageEn: `The real inference stdin payload schemaVersion must be ${REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION}.`,
      tags: ["schema_version_invalid"],
    })
  }

  for (const field of REQUIRED_REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_FIELDS) {
    if (!Object.hasOwn(payload, field)) {
      return buildPayloadValidationFailure({
        status: "real_image_executor_stdin_payload_field_missing",
        message: `真实推理 stdin payload 缺少字段：${field}。`,
        messageEn: `The real inference stdin payload is missing field: ${field}.`,
        tags: ["required_field_missing", `missing_${field}`],
      })
    }
  }

  if (!isNonEmptyString(payload.requestId)) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_request_id_invalid",
      message: "真实推理 stdin payload requestId 不能为空。",
      messageEn:
        "The real inference stdin payload requestId cannot be empty.",
      tags: ["request_id_invalid"],
    })
  }

  const objectFields = [
    "modelTask",
    "promptPackage",
    "outputStorage",
    "manifest",
    "responseContract",
    "executionContract",
    "controlSketch",
    "worldFactMetadata",
    "audit",
    "constraints",
  ]

  for (const field of objectFields) {
    if (!isRecord(payload[field])) {
      return buildPayloadValidationFailure({
        status: "real_image_executor_stdin_payload_object_field_invalid",
        message: `真实推理 stdin payload 字段必须是对象：${field}。`,
        messageEn: `The real inference stdin payload field must be an object: ${field}.`,
        tags: ["object_field_invalid", `invalid_${field}`],
      })
    }
  }

  if (!Array.isArray(payload.visualFixHints)) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_visual_fix_hints_invalid",
      message: "真实推理 stdin payload visualFixHints 必须是数组。",
      messageEn:
        "The real inference stdin payload visualFixHints must be an array.",
      tags: ["visual_fix_hints_invalid"],
    })
  }

  if (payload.canShowToPlayer !== false) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_display_gate_invalid",
      message:
        "真实推理 stdin payload 顶层必须保持 canShowToPlayer=false。",
      messageEn:
        "The real inference stdin payload top-level canShowToPlayer must remain false.",
      tags: ["display_gate_invalid"],
    })
  }

  const fileNameValidation = validateLocalImageOutputFileName({
    fileName: payload.outputFileName,
    imageFormat: payload.outputStorage.imageFormat,
  })

  if (!fileNameValidation.ok) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_output_file_name_invalid",
      message: "真实推理 stdin payload outputFileName 不符合 output-storage 安全规则。",
      messageEn:
        "The real inference stdin payload outputFileName does not satisfy output-storage safety rules.",
      tags: fileNameValidation.tags,
    })
  }

  if (payload.outputStorage.outputFileName !== payload.outputFileName) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_output_file_name_mismatch",
      message:
        "真实推理 stdin payload outputStorage.outputFileName 必须等于 outputFileName。",
      messageEn:
        "The real inference stdin payload outputStorage.outputFileName must equal outputFileName.",
      tags: ["output_file_name_mismatch"],
    })
  }

  if (payload.outputStorage.canShowToPlayer !== false) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_output_storage_gate_invalid",
      message:
        "真实推理 stdin payload outputStorage 必须保持 canShowToPlayer=false。",
      messageEn:
        "The real inference stdin payload outputStorage canShowToPlayer must remain false.",
      tags: ["output_storage_display_gate_invalid"],
    })
  }

  if (
    Object.hasOwn(payload.outputStorage, "internalFilePath") ||
    Object.hasOwn(payload.outputStorage, "outputDirectory") ||
    Object.hasOwn(payload.outputStorage, "localFilePath")
  ) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_local_path_forbidden",
      message:
        "真实推理 stdin payload 不允许暴露 internalFilePath / outputDirectory / localFilePath。",
      messageEn:
        "The real inference stdin payload must not expose internalFilePath / outputDirectory / localFilePath.",
      tags: ["local_path_forbidden"],
    })
  }

  if (payload.worldFactMetadata.locked !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_world_facts_not_locked",
      message: "真实推理 stdin payload 必须锁定 world facts。",
      messageEn:
        "The real inference stdin payload must lock world facts.",
      tags: ["world_facts_not_locked"],
    })
  }

  if (payload.worldFactMetadata.mustNotRewriteWorldFacts !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_world_fact_rewrite_not_blocked",
      message:
        "真实推理 stdin payload 必须明确禁止推理脚本改写 world facts。",
      messageEn:
        "The real inference stdin payload must explicitly forbid the inference script from rewriting world facts.",
      tags: ["world_fact_rewrite_not_blocked"],
    })
  }

  if (payload.constraints.worldFactsLocked !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_constraints_world_facts_unlocked",
      message: "真实推理 stdin payload constraints 必须声明 worldFactsLocked=true。",
      messageEn:
        "The real inference stdin payload constraints must declare worldFactsLocked=true.",
      tags: ["constraints_world_facts_unlocked"],
    })
  }

  if (payload.constraints.mustPersistOnlyAsHiddenCandidate !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_hidden_candidate_gate_missing",
      message:
        "真实推理 stdin payload 必须要求输出只能进入隐藏 AiImageCandidate。",
      messageEn:
        "The real inference stdin payload must require output to enter only hidden AiImageCandidate.",
      tags: ["hidden_candidate_gate_missing"],
    })
  }

  if (payload.constraints.mustPassVisualJudge !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_visual_judge_gate_missing",
      message: "真实推理 stdin payload 必须要求 VisualJudge。",
      messageEn:
        "The real inference stdin payload must require VisualJudge.",
      tags: ["visual_judge_gate_missing"],
    })
  }

  if (payload.constraints.mustCreateApprovedFrameBeforePlayerView !== true) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_approved_frame_gate_missing",
      message:
        "真实推理 stdin payload 必须要求 ApprovedFrame 后才能进入 Player View。",
      messageEn:
        "The real inference stdin payload must require ApprovedFrame before Player View.",
      tags: ["approved_frame_gate_missing"],
    })
  }

  if (payload.audit.willExecuteCommand !== false) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_execution_flag_invalid",
      message:
        "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-13 只定义 payload，audit.willExecuteCommand 必须是 false。",
      messageEn:
        "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-13 only defines the payload, so audit.willExecuteCommand must be false.",
      tags: ["execution_flag_invalid"],
    })
  }

  if (containsForbiddenFileUrl(payload)) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_file_url_forbidden",
      message: "真实推理 stdin payload 不允许包含 file://。",
      messageEn:
        "The real inference stdin payload must not contain file://.",
      tags: ["file_url_forbidden"],
    })
  }

  if (Object.hasOwn(payload, "imageUrl")) {
    return buildPayloadValidationFailure({
      status: "real_image_executor_stdin_payload_image_url_forbidden",
      message:
        "真实推理 stdin payload 是未来 stdin 请求，不允许提前携带 imageUrl。",
      messageEn:
        "The real inference stdin payload is a future stdin request and must not carry imageUrl in advance.",
      tags: ["image_url_forbidden"],
    })
  }

  return {
    ok: true,
    status: "real_image_executor_stdin_payload_valid",
    payloadVersion: payload.schemaVersion,
    requestId: payload.requestId,
    outputFileName: payload.outputFileName,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_stdin_payload",
      "payload_valid",
      "future_stdin_json_only",
      "world_facts_locked",
      "hidden_candidate_required",
      "visual_judge_required",
      "approved_frame_required",
      "does_not_execute",
      "does_not_generate",
      "not_player_visible",
    ],
  }
}

function buildPayloadOutputStorage(input) {
  const storage = input.outputStorageStatus

  return {
    ok: storage.ok === true,
    status: storage.status ?? "local_image_output_storage_rules_ready",
    outputDirectoryConfigured: Boolean(storage.outputDirectory),
    outputDirectoryValueHidden: true,
    publicBaseUrl: storage.publicBaseUrl,
    publicRoutePrefix: storage.publicRoutePrefix,
    maxFileBytes: storage.maxFileBytes,
    allowedImageFormats: storage.allowedImageFormats,
    outputFileName: input.outputFileName,
    imageFormat: input.imageFormat,
    mustStoreUnderOutputDirectory: true,
    mustReturnPublicHttpUrl: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    mustNotExposeOutputDirectoryToPlayer: true,
    canShowToPlayer: false,
    tags: [
      "local_image_output_storage",
      "safe_output_file_name_attached",
      "output_directory_hidden",
      "not_player_visible",
    ],
  }
}

function buildReadinessGate(source) {
  const readiness = readRecord(source)

  return {
    ok: readiness.ok === true,
    status: readiness.status ?? "real_image_model_readiness_not_attached",
    enabled: readiness.enabled === true,
    assetDirectoryConfigured: readiness.assetDirectoryConfigured === true,
    manifestConfigured: readiness.manifestConfigured === true,
    license: typeof readiness.license === "string" ? readiness.license : null,
    originalityConfirmed: readiness.originalityConfirmed === true,
    manifest: readRecord(readiness.manifest),
    canRunInference: false,
    canShowToPlayer: false,
    tags: mergeTags(readiness.tags, [
      "readiness_gate_sanitized_for_stdin_payload",
      "does_not_execute",
      "does_not_generate",
      "not_player_visible",
    ]),
  }
}

function buildPayloadManifest(source) {
  const manifest = readRecord(source)

  if (Object.keys(manifest).length === 0) {
    return {
      ok: false,
      status: "real_model_manifest_not_attached_to_payload",
      canShowToPlayer: false,
      tags: [
        "real_model_manifest",
        "manifest_not_attached",
        "does_not_execute",
        "does_not_generate",
        "not_player_visible",
      ],
    }
  }

  return {
    ...manifest,
    canShowToPlayer: false,
    unlicensedThirdPartyArtworkAllowed:
      manifest.unlicensedThirdPartyArtworkAllowed === false ? false : null,
    mustNotUseUnlicensedThirdPartyArtwork: true,
    tags: mergeTags(manifest.tags, [
      "real_model_manifest",
      "manifest_attached_to_stdin_payload",
      "not_player_visible",
    ]),
  }
}

function buildPayloadModelTask(source) {
  const modelTask = readRecord(source)

  return {
    ...modelTask,
    taskKind:
      modelTask.taskKind ?? "generate_hidden_world_bitmap_candidate",
    modelRole: modelTask.modelRole ?? "ai_image_generation_model",
    outputPurpose:
      modelTask.outputPurpose ?? "hidden_ai_image_candidate",
    worldFrameKind:
      modelTask.worldFrameKind ?? "static_top_down_pixel_world_frame",
    mustReturnResponseContract: true,
    mustNotDisplayDirectly: true,
    mustNotRewriteWorldFacts: true,
    mustNotUseProgrammaticRenderer: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    mustWriteOnlyToOutputStorage: true,
    mustReturnOnlyStdoutJson: true,
    canShowToPlayer: false,
    tags: mergeTags(modelTask.tags, [
      "ai_image_generation_model",
      "hidden_candidate_only",
      "response_contract_required",
      "future_stdin_json_only",
    ]),
  }
}

function buildLockedPromptPackage(source) {
  const promptPackage = readRecord(source)

  return {
    ...promptPackage,
    canShowToPlayer: false,
    worldFactsLocked: true,
    factsAreReadOnly: true,
    inferenceScriptMayNotRewriteWorldFacts: true,
    mustNotUseUnlicensedThirdPartyArtwork: true,
    mustNotCreatePlaceholder: true,
    mustNotCreateProgrammaticRenderer: true,
    tags: mergeTags(promptPackage.tags, [
      "prompt_package",
      "world_facts_locked",
      "future_stdin_json_only",
      "not_player_visible",
    ]),
  }
}

function buildPayloadResponseContract(input) {
  const responseContract = readRecord(input.source)

  return {
    ...responseContract,
    requiredFields: input.requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    canShowToPlayer: false,
    mustPersistAsAiImageCandidate: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    mustCreateApprovedFrameBeforeRuntimeRender: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    tags: mergeTags(responseContract.tags, [
      "response_contract_required",
      "hidden_candidate_required",
      "visual_judge_required",
      "approved_frame_required",
      "not_player_visible",
    ]),
  }
}

function buildPayloadExecutionContract(input) {
  const fallback = buildRealImageExecutionContract({
    requiredResponseFields: input.requiredResponseFields,
    timeoutMs: input.timeoutMs,
  })
  const source = readRecord(input.source)

  return {
    ...fallback,
    ...source,
    contractVersion: source.contractVersion ?? fallback.contractVersion,
    canShowToPlayer: false,
    tags: mergeTags(fallback.tags, source.tags, [
      "execution_contract_attached_to_stdin_payload",
      "future_stdin_json_only",
      "does_not_execute",
      "does_not_generate",
      "not_player_visible",
    ]),
  }
}

function buildPayloadControlSketch(source) {
  const controlSketch = readRecord(source)

  return {
    ...controlSketch,
    controlSketchId:
      controlSketch.controlSketchId ?? "executor-stdin-control-sketch-none",
    canShowToPlayer: false,
    cannotApprove: true,
    isPlayerVisible: false,
    mustNotBeRenderedDirectly: true,
    tags: mergeTags(controlSketch.tags, [
      "control_sketch",
      "not_player_visible",
      "cannot_approve",
    ]),
  }
}

function buildPayloadVisualFixHints(source) {
  if (!Array.isArray(source)) {
    return []
  }

  return cloneJson(source).map((hint) => {
    if (!isRecord(hint)) {
      return {
        value: hint,
        canShowToPlayer: false,
      }
    }

    return {
      ...hint,
      canShowToPlayer: false,
      mustNotRewriteWorldFacts: true,
    }
  })
}

function buildLockedWorldFactMetadata(source) {
  const metadata = readRecord(source)
  const sourceFactIds = Array.isArray(metadata.sourceFactIds)
    ? metadata.sourceFactIds.filter((item) => typeof item === "string")
    : []

  return {
    ...metadata,
    sourceFactIds,
    locked: true,
    worldFactsLocked: true,
    factsAreReadOnly: true,
    mustNotRewriteWorldFacts: true,
    inferenceScriptMayReadWorldFacts: true,
    inferenceScriptMayNotRewriteWorldFacts: true,
    canShowToPlayer: false,
    tags: mergeTags(metadata.tags, [
      "world_fact_metadata",
      "world_facts_locked",
      "read_only_for_inference_script",
      "not_player_visible",
    ]),
  }
}

function buildPayloadAudit(input) {
  const audit = readRecord(input.source)

  return {
    ...audit,
    requestId: input.requestId,
    payloadVersion: REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_VERSION,
    payloadKind: REAL_IMAGE_EXECUTOR_STDIN_PAYLOAD_KIND,
    node: "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-13",
    purpose: "define_future_executor_stdin_json_payload",
    createdAt: audit.createdAt ?? new Date().toISOString(),
    willExecuteCommand: false,
    didExecuteCommand: false,
    willGenerateImage: false,
    didGenerateImage: false,
    willWriteOutputFile: false,
    didWriteOutputFile: false,
    canShowToPlayer: false,
    tags: mergeTags(audit.tags, [
      "audit",
      "future_stdin_json_only",
      "does_not_execute",
      "does_not_generate",
      "not_player_visible",
    ]),
  }
}

function buildPayloadConstraints(source) {
  const constraints = readRecord(source)

  return {
    ...constraints,
    formalVisualChain: FORMAL_VISUAL_CHAIN_FOR_EXECUTOR_PAYLOAD,
    localImageModelOnly: true,
    thirdPartyProviderForbidden: true,
    mustUseSelfOwnedOrAllowedLicensedModelData: true,
    mustNotUseUnlicensedThirdPartyArtwork: true,
    mustNotReturnFakeImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnTxtDebugImage: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    outputMustUseSafeFileNameOnly: true,
    outputMustStayUnderOutputStorage: true,
    worldFactsLocked: true,
    inferenceScriptMayNotRewriteWorldFacts: true,
    candidateMustBeHidden: true,
    mustPersistOnlyAsHiddenCandidate: true,
    candidateCanShowToPlayer: false,
    mustPassVisualJudge: true,
    mustCreateApprovedFrameBeforePlayerView: true,
    approvedFrameRequiredBeforeRuntimeRender: true,
    canShowToPlayer: false,
    willExecuteCommand: false,
    willGenerateImage: false,
    tags: mergeTags(constraints.tags, [
      "formal_visual_chain_locked",
      "local_model_only",
      "world_facts_locked",
      "hidden_candidate_required",
      "visual_judge_required",
      "approved_frame_required",
      "does_not_execute",
      "does_not_generate",
      "not_player_visible",
    ]),
  }
}

function resolveSafeOutputFileName(input) {
  if (typeof input.outputFileName === "string" && input.outputFileName.trim()) {
    return validateLocalImageOutputFileName({
      fileName: input.outputFileName,
      imageFormat: input.imageFormat,
    })
  }

  return createSafeLocalImageOutputFileName({
    seed: input.requestId,
    uniqueSuffix: "executor-stdin",
    imageFormat: input.imageFormat,
  })
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}

function readImageFormat(value) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase().replace(/^\./, "") : ""

  return ALLOWED_IMAGE_FORMATS.includes(normalized) ? normalized : "png"
}

function readRequestId(value) {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : `real-image-request-${randomUUID()}`

  const sanitized = raw
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return sanitized || `real-image-request-${randomUUID()}`
}

function containsForbiddenFileUrl(value) {
  if (typeof value === "string") {
    return value.trim().toLowerCase().startsWith("file:")
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenFileUrl(item))
  }

  if (isRecord(value)) {
    return Object.values(value).some((item) => containsForbiddenFileUrl(item))
  }

  return false
}

function buildPayloadFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message,
    messageEn: input.messageEn,
    payload: input.payload,
    validation: input.validation,
    executionRequestValidation: input.executionRequestValidation,
    canExecuteCommand: false,
    willExecuteCommand: false,
    willGenerateImage: false,
    willWriteOutputFile: false,
    willReturnImageUrl: false,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_stdin_payload",
      ...(Array.isArray(input.tags) ? input.tags : []),
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildPayloadValidationFailure(input) {
  return {
    ok: false,
    status: input.status,
    message: input.message,
    messageEn: input.messageEn,
    canShowToPlayer: false,
    tags: [
      "real_image_executor_stdin_payload",
      ...input.tags,
      "does_not_execute",
      "does_not_generate",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function readRecord(value) {
  return isRecord(value) ? cloneJson(value) : {}
}

function cloneJson(value) {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

function mergeTags(...tagGroups) {
  return [
    ...new Set(
      tagGroups.flatMap((tags) => (Array.isArray(tags) ? tags : []))
    ),
  ]
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}