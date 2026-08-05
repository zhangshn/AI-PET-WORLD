import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX,
  buildWindowsSafeReviewPaths,
  normalizePreviewWithWindowsSafeIo,
} from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"

const ROOT = process.cwd()
const SOURCE_PREVIEW = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-coverage-convergence/ai-assisted-v7-r5-stage3-coverage-convergence-checkpoint-continuation-overfit-smoke-2026-08-05T08-37-03-827Z/fixed-epoch-previews/epoch-001-v7-complete-map-146-seed-20263722.png")
const EXPECTED_SOURCE_SHA256 = "c4077e5fdb21b78a75b887cfb665118f10b6654acbc407ab1155515753bb40f6"
const REPORT_ROOT = resolve(".runtime/ai-painter/v7-r5-stage3-preview-review-short-path-cpu-regressions/20260805-172000000")
const REPORT_PATH = path.join(REPORT_ROOT, "report.json")
const WORK_ROOT = resolve(".runtime/ai-painter/r5s3-review-cpu-work")
const WORK_ID = "cpu-20260805"
const LONG_FINAL_ASSET = path.join(REPORT_ROOT, "long-final-evidence", "x".repeat(96), "y".repeat(96), "e001.png")

const positive = {}
const negative = {}
const failures = []
const pass = (group, name, condition) => {
  group[name] = Boolean(condition)
  if (!condition) failures.push(name)
}

const paths = buildWindowsSafeReviewPaths({ workRoot: WORK_ROOT, workId: WORK_ID, epoch: 1 })
pass(positive, "shortInputPathWithinNativeLimit", paths.inputPath.length <= WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX)
pass(positive, "shortOutputPathWithinNativeLimit", paths.outputPath.length <= WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX)
pass(positive, "shortInputAndOutputAreDistinct", paths.inputPath !== paths.outputPath)
pass(positive, "sourcePreviewIdentityBound", sha256File(SOURCE_PREVIEW) === EXPECTED_SOURCE_SHA256)
pass(positive, "officialEvidencePathExceedsLegacyWindowsLimit", LONG_FINAL_ASSET.length > 260)

const normalized = await normalizePreviewWithWindowsSafeIo({
  sourcePath: SOURCE_PREVIEW,
  finalAssetPath: LONG_FINAL_ASSET,
  workRoot: WORK_ROOT,
  workId: WORK_ID,
  epoch: 1,
})
const metadata = await sharp(normalized.shortOutputPath).metadata()
pass(positive, "shortInputCopyHashPreserved", sha256File(normalized.shortInputPath) === EXPECTED_SOURCE_SHA256)
pass(positive, "shortOutputCreated", fs.existsSync(normalized.shortOutputPath))
pass(positive, "normalizedDimensionsPreserved", metadata.width === 1024 && metadata.height === 768)
pass(positive, "longOfficialEvidenceCopyCreated", fs.existsSync(LONG_FINAL_ASSET))
pass(positive, "longOfficialEvidenceHashPreserved", sha256File(LONG_FINAL_ASSET) === sha256File(normalized.shortOutputPath))

await expectThrow("pathTraversalWorkIdRejected", () => buildWindowsSafeReviewPaths({ workRoot: WORK_ROOT, workId: "../escape", epoch: 1 }))
await expectThrow("overlongWorkIdRejected", () => buildWindowsSafeReviewPaths({ workRoot: WORK_ROOT, workId: "z".repeat(49), epoch: 1 }))
await expectThrow("zeroEpochRejected", () => buildWindowsSafeReviewPaths({ workRoot: WORK_ROOT, workId: "valid", epoch: 0 }))
await expectThrow("fractionalEpochRejected", () => buildWindowsSafeReviewPaths({ workRoot: WORK_ROOT, workId: "valid", epoch: 1.5 }))
await expectThrow("overlongNativeWorkRootRejected", () => buildWindowsSafeReviewPaths({ workRoot: path.join(ROOT, "q".repeat(220)), workId: "valid", epoch: 1 }))
await expectThrow("missingSourceRejected", () => normalizePreviewWithWindowsSafeIo({ sourcePath: path.join(REPORT_ROOT, "missing.png"), finalAssetPath: path.join(REPORT_ROOT, "missing-output.png"), workRoot: WORK_ROOT, workId: "missing", epoch: 2 }))
await expectThrow("duplicateExecutionOutputRejected", () => normalizePreviewWithWindowsSafeIo({ sourcePath: SOURCE_PREVIEW, finalAssetPath: LONG_FINAL_ASSET, workRoot: WORK_ROOT, workId: WORK_ID, epoch: 1 }))

