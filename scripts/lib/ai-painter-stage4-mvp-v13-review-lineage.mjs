import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

import { readCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs"

import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { auditMvp256DetailSufficiency } from "./ai-painter-mvp-detail-sufficiency-v1.mjs"

export const V13_CAPABILITY = "stage4_mvp_native_rgb_instance_object_renderer_v13"
const FROZEN_THRESHOLD = {
  path: "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
  sha256: "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df",
}
const FROZEN_DETAIL = {
  path: "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
  sha256: "3fc675218fbd290454fce4f178bdd9a0253754e96d407ec19cba993af044c3ee",
}
const AUDIT_PROGRAMS = [
  { path: "scripts/lib/ai-assisted-condition-alignment.mjs", sha256: "c01ea4efba9835e488e42c7ed44d2aef434ee3db21b06e84e70379722bcc145e" },
  { path: "scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs", sha256: "7e0332c4320f714383e0c3f6031e36db9972d6e19dedb8cfc0dd52b0069e016a" },
  { path: "scripts/lib/ai-assisted-style-fingerprint.mjs", sha256: "924f7db154c15c84df1b9e50b40dd57cc20c22d1b9b0ce72741bfd8835888d15" },
  { path: "scripts/lib/ai-painter-mvp-detail-sufficiency-v1.mjs", sha256: "453deeb345e308a03a174a73fbeaf1bf996f493754d5fd1acb5a4b93cde86aff" },
]
const FLOWING_WATER_LANDSCAPES = new Set([
  "wet-season-drainage-hollow", "river-floodplain",
  "riparian-tropical-forest", "dry-season-exposed-riverbank",
])

function inside(root, logical) {
  assert.equal(typeof logical, "string", "binding path missing")
  assert.ok(logical && !path.isAbsolute(logical) && !logical.includes("\\"), "binding path must be project-relative")
  assert.equal(logical.split("/").some((part) => !part || part === "." || part === ".." || part === "latest" || part === "latest.json"), false,
    "mutable selector or traversal is forbidden")
  const absolute = path.resolve(root, logical)
  const actual = fs.realpathSync(absolute)
  const allowedRoot = logical.startsWith(".runtime/")
    ? fs.realpathSync(path.join(root, ".runtime"))
    : fs.realpathSync(root)
  assert.ok(actual.startsWith(`${allowedRoot}${path.sep}`), "binding escapes declared storage root")
  assert.equal(fs.statSync(actual).isFile(), true, "bound artifact is not a file")
  return actual
}

export function readBound(root, binding) {
  assert.ok(binding && typeof binding === "object", "artifact binding missing")
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, "artifact SHA-256 invalid")
  const file = inside(root, binding.path)
  const bytes = fs.readFileSync(file)
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), binding.sha256,
    `artifact hash mismatch: ${binding.path}`)
  return bytes
}

function readJson(root, binding) {
  const value = JSON.parse(readBound(root, binding).toString("utf8"))
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "bound JSON must be an object")
  return value
}

function sameBinding(actual, expected, label) {
  assert.equal(actual?.path, expected?.path, `${label} path differs`)
  assert.equal(actual?.sha256, expected?.sha256, `${label} SHA-256 differs`)
}

export function validateHydrologyReviewSubject(pack) {
  const water = pack.channels?.find((channel) => channel.id === "terrain_water")
  assert.ok(water, "terrain_water condition channel missing")
  const count = water.statistics?.nonZeroCount
  assert.ok(Number.isInteger(count) && count >= 0,
    "terrain_water nonZeroCount is missing or invalid")
  if (count > 0) {
    assert.equal(typeof pack.reviewSubject?.rebuild64SequenceSeriesId, "string",
      "positive-water review lacks bound rebuild sequence identity")
    assert.equal(typeof pack.reviewSubject?.regionalLandscapeType, "string",
      "positive-water review lacks bound landscape classification")
  }
  const flowingWaterRequired = count > 0
    && pack.reviewSubject.rebuild64SequenceSeriesId === "thailand-rebuild64-20260731"
    && FLOWING_WATER_LANDSCAPES.has(pack.reviewSubject.regionalLandscapeType)
  if (flowingWaterRequired) {
    assert.equal(typeof pack.reviewSubject?.connectivityBlueprintPath, "string",
      "flowing-water review lacks bound connectivity blueprint path")
    assert.match(pack.reviewSubject.connectivityBlueprintSha256 ?? "", /^[a-f0-9]{64}$/u,
      "flowing-water review lacks bound connectivity blueprint SHA-256")
  }
  return { expectedWaterPresent: count > 0, hydrologySubjectBound: count > 0,
    flowingWaterRequired }
}

