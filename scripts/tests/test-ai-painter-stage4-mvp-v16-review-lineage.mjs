import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  FROZEN_DETAIL, FROZEN_THRESHOLD, V16_CAPABILITY,
  SHORELINE_GATE, computeShorelineMaskedRgbMae,
  validateV16CandidateContract, validateV16OriginalRgbSources, validateV16ReviewLineage,
} from "../lib/ai-painter-stage4-mvp-v16-review-lineage.mjs"
import {
  decideV16FormalReview, runV16FormalReview,
  validateV16FormalReviewContractContents, verifyV16FormalReviewContract,
} from "../run-ai-painter-stage4-mvp-v16-stage0-machine-review.mjs"

const REQUIRED = [
  ["road", "terrain_path_ground"], ["hydrology", "terrain_water"],
  ["shoreline", "terrain_shoreline"], ["footprints", "object_footprints"],
  ["tree", "object_tree"], ["rock", "object_rock"],
  ["vegetation", "object_vegetation"],
]
const sha = "a".repeat(64)
const formalBinding = {
  path: "data/ai-painter/system-governance/stage4-mvp-v16-stage0-review-contract-v1.json",
  sha256: sha,
}

function candidateContract() {
  return {
    schemaVersion: "stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract-v1",
    capabilityVersion: V16_CAPABILITY,
    lossContract: { failedPreviewOrReviewScoreAsTrainingTarget: false },
    foundationAssetBinding: { failedCheckpointLoaded: false },
    reviewBinding: { thresholds: FROZEN_THRESHOLD, minimumDetail: FROZEN_DETAIL,
      thresholdLoweringAllowed: false, alignmentQualified: true,
      formalReviewDispatchable: false, formalContract: formalBinding },
    trainingReviewAlignment: REQUIRED.map(([responsibilityId, channel]) => ({
      responsibilityId, conditionChannelIds: [channel],
      objectiveTermIds: ["factRegionCoarseRgbMae"], formulaSha256: sha,
      responsibilityOutputIdentity: "full_rgb",
      formalReviewContractIdentity: "stage4-mvp-v16-stage0-review-contract-v1",
      formalReviewContractSha256: formalBinding.sha256,
      reviewMetricIds: responsibilityId === "shoreline"
        ? [SHORELINE_GATE.metricId] : ["condition_alignment"],
      failureCodes: responsibilityId === "shoreline"
        ? [SHORELINE_GATE.failureCode] : ["alignment_failed"],
      positiveAlignmentTests: ["bound_positive"], negativeAlignmentTests: ["bound_negative"],
    })),
  }
}

function reviewContract() {
  return {
    schemaVersion: "stage4-mvp-v16-stage0-review-contract-v1",
    contractId: "stage4-mvp-v16-stage0-review-contract-v1",
    capabilityVersion: V16_CAPABILITY,
    status: "active_for_v16_stage0_machine_review",
    activation: { formalReviewExecutionAllowed: true, trainingAllowed: false,
      gpuAllowed: false, runtimeFrameAllowed: false },
    numericThresholdAdoption: { binding: FROZEN_THRESHOLD,
      sections: ["commonMeasurementContract", "conditionAlignmentThresholds",
        "professionalAestheticThresholds", "failureCodes", "reviewTrainingSeparation"],
      inheritV2Activation: false, thresholdOverridesAllowed: false },
    minimumDetailGate: FROZEN_DETAIL,
    candidateContractPath:
      "data/ai-painter/system-governance/stage4-mvp-native-rgb-conditional-texture-bf16-v16-contract.json",
    candidateCapabilityVersion: V16_CAPABILITY,
    shorelineReview: { ...SHORELINE_GATE, positiveNegativeTests: {
      path: "scripts/tests/test-ai-painter-stage4-mvp-v16-review-lineage.mjs",
      sha256: sha,
    } },
    decisionRule:
      "all_8_validation_semantic_aesthetic_and_minimum_detail_plus_direct_shoreline_required",
    authorityBoundary: {
      registrySource: "verified_committed_current_execution_registry",
      executionPackageMustBindThisContract: true,
      candidateManifestMustBindOneCurrentRun: true, validationOnly: true,
      challengeOrRegressionReadAllowed: false, reviewScoresAsTrainingTargetAllowed: false,
      historicalV13CanSatisfyV16: false, historicalV15CanSatisfyV16: false,
      oldV2ActivationInherited: false,
      allEightRequired: true, minimumDetailIsAdditionalMandatoryGate: true,
      missingShorelineCannotQualify: true, reportIsNotRuntimePublication: true,
    },
  }
}

