import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  auditCurrentV13Review,
  auditFrozenStage0Review,
  deriveV13ReviewDiagnostic,
  readBound,
  validateHydrologyReviewSubject,
  validateStage0ReviewLineage,
  validateV13ReviewLineage,
} from "../lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
import {
  decideV13FormalReview,
  runV13FormalReview,
  validateV13FormalReviewContractContents,
  verifyV13FormalReviewContract,
} from "../run-ai-painter-stage4-mvp-v13-stage0-machine-review.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const V12_MANIFEST = ".runtime/ai-painter/stage4-mvp-native-rgb-local-texture-v12-formal-executions/"
  + "mvp-stage0-batch-18f678002e15f8751a74a7928e9a3e5d533a6b97/stages/"
  + "mvp-stage0-18f678002e15f8751a74a7928e9a3e5d533a6b97e1dbc265/"
  + "review-candidates/manifest.json"
const CAPABILITY = "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
const bytes = fs.readFileSync(path.join(ROOT, V12_MANIFEST))
const binding = {
  path: V12_MANIFEST,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
}
const manifest = JSON.parse(bytes)
const reviewContractPath = "data/ai-painter/system-governance/stage4-mvp-v13-stage0-review-contract-v1.json"
const reviewContractBytes = fs.readFileSync(path.join(ROOT, reviewContractPath))
const reviewContractBinding = {
  path: reviewContractPath,
  sha256: crypto.createHash("sha256").update(reviewContractBytes).digest("hex"),
}
const registryAtReview = {
  capabilityVersion: CAPABILITY,
  runId: manifest.runId,
  packageId: manifest.executionPackageIdentity,
  activeExecution: null,
  nextMachineAction: "run_stage0_machine_review",
}

test("same lineage validator verifies eight immutable historical validation inputs", () => {
  const result = validateStage0ReviewLineage({
    projectRoot: ROOT, candidateManifestBinding: binding,
    currentRegistry: registryAtReview, expectedCapability: CAPABILITY,
  })
  assert.equal(result.validationSampleIds.length, 8)
  assert.equal(result.terminal.optimizerSteps, 1152)
  assert.equal(result.execution.packageId, manifest.executionPackageIdentity)
})

test("V13 wrapper never accepts a V12 candidate as a successor", () => {
  assert.throws(() => validateV13ReviewLineage({
    projectRoot: ROOT, candidateManifestBinding: binding,
    currentRegistry: registryAtReview,
  }), /Expected values to be strictly equal/u)
})

test("current V13 diagnostic reads the committed registry and rejects historical V12", async () => {
  await assert.rejects(() => auditCurrentV13Review({
    projectRoot: ROOT, candidateManifestBinding: binding,
  }), /Expected values to be strictly equal/u)
})

test("lineage rejects a stale or wrong current registry", () => {
  assert.throws(() => validateStage0ReviewLineage({
    projectRoot: ROOT, candidateManifestBinding: binding,
    currentRegistry: { ...registryAtReview, nextMachineAction: null },
    expectedCapability: CAPABILITY,
  }), /Expected values to be strictly equal/u)
})

test("lineage rejects changed bytes and path traversal", () => {
  assert.throws(() => readBound(ROOT, { ...binding, sha256: "0".repeat(64) }),
    /artifact hash mismatch/u)
  assert.throws(() => readBound(ROOT, { path: "../outside.json", sha256: binding.sha256 }),
    /traversal/u)
})

