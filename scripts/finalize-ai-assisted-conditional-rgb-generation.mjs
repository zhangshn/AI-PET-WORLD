import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests")
const POINTER_PATH = path.join(REQUEST_ROOT, "latest.json")
const inputArg = argumentValue("--input")
const requestIdArg = argumentValue("--request-id")
assert(inputArg, "usage: npm run finalize:ai-assisted-conditional-rgb -- --input <generated-image.png> [--request-id <request-id>]")
if (requestIdArg) assert(/^conditional-rgb-\d{3}-[0-9TZ-]+$/.test(requestIdArg), "invalid conditional RGB request id")

const inputPath = path.resolve(inputArg)
assert(fs.existsSync(inputPath) && fs.statSync(inputPath).isFile(), "generated image is missing")
const pointer = readJson(POINTER_PATH)
const requestPath = requestIdArg
  ? path.join(REQUEST_ROOT, requestIdArg, "request.json")
  : resolveProjectPath(pointer.requestPath)
assert(fs.existsSync(requestPath), `conditional RGB request is missing: ${requestIdArg ?? pointer.requestPath}`)
const request = readJson(requestPath)
if (requestIdArg) assert(request.requestId === requestIdArg, "conditional RGB request identity mismatch")
const retryablePreCallFailure = request.status === "generation_failed_retryable"
  ? readAuthorizedPreCallFailure(request)
  : null
const retryableProcessingFailure = request.status === "processing_failed_retryable"
  ? readAuthorizedProcessingFailure(request, inputPath)
  : null
assert(
  request.status === "ready_for_openai_assisted_generation" ||
    retryablePreCallFailure ||
    retryableProcessingFailure,
  `request is not ready: ${request.status}`,
)
const promptEvidence = readJson(request.promptEvidencePath)
assert(promptEvidence.promptId === request.requestId, "prompt evidence identity mismatch")
verifyHash(request.promptEvidencePath, request.promptEvidenceSha256, "prompt evidence hash mismatch")

const inputBytes = fs.readFileSync(inputPath)
const inputMetadata = await sharp(inputBytes, { failOn: "error" }).metadata()
const sourceWidth = inputMetadata.width ?? 0
const sourceHeight = inputMetadata.height ?? 0
const sourceIsNativeTrainingSize = sourceWidth === 1024 && sourceHeight === 768
const sourceIsEligibleHighResolutionFourThree = sourceWidth >= 1024
  && sourceHeight >= 768
  && sourceWidth * 3 === sourceHeight * 4

if (!sourceIsNativeTrainingSize && !sourceIsEligibleHighResolutionFourThree) {
  const failureCode = sourceWidth < 1024 || sourceHeight < 768
    ? "cold_start_source_resolution_too_small"
    : "cold_start_source_aspect_ratio_invalid"
  const failed = persistSourceContractFailure({
    request,
    requestPath,
    pointer,
    inputPath,
    inputBytes,
    sourceWidth,
    sourceHeight,
    failureCode,
  })
  console.error(JSON.stringify(failed.summary, null, 2))
  process.exit(1)
}

let intake
try {
  intake = runJsonScript([
    path.join(ROOT, "scripts", "intake-ai-assisted-cold-start-image.mjs"),
    "--input", inputPath,
    "--prompt-evidence", resolveProjectPath(request.promptEvidencePath),
    "--record-id", request.outputRecordId,
    "--title", request.title,
    "--category-id", request.categoryId,
    "--regional-landscape-type", request.regionalLandscapeType,
    "--task-package", resolveProjectPath(request.taskPackagePath),
    "--condition-pack", resolveProjectPath(request.conditionPackPath),
    "--condition-guide-manifest", resolveProjectPath(request.conditionGuideManifestPath),
  ], "conditional RGB intake")
} catch (error) {
  persistProcessingFailure({ request, inputPath, inputBytes, stage: "conditional_rgb_intake", error })
  throw error
}

let automaticReview
try {
  automaticReview = runJsonScript([
    path.join(ROOT, "scripts", "run-ai-assisted-cold-start-review-pipeline.mjs"),
    "--record-id", request.outputRecordId,
    "--category-id", request.categoryId,
  ], "automatic review pipeline")
} catch (error) {
  persistProcessingFailure({ request, inputPath, inputBytes, stage: "automatic_review_pipeline", error })
  throw error
}