test("V16 requires all seven mapped training/review responsibilities", () => {
  const contract = candidateContract()
  assert.equal(validateV16CandidateContract(contract, formalBinding).length, 7)
  for (const mutate of [
    (value) => { value.trainingReviewAlignment.splice(2, 1) },
    (value) => { value.trainingReviewAlignment[2].conditionChannelIds = [] },
    (value) => { value.trainingReviewAlignment[5].negativeAlignmentTests = [] },
    (value) => { value.reviewBinding.thresholdLoweringAllowed = true },
    (value) => { value.reviewBinding.formalReviewDispatchable = true },
    (value) => { value.reviewBinding.formalContract.sha256 = "0".repeat(64) },
    (value) => { value.lossContract.failedPreviewOrReviewScoreAsTrainingTarget = true },
    (value) => { value.foundationAssetBinding.failedCheckpointLoaded = true },
  ]) {
    const altered = structuredClone(contract)
    mutate(altered)
    assert.throws(() => validateV16CandidateContract(altered, formalBinding))
  }
})

test("V16 review contract rejects inherited activation and shoreline gate weakening", () => {
  const contract = reviewContract()
  validateV16FormalReviewContractContents(contract)
  for (const mutate of [
    (value) => { value.activation.formalReviewExecutionAllowed = false },
    (value) => { value.numericThresholdAdoption.thresholdOverridesAllowed = true },
    (value) => { value.minimumDetailGate.sha256 = "0".repeat(64) },
    (value) => { value.shorelineReview.maximumMaskedRgbMae.value = 0.4 },
    (value) => { value.authorityBoundary.challengeOrRegressionReadAllowed = true },
    (value) => { value.authorityBoundary.historicalV15CanSatisfyV16 = true },
    (value) => { value.candidateContractSha256 = sha },
  ]) {
    const altered = structuredClone(contract)
    mutate(altered)
    assert.throws(() => validateV16FormalReviewContractContents(altered))
  }
})

test("V16 accepts bound original RGB metadata and rejects failed V15 output as train target", () => {
  const source = { sampleCount: 64, samples: Array.from({ length: 64 }, (_, index) => ({
    sampleId: `original-${index}`, split: index < 48 ? "train" :
      index < 56 ? "validation" : index < 60 ? "challenge" : "regression",
    image: { path: `data/world-samples/ai-assisted-cold-start-dataset-packages/original/images/${index}.png`,
      sha256: sha },
  })) }
  validateV16OriginalRgbSources(source)
  const altered = structuredClone(source)
  altered.samples[0].image.path =
    ".runtime/ai-painter/stage4-mvp-native-rgb-conditional-texture-v15-formal-executions/failed.png"
  assert.throws(() => validateV16OriginalRgbSources(altered), /non-original RGB target rejected/u)
  altered.samples[0].image.path =
    "data/world-samples/ai-assisted-cold-start-dataset-packages/../../.runtime/failed.png"
  assert.throws(() => validateV16OriginalRgbSources(altered), /traversal/u)
})

test("shoreline masked RGB MAE accepts matching pixels and rejects mismatched area", () => {
  const mask = Buffer.from([0, 255, 255, 0])
  const reference = Buffer.from([0, 0, 0, 30, 60, 90, 100, 120, 140, 0, 0, 0])
  assert.deepEqual(computeShorelineMaskedRgbMae({ mask, predicted: reference,
    reference, width: 2, height: 2 }),
  { status: "applicable", maskPixelCount: 2, maskedRgbMae: 0 })
  const wrong = Buffer.from(reference)
  wrong.fill(255, 3, 9)
  const result = computeShorelineMaskedRgbMae({ mask, predicted: wrong,
    reference, width: 2, height: 2 })
  assert.ok(result.maskedRgbMae > SHORELINE_GATE.maximumMaskedRgbMae.value)
  assert.equal(computeShorelineMaskedRgbMae({ mask: Buffer.alloc(4), predicted: reference,
    reference, width: 2, height: 2 }).status, "not_applicable")
  assert.throws(() => computeShorelineMaskedRgbMae({ mask, predicted: Buffer.alloc(2),
    reference, width: 2, height: 2 }))
})