test("V13 formal reviewer has its own exact numeric adoption and cannot inherit V2 activation", () => {
  const contract = verifyV13FormalReviewContract(ROOT, reviewContractBinding)
  for (const mutate of [
    (value) => { value.activation.trainingAllowed = true },
    (value) => { value.activation.formalReviewExecutionAllowed = false },
    (value) => { value.numericThresholdAdoption.inheritV2Activation = true },
    (value) => { value.numericThresholdAdoption.binding.sha256 = "0".repeat(64) },
    (value) => { value.minimumDetailGate.sha256 = "0".repeat(64) },
    (value) => { value.decisionRule = "any_1_validation_pass" },
    (value) => { value.authorityBoundary.validationOnly = false },
  ]) {
    const altered = structuredClone(contract)
    mutate(altered)
    assert.throws(() => validateV13FormalReviewContractContents(altered))
  }
  assert.throws(() => verifyV13FormalReviewContract(ROOT, {
    ...reviewContractBinding, sha256: "0".repeat(64),
  }), /artifact hash mismatch/u)
})

test("V13 formal entry refuses the historical V12 candidate before writing", async () => {
  await assert.rejects(() => runV13FormalReview({ projectRoot: ROOT,
    candidateManifestBinding: binding, contractBinding: reviewContractBinding,
  }), /Expected values to be strictly equal/u)
})

test("water-positive samples cannot silently bypass absent hydrology lineage", () => {
  const emptyWaterPack = JSON.parse(fs.readFileSync(path.join(ROOT,
    manifest.candidates[0].conditionPack.path), "utf8"))
  assert.deepEqual(validateHydrologyReviewSubject(emptyWaterPack), {
    expectedWaterPresent: false, hydrologySubjectBound: false,
    flowingWaterRequired: false,
  })
  const positive = structuredClone(emptyWaterPack)
  positive.channels.find((channel) => channel.id === "terrain_water")
    .statistics.nonZeroCount = 1
  assert.throws(() => validateHydrologyReviewSubject(positive),
    /positive-water review lacks bound rebuild sequence identity/u)
  positive.reviewSubject = {
    rebuild64SequenceSeriesId: "thailand-rebuild64-20260731",
    regionalLandscapeType: "wet-season-drainage-hollow",
  }
  assert.throws(() => validateHydrologyReviewSubject(positive),
    /flowing-water review lacks bound connectivity blueprint path/u)
  positive.reviewSubject.connectivityBlueprintPath = "example/blueprint.json"
  assert.throws(() => validateHydrologyReviewSubject(positive),
    /flowing-water review lacks bound connectivity blueprint SHA-256/u)
  positive.reviewSubject.regionalLandscapeType = "closed-pond"
  assert.equal(validateHydrologyReviewSubject(positive).flowingWaterRequired, false)
})

test("V13 decision requires all eight on both independent gates", () => {
  const rows = Array.from({ length: 8 }, (_, sampleIndex) => ({
    sampleIndex, semanticAndAestheticPassed: true, minimumDetailPassed: true,
    hydrologyCoverage: { expectedWaterPresent: false, hydrologySubjectBound: false,
      flowingWaterRequired: false },
    conditionAlignment: { channelAudits: [], hydrologyConnectivityAudit: {
      flowingWaterRequired: false,
    } },
  }))
  const audit = {
    candidateCount: 8, reviews: rows,
    semanticAndAestheticPassCount: 8, minimumDetailPassCount: 8,
    frozenThresholds: {
      path: "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
      sha256: "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df",
    },
    frozenMinimumDetail: {
      path: "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
      sha256: "3fc675218fbd290454fce4f178bdd9a0253754e96d407ec19cba993af044c3ee",
    },
    formalReviewDispatchable: false, formalQualificationGranted: false,
  }
  const contract = verifyV13FormalReviewContract(ROOT, reviewContractBinding)
  assert.equal(decideV13FormalReview(audit, contract).qualityChecksPassed, true)
  assert.equal(decideV13FormalReview(audit, contract).formalQualificationGranted, true)
  const detailFailed = structuredClone(audit)
  detailFailed.reviews[3].minimumDetailPassed = false
  detailFailed.minimumDetailPassCount = 7
  assert.equal(decideV13FormalReview(detailFailed, contract).formalQualificationGranted, false)
  assert.equal(decideV13FormalReview(detailFailed, contract).qualityChecksPassed, false)
  assert.throws(() => decideV13FormalReview({ ...audit, formalReviewDispatchable: true }, contract))
  assert.throws(() => decideV13FormalReview({ ...audit, candidateCount: 7 }, contract))
  const waterWithoutReview = structuredClone(audit)
  waterWithoutReview.reviews[0].hydrologyCoverage = {
    expectedWaterPresent: true, hydrologySubjectBound: true,
    flowingWaterRequired: true,
  }
  assert.throws(() => decideV13FormalReview(waterWithoutReview, contract),
    /positive-water sample skipped water alignment review/u)
  const inactive = structuredClone(contract)
  inactive.activation.formalReviewExecutionAllowed = false
  assert.throws(() => decideV13FormalReview(audit, inactive))
})

