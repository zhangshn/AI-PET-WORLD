import assert from "node:assert/strict"
import path from "node:path"
import sharp from "sharp"

import {
  auditFrozenStage0Review,
  readBound,
  validateHydrologyReviewSubject,
} from "./ai-painter-stage4-mvp-v13-review-lineage.mjs"

export const V15_CAPABILITY = "stage4_mvp_native_rgb_conditional_texture_v15"
export const V15_CANDIDATE_CONTRACT_PATH =
  "data/ai-painter/system-governance/stage4-mvp-native-rgb-conditional-texture-v15-contract.json"
export const V15_REVIEW_CONTRACT_PATH =
  "data/ai-painter/system-governance/stage4-mvp-v15-stage0-review-contract-v1.json"
export const FROZEN_THRESHOLD = Object.freeze({
  path: "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
  sha256: "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df",
})
export const FROZEN_DETAIL = Object.freeze({
  path: "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
  sha256: "3fc675218fbd290454fce4f178bdd9a0253754e96d407ec19cba993af044c3ee",
})
export const SHORELINE_GATE = Object.freeze({
  channelId: "terrain_shoreline", independentGate: true,
  metricId: "shoreline_masked_rgb_mae_1024_nearest_v1",
  maximumMaskedRgbMae: { comparator: "<=", value: 0.18, unit: "normalized_rgb_mae" },
  thresholdSource: {
    binding: FROZEN_THRESHOLD,
    jsonPointer: "/conditionAlignmentThresholds/referenceSemantics/channels/object_footprints/maximumMaskedRgbMae",
    adoption: "new_additive_shoreline_gate_not_v2_shoreline_authority",
  },
  maskRule: "terrain_shoreline_uint8_positive_at_1024x768",
  candidateNormalization: "256x192_to_1024x768_nearest",
  referenceResolution: [1024, 768],
  emptyMask: "not_applicable_require_at_least_one_positive_validation_sample",
  failureCode: "condition_terrain_shoreline_reference_rgb_mismatch",
  status: "active_for_v15_stage0_machine_review",
})

function sameBinding(actual, expected, label) {
  assert.equal(actual?.path, expected?.path, `${label} path differs`)
  assert.equal(actual?.sha256, expected?.sha256, `${label} SHA-256 differs`)
}

function boundJson(root, binding) {
  const value = JSON.parse(readBound(root, binding).toString("utf8"))
  assert.ok(value && typeof value === "object" && !Array.isArray(value))
  return value
}

export function validateV15CandidateContract(candidate, formalContractBinding = null) {
  assert.equal(candidate.schemaVersion, "stage4-mvp-native-rgb-conditional-texture-v15-contract-v1")
  assert.equal(candidate.capabilityVersion, V15_CAPABILITY)
  assert.equal(candidate.reviewBinding?.thresholdLoweringAllowed, false)
  assert.equal(candidate.reviewBinding?.alignmentQualified, true)
  assert.equal(candidate.reviewBinding?.formalReviewDispatchable, false)
  assert.equal(candidate.reviewBinding?.formalContract?.path, V15_REVIEW_CONTRACT_PATH)
  assert.match(candidate.reviewBinding?.formalContract?.sha256 ?? "", /^[a-f0-9]{64}$/u)
  if (formalContractBinding) sameBinding(candidate.reviewBinding.formalContract,
    formalContractBinding, "V15 formal review contract")
  sameBinding(candidate.reviewBinding?.thresholds, FROZEN_THRESHOLD, "candidate thresholds")
  sameBinding(candidate.reviewBinding?.minimumDetail, FROZEN_DETAIL, "candidate detail")
  const expected = [
    ["road", "terrain_path_ground"], ["hydrology", "terrain_water"],
    ["shoreline", "terrain_shoreline"], ["footprints", "object_footprints"],
    ["tree", "object_tree"], ["rock", "object_rock"],
    ["vegetation", "object_vegetation"],
  ]
  const rows = candidate.trainingReviewAlignment
  assert.ok(Array.isArray(rows) && rows.length === expected.length,
    "V15 seven-role trainingReviewAlignment missing")
  const channels = new Map(expected)
  assert.deepEqual(new Set(rows.map((row) => row.responsibilityId)),
    new Set(channels.keys()), "V15 seven-role responsibility identity differs")
  for (const row of rows) {
    assert.ok(row.conditionChannelIds?.includes(channels.get(row.responsibilityId)),
      `missing condition for ${row.responsibilityId}`)
    assert.ok(Array.isArray(row.objectiveTermIds) && row.objectiveTermIds.length > 0)
    assert.match(row.formulaSha256 ?? "", /^[a-f0-9]{64}$/u)
    assert.ok(row.responsibilityOutputIdentity)
    assert.ok(row.formalReviewContractIdentity)
    assert.match(row.formalReviewContractSha256 ?? "", /^[a-f0-9]{64}$/u)
    if (formalContractBinding) {
      assert.equal(row.formalReviewContractIdentity,
        "stage4-mvp-v15-stage0-review-contract-v1")
      assert.equal(row.formalReviewContractSha256, formalContractBinding.sha256)
    }
    assert.ok(Array.isArray(row.reviewMetricIds) && row.reviewMetricIds.length > 0)
    assert.ok(Array.isArray(row.failureCodes) && row.failureCodes.length > 0)
    assert.ok(Array.isArray(row.positiveAlignmentTests) && row.positiveAlignmentTests.length > 0)
    assert.ok(Array.isArray(row.negativeAlignmentTests) && row.negativeAlignmentTests.length > 0)
    if (row.responsibilityId === "shoreline") {
      assert.ok(row.reviewMetricIds.includes(SHORELINE_GATE.metricId),
        "shoreline direct review metric is not aligned")
      assert.ok(row.failureCodes.includes(SHORELINE_GATE.failureCode),
        "shoreline direct review failure code is not aligned")
    }
  }
  return rows
}

