import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { formatShanghai } from "./ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
export const WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX = 240

export function buildWindowsSafeReviewPaths({ workRoot, workId, epoch }) {
  assert(typeof workId === "string" && /^[a-z0-9-]{1,48}$/i.test(workId), "review_work_id_invalid")
  assert(Number.isInteger(epoch) && epoch > 0 && epoch < 1000, "review_epoch_invalid")
  const resolvedWorkRoot = path.resolve(workRoot)
  const workDirectory = path.resolve(resolvedWorkRoot, workId)
  assert(isWithin(resolvedWorkRoot, workDirectory), "review_work_path_escape")
  const suffix = String(epoch).padStart(3, "0")
  const inputPath = path.join(workDirectory, `i${suffix}.png`)
  const outputPath = path.join(workDirectory, `o${suffix}.png`)
  assert(inputPath.length <= WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX, "review_short_input_path_too_long")
  assert(outputPath.length <= WINDOWS_SAFE_REVIEW_NATIVE_PATH_MAX, "review_short_output_path_too_long")
  return { workDirectory, inputPath, outputPath }
}

export async function normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath, workRoot, workId, epoch }) {
  const resolvedSourcePath = path.resolve(sourcePath)
  const resolvedFinalAssetPath = path.resolve(finalAssetPath)
  assert(fs.existsSync(resolvedSourcePath), `review_source_missing_epoch_${epoch}`)
  const paths = buildWindowsSafeReviewPaths({ workRoot, workId, epoch })
  fs.mkdirSync(paths.workDirectory, { recursive: true })
  fs.mkdirSync(path.dirname(resolvedFinalAssetPath), { recursive: true })
  fs.copyFileSync(resolvedSourcePath, paths.inputPath, fs.constants.COPYFILE_EXCL)
  assert(sha256File(paths.inputPath) === sha256File(resolvedSourcePath), `review_input_copy_hash_mismatch_epoch_${epoch}`)
  await sharp(paths.inputPath)
    .removeAlpha()
    .resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest })
    .png()
    .toFile(paths.outputPath)
  assert(fs.existsSync(paths.outputPath), `review_short_output_missing_epoch_${epoch}`)
  fs.copyFileSync(paths.outputPath, resolvedFinalAssetPath, fs.constants.COPYFILE_EXCL)
  assert(sha256File(resolvedFinalAssetPath) === sha256File(paths.outputPath), `review_output_copy_hash_mismatch_epoch_${epoch}`)
  return {
    shortInputPath: paths.inputPath,
    shortOutputPath: paths.outputPath,
    finalAssetPath: resolvedFinalAssetPath,
    sourceSha256: sha256File(resolvedSourcePath),
    normalizedSha256: sha256File(paths.outputPath),
  }
}

export async function reviewAiAssistedV7R5Stage3Previews({
  runId,
  previewRoot,
  finalAssetRoot,
  reportPath,
  workRoot,
  workId,
  overfitRow,
  requiredPreviewEpochs,
  requiredTailEpochs,
}) {
  const files = fs.existsSync(previewRoot)
    ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort()
    : []
  const requiredEpochSet = new Set(requiredPreviewEpochs)
  const selected = files
    .map((fileName) => ({ fileName, epoch: Number(fileName.match(/^epoch-(\d+)/)?.[1] ?? 0) }))
    .filter((row) => requiredEpochSet.has(row.epoch))
  const reviews = []
  const conditionPack = readJson(overfitRow.conditionPackPath)
  for (const { fileName, epoch } of selected) {
    const previewPath = path.join(previewRoot, fileName)
    const normalizedPath = path.join(finalAssetRoot, `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath: previewPath,
      finalAssetPath: normalizedPath,
      workRoot,
      workId,
      epoch,
    })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `${runId}-${path.parse(fileName).name}`,
          conditionBinding: {
            conditionPackPath: overfitRow.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: overfitRow.classification,
        },
        imagePath: normalized.shortOutputPath,
        referenceImagePath: overfitRow.imagePath,
      }),
    ])
    reviews.push({
      epoch,
      recordedAtUtc: new Date().toISOString(),
      recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      previewPath: projectPath(previewPath),
      previewSha256: normalized.sourceSha256,
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: normalized.normalizedSha256,
      nativeReviewInputPathLength: normalized.shortInputPath.length,
      nativeReviewOutputPathLength: normalized.shortOutputPath.length,
      windowsSafeShortPathIo: true,
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  reviews.sort((left, right) => left.epoch - right.epoch)
  const tailStabilityGate = evaluateR5Stage3TailStability(reviews, requiredTailEpochs)
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage3-preview-hard-gate-review-v1",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    status: reviews.length === requiredPreviewEpochs.length && reviews.every((review) => review.passed) && tailStabilityGate.passed ? "passed" : "failed",
    stage: 0,
    reviewCount: reviews.length,
    passCount: reviews.filter((review) => review.passed).length,
    failCount: reviews.filter((review) => !review.passed).length,
    requiredPreviewEpochs,
    tailStabilityGate,
    reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
    windowsSafeShortPathIo: true,
    reviews,
    nextStageStarted: false,
  }
  writeImmutableJson(reportPath, report)
  return { report, reviews }
}

export function evaluateR5Stage3TailStability(reviews, requiredTailEpochs) {
  const byEpoch = new Map(reviews.map((row) => [row.epoch, row]))
  const evaluated = requiredTailEpochs.map((epoch) => {
    const row = byEpoch.get(epoch)
    const issueCodes = row?.issueCodes ?? []
    return {
      epoch,
      recorded: Boolean(row),
      passed: Boolean(row?.passed && issueCodes.length === 0),
      pathIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")),
      objectIssueFree: !issueCodes.some((code) => code.startsWith("condition_object_")),
      issueCodes,
    }
  })
  const passed = evaluated.length === requiredTailEpochs.length
    && evaluated.every((row) => row.recorded && row.passed && row.pathIssueFree && row.objectIssueFree)
  return {
    status: passed ? "r5_stage3_tail_stability_gate_passed" : "r5_stage3_tail_stability_gate_failed_closed",
    passed,
    requiredConsecutiveTailPasses: requiredTailEpochs.length,
    evaluated,
  }
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`)
}
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
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
function assert(condition, message) { if (!condition) throw new Error(message) }
