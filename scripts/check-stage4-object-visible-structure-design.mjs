import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  buildBoundedObjectVisibleStructureDesign,
  validateObjectVisibleStructureDesignSource,
} from "./lib/ai-painter-stage4-object-visible-structure-design.mjs"

const ROOT = process.cwd()
const value = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (input) => {
  assert.equal(path.isAbsolute(input), false, `absolute_path_rejected:${input}`)
  const resolved = path.resolve(ROOT, input)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${input}`)
  return resolved
}
const readJson = (input) => JSON.parse(fs.readFileSync(resolveProject(input), "utf8"))
const sha256 = (input) => crypto.createHash("sha256").update(fs.readFileSync(resolveProject(input))).digest("hex")
const clone = (input) => structuredClone(input)

const authorizationPath = value("--authorization")
const authorizationSha256 = value("--authorization-sha256")
assert.ok(process.argv.includes("--implementation-contract"), "implementation_contract_mode_required")
assert.ok(authorizationPath && authorizationSha256, "authorization_arguments_required")
assert.equal(sha256(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.match(authorization.runId, /^\d{8}-\d{9}-stage0$/, "authorization_run_id_invalid")
for (const [name, binding] of Object.entries(authorization.sourceEvidence ?? {})) {
  assert.equal(sha256(binding.path), binding.sha256, `${name}_binding_changed`)
}

const source = {
  terminal: readJson(authorization.sourceEvidence.formalAdjudicationTerminal.path),
  report: readJson(authorization.sourceEvidence.formalAnalysisReport.path),
  decision: readJson(authorization.sourceEvidence.formalDecision.path),
  recommendation: readJson(authorization.sourceEvidence.inactiveRecommendation.path),
  capsule: readJson(authorization.sourceEvidence.formalCapsule.path),
  failedStage0ActiveConfig: readJson(authorization.sourceEvidence.failedStage0ActiveConfig.path),
  failedPriorDesign: readJson(authorization.sourceEvidence.failedPriorDesign.path),
}

const positive = [
  () => validateObjectVisibleStructureDesignSource(source, authorization.runId),
  () => buildBoundedObjectVisibleStructureDesign(source, authorization.runId),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).scope.changesReviewContract, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).scope.selectsNumericalWeightsNow, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).implementationBoundary.trainingAuthorizedNow, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).implementationBoundary.gpuAuthorizedNow, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).typedObjectObligations.length, 4),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).acceptanceBoundary.failedPreviewPixelsMayBecomeTargets, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).acceptanceBoundary.failedCheckpointWeightsMayBeLoaded, false),
  () => assert.deepEqual(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 }),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).candidateId, "typed_object_multiscale_luminance_structure_correlation_supervision_v1"),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).noveltyBoundary.failedSingleScaleContractReuseAllowed, false),
  () => assert.deepEqual(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).multiscaleContract.inheritedPyramidScales, [1, 0.5, 0.25]),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).multiscaleContract.freeAggregationWeightSelectionAllowed, false),
  () => assert.equal(buildBoundedObjectVisibleStructureDesign(source, authorization.runId).typedObjectObligations.every((row) => row.perScaleCorrelationRequired && row.crossScaleStructureConsistencyRequired), true),
]

const mutations = [
  (draft) => { draft.terminal.runId = "historical-run" },
  (draft) => { draft.terminal.fixedTotalProgress.percent = 80 },
  (draft) => { draft.terminal.classification = "audit_contract_error" },
  (draft) => { draft.terminal.automaticRetryStarted = true },
  (draft) => { draft.decision.bindingChecks.terminal_run_identity = false },
  (draft) => { draft.decision.auditContractChecks.thresholds_unchanged = false },
  (draft) => { draft.decision.modelFailureChecks.terminal_water_passed = false },
  (draft) => { draft.decision.modelFailureChecks.terminal_four_object_semantics_failed = false },
  (draft) => { draft.decision.terminalObjectMetrics.object_tree.minimumMaskedLumaCorrelation = 0.01 },
  (draft) => { draft.decision.terminalObjectMetrics.object_rock.maskedLumaCorrelation = 0.2 },
  (draft) => { delete draft.decision.terminalObjectMetrics.object_vegetation },
  (draft) => { draft.recommendation.invariants[0] = "lower_review_thresholds" },
  (draft) => { draft.recommendation.freeHyperparametersSelected = true },
  (draft) => { draft.recommendation.executionAuthorized = true },
  (draft) => { draft.capsule.latestBlocker = "training_requested" },
  (draft) => { draft.decision.stage1EntryPermitted = true },
  (draft) => { draft.failedStage0ActiveConfig.training.stage4ObjectVisibleStructureSupervision.enabled = false },
  (draft) => { draft.failedStage0ActiveConfig.training.stage4ObjectVisibleStructureSupervision.lossFunction = "different_loss" },
  (draft) => { draft.failedStage0ActiveConfig.training.textureHierarchyScales = [1] },
  (draft) => { draft.failedPriorDesign.derivedReferenceSignals.push("multiscale_not_historical") },
]

let positivePassed = 0
for (const test of positive) {
  test()
  positivePassed += 1
}
let negativePassed = 0
for (const mutate of mutations) {
  const draft = clone(source)
  mutate(draft)
  assert.throws(() => validateObjectVisibleStructureDesignSource(draft, authorization.runId))
  negativePassed += 1
}

console.log(JSON.stringify({
  schemaVersion: "stage4-object-visible-structure-design-cpu-contract-regression-v1",
  status: "passed",
  positivePassed,
  positiveTotal: positive.length,
  negativePassed,
  negativeTotal: mutations.length,
  executionBoundary: {
    formalDesignExecuted: false,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuUsed: false,
    trainingStarted: false,
  },
}, null, 2))