test("eight synthetic rows pass only when frozen and independent shoreline gates all pass", () => {
  const contract = reviewContract()
  const reviews = Array.from({ length: 8 }, (_, sampleIndex) => ({
    sampleIndex, semanticAndAestheticPassed: true, minimumDetailPassed: true,
    hydrologyCoverage: { expectedWaterPresent: false,
      hydrologySubjectBound: false, flowingWaterRequired: false },
  }))
  const audit = { candidateCount: 8, reviews, semanticAndAestheticPassCount: 8,
    minimumDetailPassCount: 8, frozenThresholds: FROZEN_THRESHOLD,
    frozenMinimumDetail: FROZEN_DETAIL, formalReviewDispatchable: false,
    formalQualificationGranted: false, shorelineReview: { gate: SHORELINE_GATE,
      positiveSampleCount: 1, passed: true,
      reviews: reviews.map((row, index) => ({ sampleIndex: row.sampleIndex,
        status: index === 0 ? "applicable" : "not_applicable", passed: true })) } }
  const result = decideV16FormalReview(audit, contract)
  assert.equal(result.candidatePassCount, 8)
  assert.equal(result.formalQualificationGranted, true)
  assert.throws(() => decideV16FormalReview({ ...audit, candidateCount: 7 }, contract))
  assert.throws(() => decideV16FormalReview({ ...audit,
    shorelineReview: { ...audit.shorelineReview, gate: {
      ...SHORELINE_GATE, maximumMaskedRgbMae: { comparator: "<=", value: 0.4,
        unit: "normalized_rgb_mae" } } } }, contract))
  const failed = structuredClone(audit)
  failed.shorelineReview.reviews[0].passed = false
  failed.shorelineReview.passed = false
  assert.equal(decideV16FormalReview(failed, contract).formalQualificationGranted, false)
  const absent = structuredClone(audit)
  absent.shorelineReview.positiveSampleCount = 0
  absent.shorelineReview.reviews[0].status = "not_applicable"
  absent.shorelineReview.passed = false
  assert.equal(decideV16FormalReview(absent, contract).formalQualificationGranted, false)
  const semanticFailure = structuredClone(audit)
  semanticFailure.reviews[7].semanticAndAestheticPassed = false
  semanticFailure.semanticAndAestheticPassCount = 7
  assert.equal(decideV16FormalReview(semanticFailure, contract).formalQualificationGranted, false)
  const detailFailure = structuredClone(audit)
  detailFailure.reviews[4].minimumDetailPassed = false
  detailFailure.minimumDetailPassCount = 7
  assert.equal(decideV16FormalReview(detailFailure, contract).formalQualificationGranted, false)
})

test("V16 lineage rejects historical V13 and failed V15 manifests before image content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v16-lineage-fixture-"))
  try {
    fs.mkdirSync(path.join(root, "data"))
    for (const architectureId of [
      "stage4_mvp_native_rgb_instance_object_renderer_v13",
      "stage4_mvp_native_rgb_conditional_texture_v15",
    ]) {
      const bytes = Buffer.from(JSON.stringify({
        schemaVersion: "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1",
        status: "candidate_pack_materialized_review_pending", architectureId,
      }))
      fs.writeFileSync(path.join(root, "data", "manifest.json"), bytes)
      const candidateManifestBinding = { path: "data/manifest.json",
        sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
      assert.throws(() => validateV16ReviewLineage({ projectRoot: root,
        candidateManifestBinding, currentRegistry: { capabilityVersion: V16_CAPABILITY },
        candidateContract: candidateContract(), formalContractBinding: formalBinding }))
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("missing or forged V16 review contract fails before a real review", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v16-review-fixture-"))
  try {
    assert.throws(() => verifyV16FormalReviewContract(root, {
      path: "data/ai-painter/system-governance/stage4-mvp-v16-stage0-review-contract-v1.json",
      sha256: "0".repeat(64),
    }))
    await assert.rejects(() => runV16FormalReview({ projectRoot: root,
      candidateManifestBinding: { path: "data/fake.json", sha256: sha },
      contractBinding: { path: "data/fake.json", sha256: sha },
    }))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
