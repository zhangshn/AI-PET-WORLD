// One independent, fail-closed audit of the immutable V18 dry-world candidate.
// Numerical checks cannot grant formal Stage0, Stage4 or runtime publication.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditProfessionalAestheticFromFrozenContract } from
  "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { decodeV17ResponsibilityArtifact } from
  "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"

const ROOT = process.cwd()
const PROGRAM = "scripts/run-ai-painter-stage4-mvp-v18-dry-independent-audit.mjs"
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const stripTrainingHints = value => Array.isArray(value)
  ? value.map(stripTrainingHints)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["nextTrainingTarget", "trainingTarget", "lossTarget"].includes(key))
      .map(([key, child]) => [key, stripTrainingHints(child)]))
    : value
function inside(logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest" && part !== "latest.json"))
  const absolute = path.resolve(ROOT, logical)
  assert.ok(absolute.startsWith(`${ROOT}${path.sep}`), "path escaped project")
  return absolute
}
function bound(binding) {
  assert.ok(binding && typeof binding.path === "string"
    && /^[a-f0-9]{64}$/u.test(binding.sha256), "invalid binding")
  const bytes = fs.readFileSync(inside(binding.path))
  assert.equal(sha(bytes), binding.sha256, `SHA mismatch: ${binding.path}`)
  return bytes
}
const json = binding => JSON.parse(bound(binding).toString("utf8"))
const binding = logical => ({ path: logical, sha256: sha(fs.readFileSync(inside(logical))) })