const runnerSource = fs.readFileSync(resolve("scripts/run-ai-assisted-v7-r5-stage3-internal-overfit-smoke.mjs"), "utf8")
pass(positive, "legacyRunnerUsesSharedSafeReviewer", runnerSource.includes("reviewAiAssistedV7R5Stage3Previews") && !runnerSource.includes(".toFile(normalizedPath)"))

const report = {
  schemaVersion: "ai-assisted-v7-r5-stage3-preview-review-short-path-cpu-regression-v1",
  status: failures.length === 0 ? "passed_cpu_only_windows_safe_preview_review_io" : "failed_cpu_only_windows_safe_preview_review_io",
  device: "cpu",
  createdAtUtc: new Date().toISOString(),
  inputs: {
    authorizationPath: ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-offline-preview-review-recovery-20260805/request.json",
    authorizationSha256: "604838bc2e6a3f6fcfb2f6fce9ea071a3622d6d5f1c24ee0bd720cde5d3e40fa",
    authorizationConsumptionPath: ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r5-stage3-coverage-convergence-offline-preview-review-recovery-20260805/authorization-consumption.json",
    authorizationConsumptionSha256: "5755b5542aae57d8479fa0d17f2d43142f24e1e2875e69a067622a75b18816ff",
    reviewerPath: "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs",
    reviewerSha256: sha256File("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
    legacyRunnerPath: "scripts/run-ai-assisted-v7-r5-stage3-internal-overfit-smoke.mjs",
    legacyRunnerSha256: sha256File("scripts/run-ai-assisted-v7-r5-stage3-internal-overfit-smoke.mjs"),
    offlineReviewRunnerPath: "scripts/review-ai-assisted-v7-r5-stage3-coverage-convergence-existing-previews.mjs",
    offlineReviewRunnerSha256: sha256File("scripts/review-ai-assisted-v7-r5-stage3-coverage-convergence-existing-previews.mjs"),
  },
  sourcePreviewPath: projectPath(SOURCE_PREVIEW),
  sourcePreviewSha256: EXPECTED_SOURCE_SHA256,
  nativePathLimit: WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX,
  measuredPaths: {
    shortInputPathLength: paths.inputPath.length,
    shortOutputPathLength: paths.outputPath.length,
    officialEvidencePathLength: LONG_FINAL_ASSET.length,
  },
  positiveRegression: positive,
  negativeRegression: negative,
  positiveAssertionsPassed: Object.values(positive).filter(Boolean).length,
  negativeAssertionsPassed: Object.values(negative).filter(Boolean).length,
  failures,
  executionBoundary: {
    checkpointFileRead: false,
    checkpointDeserialized: false,
    checkpointLoaded: false,
    optimizerCreated: false,
    modelWeightsModified: false,
    gpuTrainingStarted: false,
    automaticRetryStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointPromoted: false,
    runtimeFrameStarted: false,
    worldEntered: false,
  },
}
writeImmutableJson(REPORT_PATH, report)
console.log(JSON.stringify({ ...report, reportPath: projectPath(REPORT_PATH), reportSha256: sha256File(REPORT_PATH) }, null, 2))
if (failures.length > 0) process.exitCode = 1

async function expectThrow(name, action) {
  try {
    await action()
    negative[name] = false
    failures.push(name)
  } catch {
    negative[name] = true
  }
}
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function writeImmutableJson(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const handle = fs.openSync(value, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
