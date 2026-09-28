import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

import {
  V13_CAPABILITY,
  auditCurrentV13Review,
  readBound,
} from "./lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"

const RUNNER_PATH = "scripts/run-ai-painter-stage4-mvp-v13-stage0-machine-review.mjs"
const LIBRARY_PATH = "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
const CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp-v13-stage0-review-contract-v1.json"
const THRESHOLD = {
  path: "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
  sha256: "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df",
}
const DETAIL = {
  path: "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
  sha256: "3fc675218fbd290454fce4f178bdd9a0253754e96d407ec19cba993af044c3ee",
}
const ADOPTED_SECTIONS = [
  "commonMeasurementContract", "conditionAlignmentThresholds",
  "professionalAestheticThresholds", "failureCodes", "reviewTrainingSeparation",
]

function currentBinding(root, logical) {
  const bytes = fs.readFileSync(path.join(root, logical))
  return { path: logical, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
}

export function validateV13FormalReviewContractContents(contract) {
  assert.equal(contract.schemaVersion, "stage4-mvp-v13-stage0-review-contract-v1")
  assert.equal(contract.contractId, "stage4-mvp-v13-stage0-review-contract-v1")
  assert.equal(contract.capabilityVersion, V13_CAPABILITY)
  assert.equal(contract.status, "active_for_v13_stage0_machine_review")
  assert.deepEqual(contract.activation, {
    formalReviewExecutionAllowed: true, trainingAllowed: false,
    gpuAllowed: false, runtimeFrameAllowed: false,
  })
  assert.deepEqual(contract.numericThresholdAdoption, {
    binding: THRESHOLD, sections: ADOPTED_SECTIONS,
    inheritV2Activation: false, thresholdOverridesAllowed: false,
  })
  assert.deepEqual(contract.minimumDetailGate, DETAIL)
  assert.equal(contract.decisionRule, "all_8_validation_semantic_aesthetic_and_minimum_detail")
  assert.deepEqual(contract.authorityBoundary, {
    registrySource: "verified_committed_current_execution_registry",
    executionPackageMustBindThisContract: true,
    candidateManifestMustBindOneCurrentRun: true,
    validationOnly: true, challengeOrRegressionReadAllowed: false,
    reviewScoresAsTrainingTargetAllowed: false,
    historicalV12CanSatisfyV13: false, oldV2ActivationInherited: false,
    allEightRequired: true, minimumDetailIsAdditionalMandatoryGate: true,
    reportIsNotRuntimePublication: true,
  })
}

export function verifyV13FormalReviewContract(root, contractBinding) {
  assert.equal(contractBinding.path, CONTRACT_PATH)
  const contract = JSON.parse(readBound(root, contractBinding).toString("utf8"))
  validateV13FormalReviewContractContents(contract)
  assert.deepEqual(contract.programs, {
    runner: currentBinding(root, RUNNER_PATH),
    lineageAndAuditors: currentBinding(root, LIBRARY_PATH),
  })
  const old = JSON.parse(readBound(root, THRESHOLD).toString("utf8"))
  const detail = JSON.parse(readBound(root, DETAIL).toString("utf8"))
  assert.equal(old.status, "cpu_supported_inactive")
  assert.equal(old.activation?.formalReviewExecutionAllowed, false)
  assert.equal(old.formalReviewBoundary?.dispatchable, false)
  assert.equal(old.reviewTrainingSeparation?.thresholdLoweringAllowed, false)
  assert.equal(detail.boundary?.mayGrantFormalStage4Qualification, false)
  for (const section of ADOPTED_SECTIONS) assert.ok(old[section], `${section} missing`)
  return contract
}

export function decideV13FormalReview(audit, contract) {
  validateV13FormalReviewContractContents(contract)
  assert.equal(audit.candidateCount, 8)
  assert.equal(audit.reviews?.length, 8)
  assert.deepEqual(audit.frozenThresholds, THRESHOLD)
  assert.deepEqual(audit.frozenMinimumDetail, DETAIL)
  assert.equal(audit.formalReviewDispatchable, false,
    "inherited V2 activation must remain inactive")
  assert.equal(audit.formalQualificationGranted, false)
  for (const [index, row] of audit.reviews.entries()) {
    assert.equal(row.sampleIndex, index)
    assert.equal(typeof row.semanticAndAestheticPassed, "boolean")
    assert.equal(typeof row.minimumDetailPassed, "boolean")
    assert.equal(typeof row.hydrologyCoverage?.expectedWaterPresent, "boolean")
    assert.equal(row.hydrologyCoverage?.hydrologySubjectBound,
      row.hydrologyCoverage.expectedWaterPresent)
    assert.equal(typeof row.hydrologyCoverage.flowingWaterRequired, "boolean")
    if (row.hydrologyCoverage.expectedWaterPresent) {
      assert.equal(row.conditionAlignment?.channelAudits?.find((channel) =>
        channel.channelId === "terrain_water")?.absenceExpected, false,
      "positive-water sample skipped water alignment review")
    }
    if (row.hydrologyCoverage.flowingWaterRequired) {
      assert.equal(row.conditionAlignment?.hydrologyConnectivityAudit?.flowingWaterRequired,
        true, "flowing-water sample did not undergo connectivity review")
    }
  }
  const semanticPassCount = audit.reviews.filter((row) => row.semanticAndAestheticPassed).length
  const detailPassCount = audit.reviews.filter((row) => row.minimumDetailPassed).length
  assert.equal(semanticPassCount, audit.semanticAndAestheticPassCount)
  assert.equal(detailPassCount, audit.minimumDetailPassCount)
  const passed = semanticPassCount === 8 && detailPassCount === 8
  return {
    passed, qualityChecksPassed: passed, semanticPassCount, detailPassCount,
    combinedPassCount: audit.reviews.filter((row) =>
      row.semanticAndAestheticPassed && row.minimumDetailPassed).length,
    formalQualificationGranted: passed,
    checkpointPromotionEligible: passed,
    stage1InitializationEligible: passed,
  }
}

export async function runV13FormalReview({ projectRoot, candidateManifestBinding, contractBinding }) {
  const root = path.resolve(projectRoot)
  const contract = verifyV13FormalReviewContract(root, contractBinding)
  assert.equal(contract.activation.formalReviewExecutionAllowed, true,
    "V13 formal review is inactive; diagnostic review cannot grant qualification")
  const manifest = JSON.parse(readBound(root, candidateManifestBinding).toString("utf8"))
  assert.equal(manifest.architectureId, V13_CAPABILITY)
  const execution = JSON.parse(readBound(root, manifest.executionPackage).toString("utf8"))
  assert.deepEqual(execution.reviewContract, contractBinding,
    "V13 execution package did not bind this formal review contract")
  assert.equal(execution.capabilityVersion, V13_CAPABILITY)
  assert.equal(execution.outputRoot.startsWith(
    ".runtime/ai-painter/stage4-mvp-native-rgb-instance-object-v13-formal-executions/"), true)
  assert.equal(execution.outputRoot.includes("\\"), false)
  assert.equal(execution.outputRoot.split("/").some((part) =>
    !part || part === "." || part === ".." || part === "latest"), false)
  const audit = await auditCurrentV13Review({ projectRoot: root, candidateManifestBinding })
  assert.deepEqual(audit.frozenThresholds, contract.numericThresholdAdoption.binding)
  assert.deepEqual(audit.frozenMinimumDetail, contract.minimumDetailGate)
  const decision = decideV13FormalReview(audit, contract)
  verifyV13FormalReviewContract(root, contractBinding)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  assert.equal(current.registrySha256, audit.registrySha256,
    "current registry changed after V13 machine review")
  const report = {
    schemaVersion: "stage4-mvp-v13-stage0-formal-machine-review-v1",
    status: decision.passed ? "stage4_mvp_stage0_machine_review_passed"
      : "stage4_mvp_stage0_machine_review_failed",
    executionState: "completed", capabilityVersion: V13_CAPABILITY,
    runId: manifest.runId, packageId: execution.packageId,
    candidateManifest: candidateManifestBinding,
    executionPackage: manifest.executionPackage,
    reviewContract: contractBinding,
    thresholdContract: THRESHOLD, minimumDetailContract: DETAIL,
    candidateCount: 8, candidatePassCount: decision.combinedPassCount,
    semanticPassCount: decision.semanticPassCount,
    minimumDetailPassCount: decision.detailPassCount,
    reviews: audit.reviews,
    formalQualificationGranted: decision.formalQualificationGranted,
    checkpointPromotionEligible: decision.checkpointPromotionEligible,
    stage1InitializationEligible: decision.stage1InitializationEligible,
    trainingStartedByReview: false, weightsModifiedByReview: false,
    reviewResultsUsedAsTrainingTarget: false,
    registryRevision: audit.registryRevision,
    registrySha256: audit.registrySha256,
    recordedAtUtc: new Date().toISOString(),
  }
  const outputLogical = `${execution.outputRoot}/review/v13-formal-machine-review.json`
  const output = path.resolve(root, outputLogical)
  const actualParent = fs.realpathSync(path.dirname(output))
  const allowed = fs.realpathSync(path.join(root, ".runtime", "ai-painter"))
  assert.ok(actualParent.startsWith(`${allowed}${path.sep}`), "review output escaped runtime")
  const fd = fs.openSync(output, "wx")
  try {
    fs.writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  return { status: report.status, formalQualificationGranted: report.formalQualificationGranted,
    report: currentBinding(root, outputLogical) }
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
    contractBinding: { path: CONTRACT_PATH, sha256: required("review-contract-sha256") },
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runV13FormalReview({ projectRoot: process.cwd(),
    ...parseArgs(process.argv.slice(2)) })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