/** Input validation only. The registry argument must come from a committed-registry reader. */
export function validateV15ReviewLineage({ projectRoot, candidateManifestBinding,
  currentRegistry, candidateContract, candidateContractBinding,
  formalContractBinding }) {
  const root = path.resolve(projectRoot)
  validateV15CandidateContract(candidateContract, formalContractBinding)
  assert.ok(currentRegistry && typeof currentRegistry === "object", "verified current registry required")
  const manifest = boundJson(root, candidateManifestBinding)
  assert.equal(manifest.schemaVersion, "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1")
  assert.equal(manifest.status, "candidate_pack_materialized_review_pending")
  assert.equal(manifest.architectureId, V15_CAPABILITY)
  assert.deepEqual(manifest.stage, { stage: 0, width: 256, height: 192, epochCount: 24 })
  assert.equal(manifest.candidateSplit, "validation")
  assert.equal(manifest.candidateCount, 8)
  assert.equal(manifest.candidates?.length, 8)
  for (const field of ["machineReviewExecuted", "weightsModified", "challengeRead", "regressionRead"])
    assert.equal(manifest.executionBoundary?.[field], false, `${field} must be false`)
  assert.equal(manifest.executionBoundary?.optimizerCreated, false)
  assert.equal(manifest.executionBoundary?.optimizerSteps, 0)
  const execution = boundJson(root, manifest.executionPackage)
  const terminal = boundJson(root, manifest.trainingTerminal)
  assert.equal(execution.capabilityVersion, V15_CAPABILITY)
  if (candidateContractBinding)
    sameBinding(execution.candidateContract, candidateContractBinding, "V15 candidate contract")
  assert.equal(execution.packageId, manifest.executionPackageIdentity)
  assert.equal(execution.runId, manifest.runId)
  assert.ok(execution.outputRoot?.startsWith(
    ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-v15-formal-executions/"),
  "V15 output root is not isolated")
  assert.equal(execution.outputRoot.includes("\\"), false)
  assert.equal(execution.outputRoot.split("/").some((part) =>
    !part || part === "." || part === ".." || part === "latest"), false)
  assert.deepEqual(execution.stage, manifest.stage)
  assert.equal(execution.ticketConsumptionRequired, true)
  assert.deepEqual(execution.permittedSplits, ["train", "validation"])
  assert.deepEqual(execution.forbiddenSplits, ["challenge", "regression"])
  assert.ok(Array.isArray(execution.programBindings) && execution.programBindings.length > 0)
  for (const binding of execution.programBindings) readBound(root, binding)
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.capabilityVersion, V15_CAPABILITY)
  assert.equal(terminal.packageId, execution.packageId)
  assert.equal(terminal.runId, execution.runId)
  assert.equal(terminal.completedEpochs, 24)
  assert.equal(terminal.optimizerStepsGenerator, 1152)
  assert.equal(terminal.optimizerStepsDiscriminator, 1152)
  assert.equal(terminal.trainingStarted, true)
  assert.equal(terminal.checkpointReloadVerified, true)
  assert.equal(terminal.challengeRead, false)
  assert.equal(terminal.regressionRead, false)
  assert.equal(terminal.machineReviewPending, true)
  sameBinding(terminal.executionPackage, manifest.executionPackage, "terminal execution")
  sameBinding(terminal.checkpoint, manifest.checkpoint, "terminal checkpoint")
  readBound(root, manifest.checkpoint)
  assert.equal(terminal.modelStateSha256, manifest.modelStateSha256)
  assert.equal(terminal.discriminatorStateSha256, manifest.discriminatorStateSha256)
  assert.equal(terminal.selectedEpoch, manifest.selectedEpoch)
  assert.equal(terminal.selectedScore, manifest.selectedScore)
  sameBinding(execution.datasetManifest, manifest.datasetManifest, "execution dataset")
  sameBinding(terminal.datasetManifest, manifest.datasetManifest, "terminal dataset")
  assert.equal(currentRegistry.capabilityVersion, V15_CAPABILITY)
  assert.equal(currentRegistry.runId, manifest.runId)
  assert.equal(currentRegistry.packageId, execution.packageId)
  assert.equal(currentRegistry.activeExecution, null)
  assert.equal(currentRegistry.nextMachineAction, "run_stage0_machine_review")
  const dataset = boundJson(root, manifest.datasetManifest)
  sameBinding(manifest.datasetManifest, candidateContract.datasetBinding.manifest, "V15 dataset")
  sameBinding(dataset.sourceIndex, candidateContract.datasetBinding.sourceIndex, "V15 source index")
  for (const split of ["train", "validation", "challenge", "regression"])
    sameBinding(dataset.splits?.[split], candidateContract.datasetBinding.splits?.[split], `${split} split`)
  assert.equal(dataset.sampleCount, 64)
  assert.deepEqual(dataset.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(dataset.qualification?.dataQualifiedForTraining, true)
  const channelOrder = dataset.identityPayload?.channelOrder
  assert.equal(channelOrder?.length, 23)
  assert.equal(new Set(channelOrder).size, 23)
  const membership = boundJson(root, dataset.splits.validation)
  const source = boundJson(root, dataset.sourceIndex)
  assert.equal(membership.split, "validation")
  assert.equal(membership.sampleIds?.length, 8)
  assert.equal(new Set(membership.sampleIds).size, 8)
  const rows = new Map(source.samples.map((row) => [row.sampleId, row]))
  assert.equal(rows.size, 64)
  for (const [index, image] of manifest.candidates.entries()) {
    assert.equal(image.sampleIndex, index)
    assert.equal(image.sampleId, membership.sampleIds[index])
    assert.equal(image.split, "validation")
    assert.equal(image.candidateRgb.width, 256)
    assert.equal(image.candidateRgb.height, 192)
    assert.equal(image.candidateRgb.role, "complete_rgb_candidate")
    assert.ok(image.candidateRgb.path.startsWith(`${execution.outputRoot}/review-candidates/images/`))
    readBound(root, image.candidateRgb)
    const row = rows.get(image.sampleId)
    assert.equal(row?.split, "validation")
    sameBinding(image.referenceRgb, row.image, "reference RGB")
    sameBinding(image.conditionPack, row.conditionPack, "condition pack")
    readBound(root, image.referenceRgb)
    const pack = boundJson(root, image.conditionPack)
    assert.equal(pack.channels?.length, 23)
    assert.deepEqual(pack.channels.map((channel) => channel.id), channelOrder)
    validateHydrologyReviewSubject(pack)
    for (const channel of pack.channels) readBound(root, channel)
    assert.deepEqual(image.objectMasks.map((mask) => mask.role),
      ["object_footprints", "object_tree", "object_rock", "object_vegetation"])
    for (const mask of image.objectMasks) {
      const channel = pack.channels.find((item) => item.id === mask.role)
      sameBinding(mask, channel, `${mask.role} mask`)
      readBound(root, mask)
    }
    sameBinding(image.artifactIdentity?.candidateRgb, image.candidateRgb, "candidate identity")
    assert.equal(image.artifactIdentity?.modelStateSha256, terminal.modelStateSha256)
  }
  return { manifest, execution, terminal, dataset, validationSampleIds: membership.sampleIds }
}

/** Reuses the frozen V13 numeric audit, not its identity or activation. */
export async function auditV15FrozenReview({ projectRoot, validated }) {
  const audit = await auditFrozenStage0Review({ projectRoot, validated })
  assert.equal(audit.formalQualificationGranted, false)
  const shoreline = []
  for (const candidate of validated.manifest.candidates) {
    const pack = boundJson(projectRoot, candidate.conditionPack)
    const channel = pack.channels.find((item) => item.id === "terrain_shoreline")
    assert.ok(channel, "terrain_shoreline condition channel missing")
    const [mask, predicted, reference] = await Promise.all([
      decodeRaw(readBound(projectRoot, channel), 1024, 768, 1),
      decodeRaw(readBound(projectRoot, candidate.candidateRgb), 256, 192, 3,
        { width: 1024, height: 768, kernel: "nearest" }),
      decodeRaw(readBound(projectRoot, candidate.referenceRgb), 1024, 768, 3),
    ])
    const metric = computeShorelineMaskedRgbMae({ mask, predicted, reference,
      width: 1024, height: 768 })
    shoreline.push({ sampleIndex: candidate.sampleIndex, sampleId: candidate.sampleId,
      ...metric, passed: metric.status === "not_applicable"
        || metric.maskedRgbMae <= SHORELINE_GATE.maximumMaskedRgbMae.value,
      failureCode: metric.status === "applicable"
        && metric.maskedRgbMae > SHORELINE_GATE.maximumMaskedRgbMae.value
        ? SHORELINE_GATE.failureCode : null })
  }
  assert.equal(shoreline.length, 8)
  return { ...audit, shorelineReview: {
    gate: SHORELINE_GATE, reviews: shoreline,
    positiveSampleCount: shoreline.filter((row) => row.status === "applicable").length,
    passed: shoreline.some((row) => row.status === "applicable")
      && shoreline.every((row) => row.passed),
  } }
}

async function decodeRaw(bytes, sourceWidth, sourceHeight, channels, resize = null) {
  const input = sharp(bytes, { failOn: "error" })
  const source = await input.metadata()
  assert.equal(source.width, sourceWidth, "bound image width differs")
  assert.equal(source.height, sourceHeight, "bound image height differs")
  assert.equal(source.channels, channels, "bound image channel count differs")
  assert.equal(source.depth, "uchar", "bound image must be uint8")
  let pipeline = resize ? input.resize(resize.width, resize.height,
    { kernel: resize.kernel }) : input
  pipeline = channels === 1 ? pipeline.greyscale() : pipeline.toColourspace("srgb").removeAlpha()
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, resize?.width ?? sourceWidth)
  assert.equal(info.height, resize?.height ?? sourceHeight)
  assert.equal(info.channels, channels)
  assert.equal(info.depth, "uchar")
  return data
}

/** Exact normalized MAE on positive shoreline-mask pixels; no tuning inputs. */
export function computeShorelineMaskedRgbMae({ mask, predicted, reference, width, height }) {
  assert.ok(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0)
  const count = width * height
  assert.equal(mask?.length, count, "shoreline mask shape invalid")
  assert.equal(predicted?.length, count * 3, "candidate RGB shape invalid")
  assert.equal(reference?.length, count * 3, "reference RGB shape invalid")
  let pixels = 0
  let absoluteError = 0
  for (let index = 0; index < count; index += 1) {
    if (mask[index] === 0) continue
    pixels += 1
    for (let channel = 0; channel < 3; channel += 1)
      absoluteError += Math.abs(predicted[index * 3 + channel] - reference[index * 3 + channel])
  }
  if (pixels === 0) return { status: "not_applicable", maskPixelCount: 0, maskedRgbMae: null }
  return { status: "applicable", maskPixelCount: pixels,
    maskedRgbMae: absoluteError / (pixels * 3 * 255) }
}
