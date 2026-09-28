import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { readBound } from "./lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
import {
  V16_CAPABILITY, V16_CANDIDATE_CONTRACT_PATH, V16_REVIEW_CONTRACT_PATH,
  FROZEN_THRESHOLD, FROZEN_DETAIL, SHORELINE_GATE, auditV16FrozenReview,
  validateV16CandidateContract, validateV16ReviewLineage,
} from "./lib/ai-painter-stage4-mvp-v16-review-lineage.mjs"

const RUNNER_PATH = "scripts/run-ai-painter-stage4-mvp-v16-stage0-machine-review.mjs"
const LIBRARY_PATH = "scripts/lib/ai-painter-stage4-mvp-v16-review-lineage.mjs"
const FROZEN_AUDIT_PATH = "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
const SHORELINE_TEST_PATH = "scripts/tests/test-ai-painter-stage4-mvp-v16-review-lineage.mjs"
const ADOPTED_SECTIONS = ["commonMeasurementContract", "conditionAlignmentThresholds",
  "professionalAestheticThresholds", "failureCodes", "reviewTrainingSeparation"]

function binding(root, logical) {
  const bytes = fs.readFileSync(path.join(root, logical))
  return { path: logical, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
}

export function validateV16FormalReviewContractContents(contract) {
  assert.equal(contract.schemaVersion, "stage4-mvp-v16-stage0-review-contract-v1")
  assert.equal(contract.contractId, "stage4-mvp-v16-stage0-review-contract-v1")
  assert.equal(contract.capabilityVersion, V16_CAPABILITY)
  assert.equal(contract.status, "active_for_v16_stage0_machine_review")
  assert.deepEqual(contract.activation, {
    formalReviewExecutionAllowed: true,
    trainingAllowed: false, gpuAllowed: false, runtimeFrameAllowed: false,
  })
  assert.deepEqual(contract.numericThresholdAdoption, {
    binding: FROZEN_THRESHOLD, sections: ADOPTED_SECTIONS,
    inheritV2Activation: false, thresholdOverridesAllowed: false,
  })
  assert.deepEqual(contract.minimumDetailGate, FROZEN_DETAIL)
  assert.equal(contract.candidateContractPath, V16_CANDIDATE_CONTRACT_PATH)
  assert.equal(contract.candidateCapabilityVersion, V16_CAPABILITY)
  assert.equal(contract.candidateContract, undefined,
    "review contract cannot bind candidate SHA: it would create a hash cycle")
  assert.equal(contract.candidateContractBinding, undefined)
  assert.equal(contract.candidateContractSha256, undefined)
  const { positiveNegativeTests, ...shorelineGate } = contract.shorelineReview ?? {}
  assert.deepEqual(shorelineGate, SHORELINE_GATE)
  assert.equal(positiveNegativeTests?.path, SHORELINE_TEST_PATH)
  assert.match(positiveNegativeTests?.sha256 ?? "", /^[a-f0-9]{64}$/u)
  assert.equal(contract.decisionRule,
    "all_8_validation_semantic_aesthetic_and_minimum_detail_plus_direct_shoreline_required")
  assert.deepEqual(contract.authorityBoundary, {
    registrySource: "verified_committed_current_execution_registry",
    executionPackageMustBindThisContract: true,
    candidateManifestMustBindOneCurrentRun: true,
    validationOnly: true, challengeOrRegressionReadAllowed: false,
    reviewScoresAsTrainingTargetAllowed: false,
    historicalV13CanSatisfyV16: false, historicalV15CanSatisfyV16: false,
    oldV2ActivationInherited: false,
    allEightRequired: true, minimumDetailIsAdditionalMandatoryGate: true,
    missingShorelineCannotQualify: true, reportIsNotRuntimePublication: true,
  })
}

export function verifyV16FormalReviewContract(root, contractBinding) {
  assert.equal(contractBinding?.path, V16_REVIEW_CONTRACT_PATH)
  const contract = JSON.parse(readBound(root, contractBinding).toString("utf8"))
  validateV16FormalReviewContractContents(contract)
  assert.deepEqual(contract.programs, {
    runner: binding(root, RUNNER_PATH),
    lineageAndAuditors: binding(root, LIBRARY_PATH),
    frozenGenericAudit: binding(root, FROZEN_AUDIT_PATH),
  })
  assert.deepEqual(contract.shorelineReview.positiveNegativeTests,
    binding(root, SHORELINE_TEST_PATH), "shoreline positive/negative test source changed")
  const threshold = JSON.parse(readBound(root, FROZEN_THRESHOLD).toString("utf8"))
  const detail = JSON.parse(readBound(root, FROZEN_DETAIL).toString("utf8"))
  assert.equal(threshold.status, "cpu_supported_inactive")
  assert.equal(threshold.activation?.formalReviewExecutionAllowed, false)
  assert.equal(threshold.formalReviewBoundary?.dispatchable, false)
  assert.equal(threshold.reviewTrainingSeparation?.thresholdLoweringAllowed, false)
  assert.equal(detail.boundary?.mayGrantFormalStage4Qualification, false)
  assert.deepEqual(threshold.conditionAlignmentThresholds?.referenceSemantics?.channels
    ?.object_footprints?.maximumMaskedRgbMae, SHORELINE_GATE.maximumMaskedRgbMae,
  "predeclared shoreline gate threshold source changed")
  for (const section of ADOPTED_SECTIONS) assert.ok(threshold[section], `${section} missing`)
  return contract
}

export function decideV16FormalReview(audit, contract) {
  validateV16FormalReviewContractContents(contract)
  assert.equal(audit.candidateCount, 8)
  assert.equal(audit.reviews?.length, 8)
  assert.deepEqual(audit.frozenThresholds, FROZEN_THRESHOLD)
  assert.deepEqual(audit.frozenMinimumDetail, FROZEN_DETAIL)
  assert.equal(audit.formalReviewDispatchable, false)
  assert.equal(audit.formalQualificationGranted, false)
  const { positiveNegativeTests: _testBinding, ...shorelineGate } = contract.shorelineReview
  assert.deepEqual(audit.shorelineReview?.gate, shorelineGate)
  assert.equal(audit.shorelineReview?.reviews?.length, 8)
  assert.equal(audit.shorelineReview.positiveSampleCount,
    audit.shorelineReview.reviews.filter((row) => row.status === "applicable").length)
  assert.equal(audit.shorelineReview.passed,
    audit.shorelineReview.positiveSampleCount > 0
      && audit.shorelineReview.reviews.every((row) => row.passed))
  for (const [index, row] of audit.reviews.entries()) {
    assert.equal(row.sampleIndex, index)
    assert.equal(typeof row.semanticAndAestheticPassed, "boolean")
    assert.equal(typeof row.minimumDetailPassed, "boolean")
    assert.equal(typeof row.hydrologyCoverage?.expectedWaterPresent, "boolean")
    assert.equal(row.hydrologyCoverage?.hydrologySubjectBound,
      row.hydrologyCoverage.expectedWaterPresent)
    if (row.hydrologyCoverage.expectedWaterPresent) {
      assert.equal(row.conditionAlignment?.channelAudits?.find((item) =>
        item.channelId === "terrain_water")?.absenceExpected, false,
      "positive-water sample skipped water alignment review")
    }
    if (row.hydrologyCoverage.flowingWaterRequired)
      assert.equal(row.conditionAlignment?.hydrologyConnectivityAudit?.flowingWaterRequired, true)
  }
  const semanticPassCount = audit.reviews.filter((row) => row.semanticAndAestheticPassed).length
  const detailPassCount = audit.reviews.filter((row) => row.minimumDetailPassed).length
  assert.equal(semanticPassCount, audit.semanticAndAestheticPassCount)
  assert.equal(detailPassCount, audit.minimumDetailPassCount)
  const passed = semanticPassCount === 8 && detailPassCount === 8
    && audit.shorelineReview.passed
  return {
    status: passed ? "stage4_mvp_stage0_machine_review_passed"
      : "stage4_mvp_stage0_machine_review_failed",
    candidatePassCount: audit.reviews.filter((row) =>
      row.semanticAndAestheticPassed && row.minimumDetailPassed).length,
    semanticPassCount, detailPassCount,
    formalQualificationGranted: passed, checkpointPromotionEligible: passed,
    stage1InitializationEligible: passed,
    blockedReason: passed ? null : audit.shorelineReview.positiveSampleCount === 0
      ? "terrain_shoreline_uncovered_in_validation"
      : !audit.shorelineReview.passed ? "terrain_shoreline_rgb_alignment_failed"
        : "frozen_semantic_aesthetic_or_minimum_detail_failed",
  }
}

export async function runV16FormalReview({ projectRoot, candidateManifestBinding, contractBinding }) {
  const root = path.resolve(projectRoot)
  const contract = verifyV16FormalReviewContract(root, contractBinding)
  const before = await readCurrentExecutionRegistry(root)
  assert.equal(before.ok, true, before.errorCode ?? "current registry invalid")
  const manifestPreflight = JSON.parse(readBound(root, candidateManifestBinding).toString("utf8"))
  const executionPreflight = JSON.parse(readBound(root, manifestPreflight.executionPackage).toString("utf8"))
  assert.deepEqual(executionPreflight.reviewContract, contractBinding,
    "V16 execution package did not bind this review contract")
  assert.equal(executionPreflight.candidateContract?.path, contract.candidateContractPath,
    "V16 execution package did not bind this candidate contract path")
  const candidate = JSON.parse(readBound(root, executionPreflight.candidateContract).toString("utf8"))
  validateV16CandidateContract(candidate, contractBinding)
  const validated = validateV16ReviewLineage({ projectRoot: root, candidateManifestBinding,
    currentRegistry: before.registry, candidateContract: candidate,
    candidateContractBinding: executionPreflight.candidateContract,
    formalContractBinding: contractBinding })
  const audit = await auditV16FrozenReview({ projectRoot: root, validated })
  const decision = decideV16FormalReview(audit, contract)
  verifyV16FormalReviewContract(root, contractBinding)
  const after = await readCurrentExecutionRegistry(root)
  assert.equal(after.ok, true, after.errorCode ?? "current registry invalid")
  assert.equal(after.registrySha256, before.registrySha256,
    "current registry changed during V16 review")
  const report = {
    schemaVersion: "stage4-mvp-v16-stage0-formal-machine-review-v1",
    status: decision.status, executionState: "completed", capabilityVersion: V16_CAPABILITY,
    runId: validated.manifest.runId, packageId: validated.execution.packageId,
    candidateManifest: candidateManifestBinding,
    executionPackage: validated.manifest.executionPackage,
    reviewContract: contractBinding, thresholdContract: FROZEN_THRESHOLD,
    minimumDetailContract: FROZEN_DETAIL, shorelineReview: audit.shorelineReview,
    candidateCount: 8, candidatePassCount: decision.candidatePassCount,
    semanticPassCount: decision.semanticPassCount,
    minimumDetailPassCount: decision.detailPassCount, reviews: audit.reviews,
    blockedReason: decision.blockedReason,
    formalQualificationGranted: decision.formalQualificationGranted,
    checkpointPromotionEligible: decision.checkpointPromotionEligible,
    stage1InitializationEligible: decision.stage1InitializationEligible,
    trainingStartedByReview: false,
    weightsModifiedByReview: false, reviewResultsUsedAsTrainingTarget: false,
    registryRevision: before.registry.registryRevision,
    registrySha256: before.registrySha256, recordedAtUtc: new Date().toISOString(),
  }
  const outputLogical = `${validated.execution.outputRoot}/review/v16-formal-machine-review.json`
  const output = path.resolve(root, outputLogical)
  const actualParent = fs.realpathSync(path.dirname(output))
  const allowed = fs.realpathSync(path.join(root, ".runtime", "ai-painter"))
  assert.ok(actualParent.startsWith(`${allowed}${path.sep}`), "review output escaped runtime")
  const fd = fs.openSync(output, "wx")
  try {
    fs.writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    fs.fsyncSync(fd)
  } finally { fs.closeSync(fd) }
  return { status: report.status, formalQualificationGranted: report.formalQualificationGranted,
    report: binding(root, outputLogical) }
}

function parseArgs(values) {
  const args = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--") && values[index + 1], "invalid argument pair")
    args.set(values[index].slice(2), values[index + 1])
  }
  const required = (name) => {
    const value = args.get(name)
    assert.ok(value, `--${name} required`)
    return value
  }
  return {
    candidateManifestBinding: {
      path: required("candidate-manifest"), sha256: required("candidate-manifest-sha256"),
    },
    contractBinding: { path: V16_REVIEW_CONTRACT_PATH,
      sha256: required("review-contract-sha256") },
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runV16FormalReview({ projectRoot: process.cwd(),
    ...parseArgs(process.argv.slice(2)) })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
