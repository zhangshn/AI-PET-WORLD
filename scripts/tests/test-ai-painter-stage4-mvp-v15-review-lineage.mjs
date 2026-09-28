import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  FROZEN_DETAIL, FROZEN_THRESHOLD, V15_CAPABILITY,
  SHORELINE_GATE, computeShorelineMaskedRgbMae,
  validateV15CandidateContract, validateV15ReviewLineage,
} from "../lib/ai-painter-stage4-mvp-v15-review-lineage.mjs"
import {
  decideV15FormalReview, runV15FormalReview,
  validateV15FormalReviewContractContents, verifyV15FormalReviewContract,
} from "../run-ai-painter-stage4-mvp-v15-stage0-machine-review.mjs"

const REQUIRED = [
  ["road", "terrain_path_ground"], ["hydrology", "terrain_water"],
  ["shoreline", "terrain_shoreline"], ["footprints", "object_footprints"],
  ["tree", "object_tree"], ["rock", "object_rock"],
  ["vegetation", "object_vegetation"],
]
const sha = "a".repeat(64)
const formalBinding = {
  path: "data/ai-painter/system-governance/stage4-mvp-v15-stage0-review-contract-v1.json",
  sha256: sha,
}

function candidateContract() {
  return {
    schemaVersion: "stage4-mvp-native-rgb-conditional-texture-v15-contract-v1",
    capabilityVersion: V15_CAPABILITY,
    reviewBinding: { thresholds: FROZEN_THRESHOLD, minimumDetail: FROZEN_DETAIL,
      thresholdLoweringAllowed: false, alignmentQualified: true,
      formalReviewDispatchable: false, formalContract: formalBinding },
    trainingReviewAlignment: REQUIRED.map(([responsibilityId, channel]) => ({
      responsibilityId, conditionChannelIds: [channel],
      objectiveTermIds: ["factRegionCoarseRgbMae"], formulaSha256: sha,
      responsibilityOutputIdentity: "full_rgb",
      formalReviewContractIdentity: "stage4-mvp-v15-stage0-review-contract-v1",
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
    schemaVersion: "stage4-mvp-v15-stage0-review-contract-v1",
    contractId: "stage4-mvp-v15-stage0-review-contract-v1",
    capabilityVersion: V15_CAPABILITY,
    status: "active_for_v15_stage0_machine_review",
    activation: { formalReviewExecutionAllowed: true, trainingAllowed: false,
      gpuAllowed: false, runtimeFrameAllowed: false },
    numericThresholdAdoption: { binding: FROZEN_THRESHOLD,
      sections: ["commonMeasurementContract", "conditionAlignmentThresholds",
        "professionalAestheticThresholds", "failureCodes", "reviewTrainingSeparation"],
      inheritV2Activation: false, thresholdOverridesAllowed: false },
    minimumDetailGate: FROZEN_DETAIL,
    candidateContractPath:
      "data/ai-painter/system-governance/stage4-mvp-native-rgb-conditional-texture-v15-contract.json",
    candidateCapabilityVersion: V15_CAPABILITY,
    shorelineReview: { ...SHORELINE_GATE, positiveNegativeTests: {
      path: "scripts/tests/test-ai-painter-stage4-mvp-v15-review-lineage.mjs",
      sha256: sha,
    } },
    decisionRule:
      "all_8_validation_semantic_aesthetic_and_minimum_detail_plus_direct_shoreline_required",
    authorityBoundary: {
      registrySource: "verified_committed_current_execution_registry",
      executionPackageMustBindThisContract: true,
      candidateManifestMustBindOneCurrentRun: true, validationOnly: true,
      challengeOrRegressionReadAllowed: false, reviewScoresAsTrainingTargetAllowed: false,
      historicalV13CanSatisfyV15: false, oldV2ActivationInherited: false,
      allEightRequired: true, minimumDetailIsAdditionalMandatoryGate: true,
      missingShorelineCannotQualify: true, reportIsNotRuntimePublication: true,
    },
  }
}

test("V15 requires all seven mapped training/review responsibilities", () => {
  const contract = candidateContract()
  assert.equal(validateV15CandidateContract(contract, formalBinding).length, 7)
  for (const mutate of [
    (value) => { value.trainingReviewAlignment.splice(2, 1) },
    (value) => { value.trainingReviewAlignment[2].conditionChannelIds = [] },
    (value) => { value.trainingReviewAlignment[5].negativeAlignmentTests = [] },
    (value) => { value.reviewBinding.thresholdLoweringAllowed = true },
    (value) => { value.reviewBinding.formalReviewDispatchable = true },
    (value) => { value.reviewBinding.formalContract.sha256 = "0".repeat(64) },
  ]) {
    const altered = structuredClone(contract)
    mutate(altered)
    assert.throws(() => validateV15CandidateContract(altered, formalBinding))
  }
})

test("V15 review contract rejects inherited activation and shoreline gate weakening", () => {
  const contract = reviewContract()
  validateV15FormalReviewContractContents(contract)
  for (const mutate of [
    (value) => { value.activation.formalReviewExecutionAllowed = false },
    (value) => { value.numericThresholdAdoption.thresholdOverridesAllowed = true },
    (value) => { value.minimumDetailGate.sha256 = "0".repeat(64) },
    (value) => { value.shorelineReview.maximumMaskedRgbMae.value = 0.4 },
    (value) => { value.authorityBoundary.challengeOrRegressionReadAllowed = true },
  ]) {
    const altered = structuredClone(contract)
    mutate(altered)
    assert.throws(() => validateV15FormalReviewContractContents(altered))
  }
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
  const result = decideV15FormalReview(audit, contract)
  assert.equal(result.candidatePassCount, 8)
  assert.equal(result.formalQualificationGranted, true)
  assert.throws(() => decideV15FormalReview({ ...audit, candidateCount: 7 }, contract))
  assert.throws(() => decideV15FormalReview({ ...audit,
    shorelineReview: { ...audit.shorelineReview, gate: {
      ...SHORELINE_GATE, maximumMaskedRgbMae: { comparator: "<=", value: 0.4,
        unit: "normalized_rgb_mae" } } } }, contract))
  const failed = structuredClone(audit)
  failed.shorelineReview.reviews[0].passed = false
  failed.shorelineReview.passed = false
  assert.equal(decideV15FormalReview(failed, contract).formalQualificationGranted, false)
  const absent = structuredClone(audit)
  absent.shorelineReview.positiveSampleCount = 0
  absent.shorelineReview.reviews[0].status = "not_applicable"
  absent.shorelineReview.passed = false
  assert.equal(decideV15FormalReview(absent, contract).formalQualificationGranted, false)
})

test("V15 lineage rejects a historical V13 manifest before opening image content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v15-lineage-fixture-"))
  try {
    fs.mkdirSync(path.join(root, "data"))
    const bytes = Buffer.from(JSON.stringify({
      schemaVersion: "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1",
      status: "candidate_pack_materialized_review_pending",
      architectureId: "stage4_mvp_native_rgb_instance_object_renderer_v13",
    }))
    fs.writeFileSync(path.join(root, "data", "manifest.json"), bytes)
    const candidateManifestBinding = { path: "data/manifest.json",
      sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
    assert.throws(() => validateV15ReviewLineage({ projectRoot: root,
      candidateManifestBinding, currentRegistry: { capabilityVersion: V15_CAPABILITY },
      candidateContract: candidateContract(), formalContractBinding: formalBinding }))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("missing or forged V15 review contract fails before a real review", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v15-review-fixture-"))
  try {
    assert.throws(() => verifyV15FormalReviewContract(root, {
      path: "data/ai-painter/system-governance/stage4-mvp-v15-stage0-review-contract-v1.json",
      sha256: "0".repeat(64),
    }))
    await assert.rejects(() => runV15FormalReview({ projectRoot: root,
      candidateManifestBinding: { path: "data/fake.json", sha256: sha },
      contractBinding: { path: "data/fake.json", sha256: sha },
    }))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