const timestamp = new Date().toISOString()
const completed = {
  ...request,
  status: automaticReview.status === "machine_rejected_and_archived"
    ? "generated_intaked_machine_rejected"
    : "generated_intaked_machine_passed_waiting_owner_review",
  generatedAtUtc: timestamp,
  generatedAtAsiaShanghai: formatShanghai(timestamp),
  generatedImageSourcePath: inputPath,
  generatedImageSourceSha256: sha256(inputBytes),
  generatedImageSourceSize: { width: sourceWidth, height: sourceHeight },
  generatedImageSourceContract: sourceIsNativeTrainingSize
    ? "native_1024x768"
    : "high_resolution_exact_four_three_with_audited_1024x768_derivative",
  normalizedImagePath: intake.normalizedImagePath,
  normalizedImageSha256: intake.normalizedImageSha256,
  derivativePolicyVersion: intake.derivativePolicyVersion,
  transformation: intake.transformation,
  originalImageRecordPath: intake.recordPath,
  machineReviewStatus: automaticReview.machineReviewStatus,
  machineReviewPath: automaticReview.machineReviewPath,
  ownerReviewStatus: automaticReview.ownerReviewStatus,
  conditionalTrainingEligible: false,
  intakeResult: intake,
  automaticReview,
  preCallFailureRecovery: retryablePreCallFailure
    ? {
        status: "recovered_from_recorded_pre_call_failure",
        attemptPath: request.latestGenerationAttemptPath,
        attemptSha256: sha256(fs.readFileSync(resolveProjectPath(request.latestGenerationAttemptPath))),
        failureCode: retryablePreCallFailure.failureCode,
        attemptedRoute: retryablePreCallFailure.attemptedRoute,
        generatedImageCreatedByFailedAttempt: false,
      }
    : null,
  processingFailureRecovery: retryableProcessingFailure
    ? {
        status: "resumed_same_generated_image_after_processing_gate_repair",
        failurePath: request.latestProcessingFailurePath,
        failureSha256: sha256(
          fs.readFileSync(
            resolveProjectPath(request.latestProcessingFailurePath),
          ),
        ),
        imageRegenerated: false,
      }
    : null,
  automaticStorage: true,
}
writeJson(requestPath, completed)
writeJson(path.join(path.dirname(requestPath), "generation-result.json"), completed)
writeJson(POINTER_PATH, {
  ...pointer,
  status: completed.status,
  generatedAtUtc: timestamp,
  requestPath: projectPath(requestPath),
  generatedImageSourceSize: completed.generatedImageSourceSize,
  generatedImageSourceContract: completed.generatedImageSourceContract,
  normalizedImagePath: completed.normalizedImagePath,
  originalImageRecordPath: completed.originalImageRecordPath,
  machineReviewStatus: completed.machineReviewStatus,
  ownerReviewStatus: completed.ownerReviewStatus,
  automaticReviewRunReportPath: automaticReview.runReportPath,
})
console.log(JSON.stringify({
  status: completed.status,
  requestId: completed.requestId,
  outputRecordId: completed.outputRecordId,
  generatedImageSourceSize: completed.generatedImageSourceSize,
  generatedImageSourceContract: completed.generatedImageSourceContract,
  normalizedImagePath: completed.normalizedImagePath,
  normalizedImageSha256: completed.normalizedImageSha256,
  transformation: completed.transformation,
  derivativePolicyVersion: completed.derivativePolicyVersion,
  originalImageRecordPath: completed.originalImageRecordPath,
  machineReviewStatus: completed.machineReviewStatus,
  machineReviewPath: completed.machineReviewPath,
  ownerReviewStatus: completed.ownerReviewStatus,
  automaticReviewRunReportPath: automaticReview.runReportPath,
  conditionalTrainingEligible: false,
  automaticStorage: true,
}, null, 2))