test("frozen diagnostic metrics reproduce the historical V12 pass counts without qualification", async () => {
  const validated = validateStage0ReviewLineage({
    projectRoot: ROOT, candidateManifestBinding: binding,
    currentRegistry: registryAtReview, expectedCapability: CAPABILITY,
  })
  const audit = await auditFrozenStage0Review({ projectRoot: ROOT, validated })
  const reviewPath = V12_MANIFEST.replace("review-candidates/manifest.json", "review/machine-review.json")
  const detailPath = V12_MANIFEST.replace("review-candidates/manifest.json", "review/detail-review.json")
  const historical = JSON.parse(fs.readFileSync(path.join(ROOT, reviewPath)))
  const historicalDetail = JSON.parse(fs.readFileSync(path.join(ROOT, detailPath)))
  assert.equal(audit.candidateCount, historical.candidateCount)
  assert.equal(audit.semanticAndAestheticPassCount, historical.candidatePassCount)
  assert.equal(audit.minimumDetailPassCount, historicalDetail.candidatePassCount)
  for (const [index, row] of audit.reviews.entries()) {
    assert.equal(row.sampleId, historical.reviews[index].sampleId)
    assert.equal(row.semanticAndAestheticPassed, historical.reviews[index].passed)
    assert.equal(row.minimumDetailPassed, historicalDetail.reviews[index].passed)
    assert.deepEqual(row.issueCodes, [...new Set([
      ...historical.reviews[index].issueCodes,
      ...historicalDetail.reviews[index].issueCodes,
    ])].sort())
  }
  assert.equal(audit.formalReviewDispatchable, false)
  assert.equal(audit.formalQualificationGranted, false)
  const v13Shape = { ...validated, manifest: {
    ...validated.manifest, architectureId: "stage4_mvp_native_rgb_instance_object_renderer_v13",
  } }
  const decision = deriveV13ReviewDiagnostic(v13Shape, audit)
  assert.equal(decision.allQualityChecksPassed, false)
  assert.equal(decision.formalQualificationGranted, false)
  const syntheticAllPass = {
    ...audit, semanticAndAestheticPassCount: 8, minimumDetailPassCount: 8,
    reviews: audit.reviews.map((row) => ({
      ...row, semanticAndAestheticPassed: true, minimumDetailPassed: true, issueCodes: [],
    })),
  }
  const diagnosticOnly = deriveV13ReviewDiagnostic(v13Shape, syntheticAllPass)
  assert.equal(diagnosticOnly.allQualityChecksPassed, true)
  assert.equal(diagnosticOnly.formalQualificationGranted, false)
  assert.equal(diagnosticOnly.checkpointPromotionEligible, false)
  assert.throws(() => deriveV13ReviewDiagnostic(v13Shape, {
    ...syntheticAllPass, formalReviewDispatchable: true,
  }), /Expected values to be strictly equal/u)
  assert.throws(() => deriveV13ReviewDiagnostic(v13Shape, {
    ...audit, reviews: audit.reviews.map((row, index) =>
      index === 0 ? { ...row, sampleId: "unbound-sample" } : row),
  }), /Expected values to be strictly equal/u)
})
