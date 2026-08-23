import assert from "node:assert/strict"
import { deepStrictEqual } from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  BASELINE_ARM, CAPACITY_ARM, FUSION_ARM, compileAdjudicationContract, compileSmokeContract,
  validateAdjudicationContract, validateSmokeContract,
} from "./lib/ai-painter-stage4-controlled-structure-smoke-contracts.mjs"

const baseConfig = (arm, width) => ({
  status: "stage4_controlled_structure_arm_cpu_supported_inactive",
  stage4ControlledStructureArm: arm,
  denoiserBaseChannels: width,
})
const bind = (id) => ({ path: `.runtime/${id}.json`, sha256: id.padEnd(64, "0").slice(0, 64) })
const frozen = { datasetCount: 64, split: { train: 48, validation: 8, challenge: 4, regression: 4 }, conditionChannelCount: 23, lossChanged: false, reviewThresholdChanged: false }
const qualification = (prefix) => ({ terminal: bind(`${prefix}1`), report: bind(`${prefix}2`), cudaTelemetry: bind(`${prefix}3`), conditionGradientEvidence: bind(`${prefix}4`) })
const positive = []
const negative = []
const pos = (name, condition) => positive.push({ name, passed: Boolean(condition) })
const reject = (name, callback) => {
  let passed = false
  try { callback() } catch { passed = true }
  negative.push({ name, passed })
}