/**
 * Validate the complete 8-image review input against an already verified
 * current registry. This does not run a review or grant formal authority.
 */
export function validateStage0ReviewLineage({ projectRoot, candidateManifestBinding, currentRegistry, expectedCapability }) {
  const root = path.resolve(projectRoot)
  assert.ok(expectedCapability === V13_CAPABILITY
    || expectedCapability === "stage4_mvp_native_complete_rgb_local_texture_renderer_v12",
  "unsupported lineage comparison capability")
  assert.ok(currentRegistry && typeof currentRegistry === "object", "verified current registry is required")
  const manifest = readJson(root, candidateManifestBinding)
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1")
  assert.equal(manifest.status, "candidate_pack_materialized_review_pending")
  assert.equal(manifest.architectureId, expectedCapability)
  assert.deepEqual(manifest.stage, { stage: 0, width: 256, height: 192, epochCount: 24 })
  assert.equal(manifest.candidateSplit, "validation")
  assert.equal(manifest.candidateCount, 8)
  assert.equal(manifest.candidates?.length, 8)
  assert.equal(manifest.executionBoundary?.machineReviewExecuted, false)
  assert.equal(manifest.executionBoundary?.weightsModified, false)
  assert.equal(manifest.executionBoundary?.challengeRead, false)
  assert.equal(manifest.executionBoundary?.regressionRead, false)

  const execution = readJson(root, manifest.executionPackage)
  const terminal = readJson(root, manifest.trainingTerminal)
  assert.equal(execution.capabilityVersion, expectedCapability)
  assert.equal(execution.packageId, manifest.executionPackageIdentity)
  assert.equal(execution.runId, manifest.runId)
  assert.deepEqual(execution.stage, manifest.stage)
  assert.equal(execution.ticketConsumptionRequired, true)
  assert.deepEqual(execution.permittedSplits, ["train", "validation"])
  assert.deepEqual(execution.forbiddenSplits, ["challenge", "regression"])
  assert.ok(Array.isArray(execution.programBindings) && execution.programBindings.length > 0,
    "execution programs are not bound")
  for (const program of execution.programBindings) readBound(root, program)
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.capabilityVersion, expectedCapability)
  assert.equal(terminal.packageId, execution.packageId)
  assert.equal(terminal.runId, execution.runId)
  assert.equal(terminal.completedEpochs, 24)
  assert.equal(terminal.optimizerSteps, 1152)
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.challengeRead, false)
  assert.equal(terminal.regressionRead, false)
  assert.equal(terminal.machineReviewPending, true)
  sameBinding(terminal.executionPackage, manifest.executionPackage, "terminal execution package")
  sameBinding(terminal.checkpoint, manifest.checkpoint, "terminal checkpoint")
  readBound(root, manifest.checkpoint)
  assert.equal(terminal.modelStateSha256, manifest.modelStateSha256)
  assert.equal(terminal.selectedEpoch, manifest.selectedEpoch)
  assert.equal(terminal.selectedScore, manifest.selectedScore)
  sameBinding(execution.datasetManifest, manifest.datasetManifest, "execution dataset")
  sameBinding(terminal.datasetManifest, manifest.datasetManifest, "terminal dataset")

  assert.equal(currentRegistry.capabilityVersion, expectedCapability)
  assert.equal(currentRegistry.runId, manifest.runId)
  assert.equal(currentRegistry.packageId, execution.packageId)
  assert.equal(currentRegistry.activeExecution, null)
  assert.equal(currentRegistry.nextMachineAction, "run_stage0_machine_review")

  const dataset = readJson(root, manifest.datasetManifest)
  assert.equal(dataset.sampleCount, 64)
  assert.deepEqual(dataset.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(dataset.qualification?.dataQualifiedForTraining, true)
  const channelOrder = dataset.identityPayload?.channelOrder
  assert.equal(channelOrder?.length, 23)
  assert.equal(new Set(channelOrder).size, 23)
  const membership = readJson(root, dataset.splits.validation)
  const source = readJson(root, dataset.sourceIndex)
  assert.equal(membership.split, "validation")
  assert.equal(membership.sampleIds?.length, 8)
  assert.equal(new Set(membership.sampleIds).size, 8)
  const rows = new Map(source.samples.map((row) => [row.sampleId, row]))
  assert.equal(rows.size, 64)
  for (const [index, candidate] of manifest.candidates.entries()) {
    assert.equal(candidate.sampleIndex, index)
    assert.equal(candidate.sampleId, membership.sampleIds[index])
    assert.equal(candidate.split, "validation")
    assert.equal(candidate.candidateRgb.width, 256)
    assert.equal(candidate.candidateRgb.height, 192)
    assert.equal(candidate.candidateRgb.role, "complete_rgb_candidate")
    assert.ok(candidate.candidateRgb.path.startsWith(`${execution.outputRoot}/review-candidates/images/`),
      "candidate image is outside the bound execution output")
    readBound(root, candidate.candidateRgb)
    const row = rows.get(candidate.sampleId)
    assert.equal(row?.split, "validation")
    sameBinding(candidate.referenceRgb, row.image, "reference RGB")
    sameBinding(candidate.conditionPack, row.conditionPack, "condition pack")
    readBound(root, candidate.referenceRgb)
    const pack = readJson(root, candidate.conditionPack)
    assert.equal(pack.channels?.length, 23)
    assert.deepEqual(pack.channels.map((channel) => channel.id), channelOrder)
    validateHydrologyReviewSubject(pack)
    for (const channel of pack.channels) readBound(root, channel)
    assert.deepEqual(candidate.objectMasks.map((mask) => mask.role),
      ["object_footprints", "object_tree", "object_rock", "object_vegetation"])
    for (const mask of candidate.objectMasks) {
      const channel = pack.channels.find((item) => item.id === mask.role)
      sameBinding(mask, channel, `${mask.role} mask`)
      readBound(root, mask)
    }
    sameBinding(candidate.artifactIdentity?.candidateRgb, candidate.candidateRgb,
      "candidate artifact RGB")
    assert.equal(candidate.artifactIdentity?.modelStateSha256, terminal.modelStateSha256)
  }
  return { manifest, execution, terminal, dataset, validationSampleIds: membership.sampleIds }
}