function readAuthorizedPreCallFailure(requestValue) {
  assert(typeof requestValue.latestGenerationAttemptPath === "string", "retryable request is missing its latest generation attempt")
  const attemptPath = resolveProjectPath(requestValue.latestGenerationAttemptPath)
  assert(fs.existsSync(attemptPath) && fs.statSync(attemptPath).isFile(), "retryable request generation attempt is missing")
  const attempt = readJson(attemptPath)
  assert(attempt.requestId === requestValue.requestId, "retryable pre-call failure request identity mismatch")
  assert(attempt.status === "generation_failed_retryable", "retryable pre-call failure status mismatch")
  const authorizedFailureIdentity = (
    attempt.failureCode === "prompt_evidence_field_location_mismatch"
    && attempt.attemptedRoute === "codex_builtin_imagegen_pre_call_prompt_read"
  ) || (
    attempt.failureCode === "codex_builtin_prompt_source_path_mismatch"
    && attempt.attemptedRoute === "codex_builtin_image_generation"
  )
  assert(authorizedFailureIdentity, "retryable failure is not the authorized pre-call prompt-read failure")
  assert(attempt.generatedImageCreated === false, "retryable pre-call failure unexpectedly generated an image")
  assert(attempt.generatedImagePath === null && attempt.generatedImageSha256 === null, "retryable pre-call failure contains generated image identity")
  return attempt
}

function readAuthorizedProcessingFailure(requestValue, sourcePath) {
  assert(
    typeof requestValue.latestProcessingFailurePath === "string",
    "retryable processing request is missing failure evidence",
  )
  const failurePath = resolveProjectPath(
    requestValue.latestProcessingFailurePath,
  )
  const failure = readJson(failurePath)
  assert(
    failure.requestId === requestValue.requestId &&
      failure.status === "processing_failed_before_intake_completion" &&
      failure.imageRegenerationRequired === false,
    "retryable processing failure evidence is invalid",
  )
  assert(
    failure.inputSha256 === sha256(fs.readFileSync(sourcePath)),
    "retryable processing input must be the same generated image",
  )
  return failure
}

function persistSourceContractFailure({ request: requestValue, requestPath: requestFile, pointer: pointerValue, inputPath: sourcePath, inputBytes: sourceBytes, sourceWidth: width, sourceHeight: height, failureCode }) {
  const timestamp = new Date().toISOString()
  const failed = {
    ...requestValue,
    status: "generated_rejected_source_contract",
    generatedAtUtc: timestamp,
    generatedAtAsiaShanghai: formatShanghai(timestamp),
    generatedImageSourcePath: sourcePath,
    generatedImageSourceSha256: sha256(sourceBytes),
    generatedImageSourceSize: { width, height },
    normalizedImagePath: null,
    normalizedImageSha256: null,
    originalImageRecordPath: null,
    machineReviewStatus: "not_reached_source_contract_failed",
    ownerReviewStatus: "not_reached_machine_failed",
    conditionalTrainingEligible: false,
    failureCodes: [failureCode],
    automaticStorage: true,
  }
  writeJson(requestFile, failed)
  writeJson(path.join(path.dirname(requestFile), "generation-result.json"), failed)
  const ledgerEvent = appendAiPainterProgramEvent({
    action: "finalize_ai_assisted_conditional_rgb",
    runId: requestValue.requestId,
    kind: "step_failed",
    status: "failed",
    title: "AI-assisted conditional RGB source contract rejected",
    titleZh: "AI 辅助条件 RGB 原始文件契约不合格",
    detail: `failureCode=${failureCode}; sourceSize=${width}x${height}; required=exact 4:3 and no smaller than 1024x768`,
    detailZh: `失败码=${failureCode}；原始尺寸=${width}x${height}；要求=精确 4:3 且不小于 1024x768`,
    script: "scripts/finalize-ai-assisted-conditional-rgb-generation.mjs",
    currentStep: "source_contract_gate",
    error: failureCode,
    errorZh: "AI 生成原始文件不是精确 4:3，或尺寸小于 1024×768。",
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: requestValue.outputRecordId,
    evidencePath: projectPath(requestFile),
    nextAction: "regenerate_high_resolution_exact_four_three_source",
    nextActionZh: "重新生成不小于 1024×768 的精确 4:3 高分辨率原始文件。",
  })
  writeJson(POINTER_PATH, {
    ...pointerValue,
    status: failed.status,
    generatedAtUtc: timestamp,
    requestPath: projectPath(requestFile),
    generatedImageSourceSha256: failed.generatedImageSourceSha256,
    generatedImageSourceSize: failed.generatedImageSourceSize,
    machineReviewStatus: failed.machineReviewStatus,
    ownerReviewStatus: failed.ownerReviewStatus,
    failureCodes: failed.failureCodes,
    ledgerEventId: ledgerEvent.id,
  })
  return {
    failed,
    summary: {
      status: failed.status,
      requestId: failed.requestId,
      outputRecordId: failed.outputRecordId,
      generatedImageSourceSize: failed.generatedImageSourceSize,
      requiredSourceContract: {
        aspectRatio: "4:3",
        minimumSize: { width: 1024, height: 768 },
        cropAllowed: false,
        upscaleAllowed: false,
      },
      failureCodes: failed.failureCodes,
      ledgerEventId: ledgerEvent.id,
      automaticStorage: true,
    },
  }
}