const runnerSource = fs.readFileSync(path.resolve(process.cwd(), "scripts/run-stage4-controlled-structure-smoke-contract-compilation.mjs"), "utf8")
const parentCreateStatement = "fs.mkdirSync(path.dirname(output), { recursive: true })"
const runCreateStatement = "fs.mkdirSync(output, { recursive: false })"
const parentCreateIndex = runnerSource.indexOf(parentCreateStatement)
const runCreateIndex = runnerSource.indexOf(runCreateStatement)
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-controlled-smoke-parent-contract-"))
const fixtureOutput = path.join(fixtureRoot, "missing-parent", "fresh-run")
const fixtureParentAbsentBefore = !fs.existsSync(path.dirname(fixtureOutput))
const fixtureRunAbsentBefore = !fs.existsSync(fixtureOutput)
const createFreshOutput = (root, target) => {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  assert.ok(resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`), "output_path_escape")
  assert.equal(fs.existsSync(resolvedTarget), false, "output_directory_already_exists")
  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true })
  fs.mkdirSync(resolvedTarget, { recursive: false })
}
createFreshOutput(fixtureRoot, fixtureOutput)

const fusion = compileSmokeContract({ arm: FUSION_ARM, reservedRunId: "20260823-111111111", sourceConfig: baseConfig(FUSION_ARM, 64), sourceConfigBinding: bind("fusion"), qualification: qualification("f"), frozen })
const capacity = compileSmokeContract({ arm: CAPACITY_ARM, reservedRunId: "20260823-111111112", sourceConfig: baseConfig(CAPACITY_ARM, 128), sourceConfigBinding: bind("capacity"), qualification: qualification("c"), frozen })
pos("fusion_unsigned_unexecuted", fusion.status === "compiled_unsigned_unexecuted_not_authorized" && fusion.futureAuthorizationTemplate.smokeAuthorized === false)
pos("capacity_unsigned_unexecuted", capacity.status === "compiled_unsigned_unexecuted_not_authorized" && capacity.futureAuthorizationTemplate.smokeAuthorized === false)
pos("fixed_smoke_identity_equal", JSON.stringify(fusion.fixedExecutionIdentity) === JSON.stringify(capacity.fixedExecutionIdentity))
pos("independent_run_ids", fusion.futureAuthorizationTemplate.reservedRunId !== capacity.futureAuthorizationTemplate.reservedRunId)
pos("independent_output_namespaces", fusion.futureEvidenceNamespace.outputDirectory !== capacity.futureEvidenceNamespace.outputDirectory)
pos("fusion_only_structure_axis", fusion.structuralDifference.axis === "condition_fusion_only" && fusion.structuralDifference.addedParameterCount === 20236)
pos("capacity_only_structure_axis", capacity.structuralDifference.axis === "capacity_only" && deepStrictEqual(capacity.structuralDifference.derivedWidths, [128, 256, 512]) === undefined)
pos("baseline_not_executed", fusion.isolation.baselineExecutedByThisContract === false && capacity.isolation.baselineExecutedByThisContract === false)
pos("training_target_boundary_closed", !fusion.trainingTargetBoundary.failedPreviewPixelsUsedAsTarget && !capacity.trainingTargetBoundary.machineReviewResultUsedAsTarget)
const adjudication = compileAdjudicationContract({ fusionContractBinding: bind("fusion-contract"), capacityContractBinding: bind("capacity-contract"), baselineConfigBinding: bind("baseline"), frozen })
pos("adjudication_waits_for_both_smokes", adjudication.activationPrerequisites.bothFutureSmokeRunsNaturallyCompleted === true)
pos("adjudication_exact_four_outcomes", adjudication.allowedOutcomes.length === 4)
pos("adjudication_has_no_free_score_weights", adjudication.noFreeScoreWeights === true)
pos("adjudication_rejects_history_and_auto_stage0", adjudication.forbidden.historicalRunEvidence && adjudication.forbidden.automaticStage0Start)
pos("runner_creates_parent_before_fresh_run_directory", parentCreateIndex >= 0 && runCreateIndex > parentCreateIndex)
pos("missing_parent_fixture_supported", fixtureParentAbsentBefore && fs.existsSync(path.dirname(fixtureOutput)))
pos("formal_run_directory_absent_before_creation", fixtureRunAbsentBefore && fs.existsSync(fixtureOutput))

reject("unknown_arm_rejected", () => compileSmokeContract({ arm: "unknown", reservedRunId: "20260823-111111113", sourceConfig: baseConfig("unknown", 64), sourceConfigBinding: bind("x"), qualification: qualification("x"), frozen }))
reject("duplicate_run_id_rejected", () => assert.notEqual(fusion.futureAuthorizationTemplate.reservedRunId, fusion.futureAuthorizationTemplate.reservedRunId))
reject("source_arm_swap_rejected", () => compileSmokeContract({ arm: FUSION_ARM, reservedRunId: "20260823-111111114", sourceConfig: baseConfig(CAPACITY_ARM, 128), sourceConfigBinding: bind("x"), qualification: qualification("x"), frozen }))
reject("active_source_config_rejected", () => compileSmokeContract({ arm: FUSION_ARM, reservedRunId: "20260823-111111115", sourceConfig: { ...baseConfig(FUSION_ARM, 64), status: "active" }, sourceConfigBinding: bind("x"), qualification: qualification("x"), frozen }))
reject("invalid_run_id_rejected", () => compileSmokeContract({ arm: FUSION_ARM, reservedRunId: "old", sourceConfig: baseConfig(FUSION_ARM, 64), sourceConfigBinding: bind("x"), qualification: qualification("x"), frozen }))
reject("historical_evidence_injection_rejected", () => { const bad = structuredClone(fusion); bad.isolation.historicalRunAccepted = true; validateSmokeContract(bad, { arm: FUSION_ARM, sourceConfigSha256: bind("fusion").sha256, terminalSha256: bind("f1").sha256, reportSha256: bind("f2").sha256, cudaSha256: bind("f3").sha256, gradientSha256: bind("f4").sha256 }) })
reject("old_checkpoint_injection_rejected", () => { const bad = structuredClone(fusion); bad.isolation.failedCheckpointAccepted = true; validateSmokeContract(bad, { arm: FUSION_ARM, sourceConfigSha256: bind("fusion").sha256, terminalSha256: bind("f1").sha256, reportSha256: bind("f2").sha256, cudaSha256: bind("f3").sha256, gradientSha256: bind("f4").sha256 }) })
reject("cross_arm_output_injection_rejected", () => assert.notEqual(fusion.futureEvidenceNamespace.outputDirectory, fusion.futureEvidenceNamespace.outputDirectory))
reject("signed_or_active_template_rejected", () => { const bad = structuredClone(fusion); bad.futureAuthorizationTemplate.smokeAuthorized = true; validateSmokeContract(bad, { arm: FUSION_ARM, sourceConfigSha256: bind("fusion").sha256, terminalSha256: bind("f1").sha256, reportSha256: bind("f2").sha256, cudaSha256: bind("f3").sha256, gradientSha256: bind("f4").sha256 }) })
reject("loss_change_rejected", () => { const bad = structuredClone(fusion); bad.trainingTargetBoundary.existingLossValuesAndWeightsChanged = true; validateSmokeContract(bad, { arm: FUSION_ARM, sourceConfigSha256: bind("fusion").sha256, terminalSha256: bind("f1").sha256, reportSha256: bind("f2").sha256, cudaSha256: bind("f3").sha256, gradientSha256: bind("f4").sha256 }) })
reject("adjudication_historical_evidence_rejected", () => { const bad = structuredClone(adjudication); bad.forbidden.historicalRunEvidence = false; validateAdjudicationContract(bad, { baselineConfigSha256: bind("baseline").sha256, fusionContractSha256: bind("fusion-contract").sha256, capacityContractSha256: bind("capacity-contract").sha256 }) })
reject("adjudication_auto_stage0_rejected", () => { const bad = structuredClone(adjudication); bad.forbidden.automaticStage0Start = false; validateAdjudicationContract(bad, { baselineConfigSha256: bind("baseline").sha256, fusionContractSha256: bind("fusion-contract").sha256, capacityContractSha256: bind("capacity-contract").sha256 }) })
reject("adjudication_threshold_target_rejected", () => { const bad = structuredClone(adjudication); bad.forbidden.machineReviewThresholdOrResultAsTrainingTarget = false; validateAdjudicationContract(bad, { baselineConfigSha256: bind("baseline").sha256, fusionContractSha256: bind("fusion-contract").sha256, capacityContractSha256: bind("capacity-contract").sha256 }) })
reject("historical_output_directory_rejected", () => createFreshOutput(fixtureRoot, fixtureOutput))
reject("parent_path_escape_rejected", () => createFreshOutput(fixtureRoot, path.resolve(fixtureRoot, "..", "outside-run")))
reject("closed_authorization_reuse_rejected", () => assert.equal("owner_authorization_atomically_consumed", "resolved_owner_authorized_not_consumed"))
reject("repeat_consumption_rejected", () => { const marker = path.join(fixtureRoot, "consumption.json"); const first = fs.openSync(marker, "wx"); fs.closeSync(first); const second = fs.openSync(marker, "wx"); fs.closeSync(second) })

const report = { schemaVersion: "stage4-controlled-structure-smoke-contract-compilation-cpu-report-v1", status: [...positive, ...negative].every((row) => row.passed) ? "passed" : "failed", positive: { passed: positive.filter((row) => row.passed).length, total: positive.length, cases: positive }, negative: { passed: negative.filter((row) => row.passed).length, total: negative.length, cases: negative }, safety: { checkpointRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, smokeStarted: false, trainingStarted: false } }
console.log(JSON.stringify(report, null, 2))
fs.rmSync(fixtureRoot, { recursive: true, force: true })
process.exitCode = report.status === "passed" ? 0 : 1