export function validateMaterializationHeader(materialized) {
  assert.equal(materialized?.schemaVersion,
    "ai-painter-stage4-mvp-structured-object-v18-dry-review-materialization-v1")
  assert.equal(materialized.status, "dry_review_materialized_pending_independent_audit")
  assert.equal(materialized.capabilityVersion,
    "stage4_mvp_native_rgb_structured_object_v18")
  assert.equal(materialized.candidateCount, 1)
  assert.equal(materialized.device, "cuda")
  assert.equal(materialized.precision, "bfloat16")
  assert.equal(materialized.weightsUnmodifiedVerified, true)
  assert.equal(materialized.visualQualityGranted, false)
  assert.equal(materialized.stage4ProgressIncreaseGranted, false)
  assert.equal(materialized.waterAndShorelinePositiveCapability, "unverified_not_passed")
  assert.equal(materialized.candidate?.sampleId,
    "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
  assert.equal(materialized.candidate.split, "validation")
  assert.equal(materialized.candidate.sampleIndex, 0)
  assert.equal(materialized.candidate.artifactIdentity?.inferenceMode,
    "bound_v18_bfloat16_generator_only_to_complete_rgb")
  assert.ok(Number.isInteger(materialized.selectedEpoch)
    && materialized.selectedEpoch >= 8 && materialized.selectedEpoch <= 24)
  assert.equal(materialized.selectionAudit?.epochSummaries?.length, 24)
  assert.deepEqual(materialized.selectionAudit.selectedRank,
    materialized.selectedRank)
}

export function decideNumericAuditStatus(detail, aesthetic, alignment) {
  for (const verdict of [detail, aesthetic, alignment])
    assert.equal(typeof verdict?.passed, "boolean", "missing independent verdict")
  return detail.passed && aesthetic.passed && alignment.passed
    ? "dry_single_world_numeric_audit_passed_visual_approval_pending"
    : "dry_single_world_visual_slice_failed_closed"
}

export async function audit({ reportBinding, outputPath }) {
  assert.equal(outputPath,
    `${path.posix.dirname(reportBinding.path)}/independent-audit.json`,
    "audit output must remain beside the immutable materialization")
  const materialized = json(reportBinding)
  validateMaterializationHeader(materialized)
  assert.equal(materialized.schemaVersion,
    "ai-painter-stage4-mvp-structured-object-v18-dry-review-materialization-v1")
  assert.equal(materialized.status, "dry_review_materialized_pending_independent_audit")
  assert.equal(materialized.candidateCount, 1)
  assert.equal(materialized.device, "cuda")
  assert.equal(materialized.precision, "bfloat16")
  assert.equal(materialized.weightsUnmodifiedVerified, true)
  assert.equal(materialized.visualQualityGranted, false)
  assert.equal(materialized.stage4ProgressIncreaseGranted, false)
  assert.equal(materialized.modelStateSha256Before,
    materialized.modelStateSha256After, "inference changed model state")
  assert.equal(materialized.candidate.sampleId,
    "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
  assert.equal(materialized.candidate.split, "validation")
  assert.equal(materialized.candidate.sampleIndex, 0)
  assert.deepEqual([materialized.candidate.candidateRgb.width,
    materialized.candidate.candidateRgb.height], [256, 192])

  for (const key of ["executionPackage", "workerTerminal", "trainingTerminal",
    "checkpoint", "program", "tests", "codec", "responsibilityInterface", "dryScope"])
    bound(materialized[key])
  const packageValue = json(materialized.executionPackage)
  const worker = json(materialized.workerTerminal)
  const training = json(materialized.trainingTerminal)
  assert.equal(packageValue.capabilityVersion,
    "stage4_mvp_native_rgb_structured_object_v18")
  assert.equal(materialized.program.path,
    "ml/ai-painter/scripts/materialize_stage4_mvp_structured_object_v18_dry_review.py")
  assert.equal(materialized.tests.path,
    "ml/ai-painter/tests/test_materialize_stage4_mvp_structured_object_v18_dry_review.py")
  assert.equal(worker.status, "training_completed_review_pending")
  assert.equal(worker.checkpointReloadVerified, true)
  assert.equal(worker.optimizerStepsGenerator, 1152)
  assert.equal(worker.optimizerStepsDiscriminator, 1152)
  assert.equal(training.status, "training_completed_review_pending")
  assert.deepEqual(training.checkpoint, worker.checkpoint)
  assert.deepEqual(worker.checkpoint, materialized.checkpoint)
  assert.equal(worker.runId, packageValue.runId)
  assert.equal(training.runId, packageValue.runId)
  assert.equal(materialized.runId, packageValue.runId)
  assert.deepEqual(materialized.selectionAudit.selectedRank, worker.selectedRank)
  assert.equal(materialized.selectionAudit.selectedEpoch, worker.selectedEpoch)
  assert.equal(materialized.selectionAudit.rule,
    "max_worst_applicable_object_correlation_then_min_mean_validation_objective_then_earliest_epoch")
  assert.equal(materialized.selectionAudit.epochSummaries.length, 24)
  for (const summary of materialized.selectionAudit.epochSummaries) bound(summary)

  const candidate = json(packageValue.candidateContract)
  const thresholdBinding = candidate.reviewThresholdContract.numericThresholds
  const detailBinding = candidate.reviewThresholdContract.minimumDetail
  const thresholds = json(thresholdBinding)
  const detailContract = json(detailBinding)
  assert.equal(binding(thresholds.implementationProvenance.conditionAlignment.path).sha256,
    thresholds.implementationProvenance.conditionAlignment.sha256)
  bound(thresholds.styleFingerprint)
  for (const value of Object.values(materialized.artifacts)) bound(value)
  const image = materialized.candidate.candidateRgb
  assert.equal(binding(image.path).sha256, image.sha256)
  assert.deepEqual(materialized.candidate.referenceRgb,
    materialized.sampleIdentity.image)
  assert.equal(materialized.artifacts["original-native.png"].sha256,
    materialized.sampleIdentity.image.sha256)
  assert.deepEqual(materialized.candidate.conditionPack,
    materialized.sampleIdentity.conditionPack)
  bound(materialized.candidate.referenceRgb)
  const pack = json(materialized.candidate.conditionPack)
  assert.equal(pack.worldId, materialized.sampleIdentity.worldId)
  assert.equal(pack.tick, materialized.sampleIdentity.tick)
  assert.deepEqual([pack.canvas.width, pack.canvas.height], [1024, 768])

  const archive = materialized.candidate.responsibilityEvidence.tensorArchive
  assert.deepEqual(archive, materialized.artifacts["responsibilities.f32.zlib"])
  const expectedIdentity = {
    worldId: materialized.sampleIdentity.worldId,
    regionId: materialized.scopePreflight.regionId,
    tick: materialized.sampleIdentity.tick,
    factHash: materialized.sampleIdentity.factHash,
    visualFactManifestSha256: materialized.sampleIdentity.visualFactManifestContentSha256,
    conditionPackSha256: materialized.sampleIdentity.conditionPack.sha256,
    modelStateSha256: materialized.modelStateSha256Before,
  }
  const decoded = decodeV17ResponsibilityArtifact({
    archiveBytes: bound(archive),
    evidence: materialized.candidate.responsibilityEvidence,
    expectedIdentity,
    schemaBytes: bound(materialized.responsibilityInterface),
    schemaSha256: materialized.responsibilityInterface.sha256,
    candidatePackSchemaVersion: json(materialized.responsibilityInterface).candidatePackSchemaVersion,
  })
  assert.equal(decoded.roleOrder.length, 7)

  const generated = inside(image.path)
  const reference256 = inside(materialized.artifacts["reference-256.png"].path)
  const original = inside(materialized.artifacts["original-native.png"].path)
  const projectionPath = `${path.posix.dirname(reportBinding.path)}/condition-audit-input-1024.png`
  const projectionBytes = await sharp(generated)
    .resize(1024, 768, { kernel: "nearest" })
    .png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer()
  if (!fs.existsSync(inside(projectionPath)))
    fs.writeFileSync(inside(projectionPath), projectionBytes, { flag: "wx" })
  assert.equal(sha(fs.readFileSync(inside(projectionPath))), sha(projectionBytes),
    "condition-audit projection differs from exact nearest projection")
  const manifest = json(packageValue.datasetManifest)
  assert.deepEqual(materialized.selectionAudit.validationSampleIds,
    json(manifest.splits.validation).sampleIds)
  const source = json(manifest.sourceIndex)
  const row = source.samples.find(item => item.sampleId === materialized.candidate.sampleId)
  assert.ok(row && row.split === "validation")
  const record = {
    recordId: `${packageValue.runId}-dry-slot-189-independent`,
    conditionBinding: { conditionPackPath: materialized.candidate.conditionPack.path,
      worldId: materialized.sampleIdentity.worldId, tick: materialized.sampleIdentity.tick },
    classification: { monsoonSeason: row.monsoonSeason, regionalLandscapeType: null },
  }
  const [detail, aesthetic, alignment] = await Promise.all([
    auditMvp256DetailSufficiency({ candidatePath: generated,
      referencePath: reference256, contract: detailContract }),
    auditProfessionalAestheticFromFrozenContract({ imagePath: generated,
      thresholdContract: thresholds, styleFingerprintPath: inside(thresholds.styleFingerprint.path),
      expectedStyleFingerprintSha256: thresholds.styleFingerprint.sha256 }),
    auditAiAssistedConditionAlignment({ record,
      imagePath: inside(projectionPath), referenceImagePath: original }),
  ])
  for (const item of [reportBinding, materialized.candidate.candidateRgb,
    materialized.candidate.referenceRgb, materialized.candidate.conditionPack,
    materialized.checkpoint, archive, thresholdBinding, detailBinding]) bound(item)
  const result = {
    schemaVersion: "ai-painter-stage4-mvp-v18-dry-independent-audit-v1",
    status: decideNumericAuditStatus(detail, aesthetic, alignment),
    runId: packageValue.runId, sampleId: materialized.candidate.sampleId,
    reviewProgram: binding(PROGRAM), materialization: reportBinding, candidateRgb: image,
    projection: binding(projectionPath), thresholdContract: thresholdBinding,
    minimumDetailContract: detailBinding,
    responsibilityArchive: archive, responsibilityRoleCount: decoded.roleOrder.length,
    selectedEpoch: worker.selectedEpoch, selectedRank: worker.selectedRank,
    detail, aesthetic, alignment: stripTrainingHints(alignment),
    issueCodes: [
      ...detail.issueCodes,
      ...aesthetic.issues.map(item => item.code),
      ...alignment.issues.map(item => item.code),
    ],
    formalStage0QualificationGranted: false, stage4ProgressIncreaseGranted: false,
    runtimePublicationGranted: false, visualQualityGranted: false,
    waterAndShorelinePositiveCapability: "unverified_not_passed",
    recordedAtUtc: new Date().toISOString(),
  }
  const target = inside(outputPath)
  assert.equal(fs.existsSync(target), false, "audit output already exists")
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" })
  return { status: result.status, issueCodes: result.issueCodes,
    detailPassed: detail.passed, aestheticPassed: aesthetic.passed,
    alignmentPassed: alignment.passed, output: binding(outputPath) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  assert.equal(process.argv.length, 5,
    "usage: node script REPORT_RELATIVE_PATH REPORT_SHA256 OUTPUT_RELATIVE_PATH")
  const reportBinding = { path: process.argv[2], sha256: process.argv[3] }
  const outputPath = process.argv[4]
  let result
  try {
    result = await audit({ reportBinding, outputPath })
  } catch (error) {
    const target = inside(outputPath)
    assert.equal(fs.existsSync(target), false, "existing audit evidence cannot be replaced")
    fs.writeFileSync(target, `${JSON.stringify({
      schemaVersion: "ai-painter-stage4-mvp-v18-dry-independent-audit-v1",
      status: "failed_closed", materialization: reportBinding,
      errorType: error?.name ?? "Error", error: String(error?.message ?? error),
      formalStage0QualificationGranted: false, stage4ProgressIncreaseGranted: false,
      runtimePublicationGranted: false, visualQualityGranted: false,
      waterAndShorelinePositiveCapability: "unverified_not_passed",
      recordedAtUtc: new Date().toISOString(),
    }, null, 2)}\n`, { flag: "wx" })
    result = { status: "failed_closed", output: binding(outputPath) }
    process.exitCode = 1
  }
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