export function validateV13ReviewLineage(args) {
  return validateStage0ReviewLineage({ ...args, expectedCapability: V13_CAPABILITY })
}

/** Diagnostic only: callers cannot supply a fabricated registry snapshot. */
export async function auditCurrentV13Review({ projectRoot, candidateManifestBinding }) {
  const before = await readCurrentExecutionRegistry(projectRoot)
  assert.equal(before.ok, true, `current execution registry is unverified: ${before.errorCode ?? "unknown"}`)
  const validated = validateV13ReviewLineage({
    projectRoot, candidateManifestBinding, currentRegistry: before.registry,
  })
  const diagnostic = await auditFrozenStage0Review({ projectRoot, validated })
  const after = await readCurrentExecutionRegistry(projectRoot)
  assert.equal(after.ok, true, `current execution registry changed or became unverified: ${after.errorCode ?? "unknown"}`)
  assert.equal(after.registrySha256, before.registrySha256,
    "current execution registry changed during V13 review diagnostic")
  return { ...diagnostic, registryRevision: before.registry.registryRevision,
    registrySha256: before.registrySha256 }
}

/** Candidate quality decision only; the inactive inherited thresholds cannot
 * authorize Stage4, Checkpoint promotion, or another training stage. */
export function deriveV13ReviewDiagnostic(validated, audit) {
  assert.equal(validated.manifest.architectureId, V13_CAPABILITY)
  assert.equal(audit.candidateCount, 8)
  assert.equal(audit.reviews?.length, 8)
  assert.deepEqual(audit.frozenThresholds, FROZEN_THRESHOLD)
  assert.deepEqual(audit.frozenMinimumDetail, FROZEN_DETAIL)
  assert.equal(audit.formalReviewDispatchable, false)
  assert.equal(audit.formalQualificationGranted, false)
  for (const [index, row] of audit.reviews.entries()) {
    assert.equal(row.sampleIndex, index)
    assert.equal(row.sampleId, validated.validationSampleIds[index])
    assert.equal(typeof row.semanticAndAestheticPassed, "boolean")
    assert.equal(typeof row.minimumDetailPassed, "boolean")
    assert.ok(Array.isArray(row.issueCodes))
  }
  const semanticPassCount = audit.reviews.filter((row) => row.semanticAndAestheticPassed).length
  const detailPassCount = audit.reviews.filter((row) => row.minimumDetailPassed).length
  assert.equal(semanticPassCount, audit.semanticAndAestheticPassCount)
  assert.equal(detailPassCount, audit.minimumDetailPassCount)
  return {
    candidateCount: 8, semanticPassCount, detailPassCount,
    allQualityChecksPassed: semanticPassCount === 8 && detailPassCount === 8,
    formalQualificationGranted: false,
    checkpointPromotionEligible: false,
    stage1InitializationEligible: false,
    blockedReason: "v13_formal_review_contract_and_runner_not_active",
  }
}