function persistProcessingFailure({ request: requestValue, inputPath: sourcePath, inputBytes: sourceBytes, stage, error }) {
  const timestamp = new Date().toISOString()
  const failureId = `${requestValue.requestId}-${stage}-${timestamp.replace(/[:.]/g, "-")}`
  const failurePath = path.join(path.dirname(requestPath), `${failureId}.json`)
  const failure = {
    schemaVersion: "ai-assisted-conditional-rgb-processing-failure-v1",
    failureId,
    status: "processing_failed_before_intake_completion",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    requestId: requestValue.requestId,
    outputRecordId: requestValue.outputRecordId,
    stage,
    inputPath: sourcePath,
    inputSha256: sha256(sourceBytes),
    error: String(error?.message ?? error),
    requestStatusPreserved: requestValue.status,
    imageRegenerationRequired: false,
    gpuTrainingStarted: false,
    automaticNextGenerationAuthorized: false,
    automaticStorage: true,
  }
  writeJson(failurePath, failure)
  const ledgerEvent = appendAiPainterProgramEvent({
    action: "finalize_ai_assisted_conditional_rgb",
    runId: requestValue.requestId,
    kind: "step_failed",
    status: "failed",
    title: "Conditional RGB processing failed before intake completion",
    titleZh: "条件 RGB 在接收完成前处理失败",
    detail: `stage=${stage}; inputSha256=${failure.inputSha256}; error=${failure.error}`,
    detailZh: `阶段=${stage}；输入哈希=${failure.inputSha256}；错误=${failure.error}`,
    script: "scripts/finalize-ai-assisted-conditional-rgb-generation.mjs",
    currentStep: stage,
    error: failure.error,
    errorZh: failure.error,
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: requestValue.outputRecordId,
    evidencePath: projectPath(failurePath),
    nextAction: "repair_processing_gate_and_resume_same_generated_image",
    nextActionZh: "修复处理门禁并继续使用同一张已生成图片，不重新出图",
  })
  const failedRequest = {
    ...requestValue,
    status: "processing_failed_retryable",
    updatedAtUtc: timestamp,
    updatedAtAsiaShanghai: failure.createdAtAsiaShanghai,
    generatedImageSourcePath: sourcePath,
    generatedImageSourceSha256: failure.inputSha256,
    latestProcessingFailurePath: projectPath(failurePath),
    processingFailurePaths: [
      ...(requestValue.processingFailurePaths ?? []),
      projectPath(failurePath),
    ],
    imageRegenerationRequired: false,
    automaticNextGenerationAuthorized: false,
    automaticStorage: true,
  }
  writeJson(requestPath, failedRequest)
  writeJson(POINTER_PATH, {
    ...readJson(POINTER_PATH),
    status: failedRequest.status,
    updatedAtUtc: timestamp,
    requestPath: projectPath(requestPath),
    latestProcessingFailurePath: projectPath(failurePath),
    generatedImageSourceSha256: failure.inputSha256,
    ledgerEventId: ledgerEvent.id,
  })
  return failure
}

function runJsonScript(args, label) {
  const child = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
  if (child.status !== 0) throw new Error(child.stderr || child.stdout || `${label} exited ${child.status}`)
  return JSON.parse(child.stdout)
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function verifyHash(value, expected, message) { assert(sha256(fs.readFileSync(resolveProjectPath(value))) === expected, message) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