/** Recompute the existing semantic, aesthetic and minimum-detail diagnostics.
 * The V2 threshold file is used only as frozen numeric input. Its inactive
 * activation is never inherited, and this function cannot grant qualification.
 */
export async function auditFrozenStage0Review({ projectRoot, validated }) {
  const root = path.resolve(projectRoot)
  for (const program of AUDIT_PROGRAMS) readBound(root, program)
  const threshold = readJson(root, FROZEN_THRESHOLD)
  const detailContract = readJson(root, FROZEN_DETAIL)
  assert.equal(threshold.status, "cpu_supported_inactive")
  assert.equal(threshold.activation?.formalReviewExecutionAllowed, false)
  assert.equal(threshold.formalReviewBoundary?.dispatchable, false)
  assert.equal(detailContract.boundary?.mayGrantFormalStage4Qualification, false)
  readBound(root, threshold.styleFingerprint)
  const allowedCodes = new Set([
    ...threshold.failureCodes.waterAndPath,
    ...threshold.failureCodes.objects,
    ...threshold.failureCodes.hydrology,
  ])
  const runtimeMount = path.join(root, ".runtime", "ai-painter")
  assert.equal(fs.statSync(runtimeMount).isDirectory(), true)
  const scratch = fs.mkdtempSync(path.join(runtimeMount, "v13-review-diagnostic-"))
  const allowedScratchRoot = fs.realpathSync(runtimeMount)
  const actualScratch = fs.realpathSync(scratch)
  assert.ok(actualScratch.startsWith(`${allowedScratchRoot}${path.sep}`),
    "review scratch escaped the runtime mount")
  const reviews = []
  try {
    for (const candidate of validated.manifest.candidates) {
      readBound(root, candidate.candidateRgb)
      readBound(root, candidate.referenceRgb)
      readBound(root, candidate.conditionPack)
      const nativeCandidate = inside(root, candidate.candidateRgb.path)
      const nativeReference = inside(root, candidate.referenceRgb.path)
      const projected = path.join(scratch, `validation-${candidate.sampleIndex}-1024x768.png`)
      await sharp(readBound(root, candidate.candidateRgb), { failOn: "error" })
        .resize(1024, 768, { kernel: "nearest" })
        .png({ compressionLevel: 9, adaptiveFiltering: false })
        .toFile(projected)
      const normalizedSha256 = crypto.createHash("sha256")
        .update(fs.readFileSync(projected)).digest("hex")
      const pack = readJson(root, candidate.conditionPack)
      const hydrologyCoverage = validateHydrologyReviewSubject(pack)
      const subject = pack.reviewSubject ?? {}
      if (hydrologyCoverage.flowingWaterRequired) {
        readBound(root, {
          path: subject.connectivityBlueprintPath,
          sha256: subject.connectivityBlueprintSha256,
        })
      }
      const professional = await auditProfessionalAestheticFromFrozenContract({
        imagePath: projected,
        thresholdContract: threshold,
        styleFingerprintPath: inside(root, threshold.styleFingerprint.path),
        expectedStyleFingerprintSha256: threshold.styleFingerprint.sha256,
      })
      assert.equal(professional.candidate?.imageSha256, normalizedSha256,
        "professional audit used a different normalized candidate")
      const rawAlignment = await auditAiAssistedConditionAlignment({
        record: {
          recordId: `${validated.manifest.runId}-validation-${candidate.sampleIndex}`,
          conditionBinding: {
            conditionPackPath: candidate.conditionPack.path,
            worldId: pack.worldId,
            tick: pack.tick,
            connectivityBlueprintPath: subject.connectivityBlueprintPath ?? null,
          },
          rebuild64Sequence: subject.rebuild64SequenceSeriesId
            ? { seriesId: subject.rebuild64SequenceSeriesId } : undefined,
          classification: {
            regionalLandscapeType: subject.regionalLandscapeType ?? null,
            monsoonSeason: subject.monsoonSeason ?? pack.classification?.monsoonSeason ?? null,
          },
        },
        imagePath: projected,
        referenceImagePath: nativeReference,
      })
      const conditionIssues = (rawAlignment.issues ?? [])
        .filter((item) => allowedCodes.has(item.code))
      const detail = await auditMvp256DetailSufficiency({
        candidatePath: nativeCandidate,
        referencePath: nativeReference,
        contract: detailContract,
      })
      readBound(root, candidate.candidateRgb)
      readBound(root, candidate.referenceRgb)
      readBound(root, candidate.conditionPack)
      for (const channel of pack.channels) readBound(root, channel)
      if (hydrologyCoverage.flowingWaterRequired) {
        readBound(root, {
          path: subject.connectivityBlueprintPath,
          sha256: subject.connectivityBlueprintSha256,
        })
      }
      reviews.push({
        sampleIndex: candidate.sampleIndex,
        sampleId: candidate.sampleId,
        candidateRgb: candidate.candidateRgb,
        referenceRgb: candidate.referenceRgb,
        conditionPack: candidate.conditionPack,
        hydrologyCoverage,
        normalizedCandidate: {
          sha256: normalizedSha256, width: 1024, height: 768,
          sourceWidth: 256, sourceHeight: 192,
          resizeKernel: "nearest", pngCompressionLevel: 9,
          pngAdaptiveFiltering: false,
        },
        semanticAndAestheticPassed: professional.passed === true && conditionIssues.length === 0,
        minimumDetailPassed: detail.passed === true,
        professionalAesthetic: professional,
        conditionAlignment: {
          ...rawAlignment,
          issues: conditionIssues,
          passed: conditionIssues.length === 0,
        },
        minimumDetail: detail,
        issueCodes: [...new Set([
          ...(professional.issues ?? []).map((item) => item.code),
          ...conditionIssues.map((item) => item.code),
          ...detail.issueCodes,
        ])].sort(),
        detailRatios: detail.ratios,
      })
    }
  } finally {
    assert.ok(actualScratch.startsWith(`${allowedScratchRoot}${path.sep}`),
      "review scratch cleanup escaped the runtime mount")
    fs.rmSync(scratch, { recursive: true, force: true })
  }
  return {
    candidateCount: reviews.length,
    semanticAndAestheticPassCount: reviews.filter((row) => row.semanticAndAestheticPassed).length,
    minimumDetailPassCount: reviews.filter((row) => row.minimumDetailPassed).length,
    reviews,
    frozenThresholds: FROZEN_THRESHOLD,
    frozenMinimumDetail: FROZEN_DETAIL,
    formalReviewDispatchable: false,
    formalQualificationGranted: false,
  }
}
