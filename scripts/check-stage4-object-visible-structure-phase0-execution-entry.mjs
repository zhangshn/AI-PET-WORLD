import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  IMPLEMENTATION_AUTHORIZATION_SHA256,
  IMPLEMENTATION_CONSUMPTION_SHA256,
  OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS,
  REQUIRED_GPU_BINDINGS,
  buildGpuAuthorizationFixture,
  compilePhase0DerivedConfig,
  validatePhase0DerivedConfig,
  validateGpuAuthorizationDocument,
  validateImplementationSource,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const resolveProject = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`)); return result }
const read = (value) => JSON.parse(fs.readFileSync(resolveProject(value), "utf8"))
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(resolveProject(value))).digest("hex")

const authorizationPath = arg("--authorization")
const consumptionPath = arg("--consumption")
assert.equal(sha(authorizationPath), IMPLEMENTATION_AUTHORIZATION_SHA256)
assert.equal(sha(consumptionPath), IMPLEMENTATION_CONSUMPTION_SHA256)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
for (const [name, binding] of Object.entries(authorization.bindings)) assert.equal(sha(binding.path), binding.sha256, `${name}_binding_changed`)
const source = {
  authorization,
  consumption,
  designReport: read(authorization.bindings.phase0DesignReport.path),
  inactiveContract: read(authorization.bindings.inactivePhase0ExecutionContract.path),
  designTerminal: read(authorization.bindings.phase0DesignTerminal.path),
}
const sourceConfig = read(arg("--source-config"))
const inactiveFragment = read(arg("--inactive-fragment"))
const sourceSnapshot = structuredClone(sourceConfig)
const compiled = compilePhase0DerivedConfig(sourceConfig, inactiveFragment)
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const pythonEntry = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_object_visible_structure_phase0.py")
const lineageIdentity = resolveProject(arg("--lineage-identity"))
const prospectiveGpuRequestId = arg("--prospective-gpu-request-id")
assert.match(prospectiveGpuRequestId, /^owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-\d{8}-\d{9}$/)
const runLineage = (mutation = null) => spawnSync(python, [pythonEntry,
  "--lineage-contract-only", "--phase0-execution-identity", lineageIdentity,
  "--prospective-request-id", prospectiveGpuRequestId,
  ...(mutation ? ["--lineage-mutation", mutation] : []),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true })
const lineagePositive = runLineage()
assert.equal(lineagePositive.status, 0, `lineage_positive_failed:${lineagePositive.stderr}`)
const lineageReport = JSON.parse(lineagePositive.stdout)
assert.equal(lineageReport.cudaInitialized, false)
const runFullCli = (mutation = null) => spawnSync(python, [pythonEntry,
  "--full-cli-contract-only", "--phase0-execution-identity", lineageIdentity,
  ...(mutation ? ["--full-cli-mutation", mutation] : []),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true })
const fullCliPositive = runFullCli()
assert.equal(fullCliPositive.status, 0, `full_cli_positive_failed:${fullCliPositive.stderr}`)
const fullCliReport = JSON.parse(fullCliPositive.stdout)
assert.equal(fullCliReport.cudaInitialized, false)
const runTrainerControlFlow = (mutation = null) => spawnSync(python, [pythonEntry,
  "--trainer-pre-model-control-flow-contract-only",
  "--config", path.join(ROOT, read(arg("--lineage-identity")).sourceInactiveConfigPath),
  "--dataset-package", path.join(ROOT, read(arg("--lineage-identity")).datasetManifestPath),
  "--autoencoder-checkpoint", path.join(ROOT, read(arg("--lineage-identity")).autoencoderCheckpointPath),
  "--output-dir", path.join(ROOT, ".runtime", "ai-painter", "forbidden-phase0-control-flow-contract-output"),
  "--resolution-stage", "0", "--single-sample-overfit-smoke",
  "--overfit-sample-id", read(arg("--lineage-identity")).fixedTaskIdentity.sampleId,
  "--overfit-epochs", "1", "--overfit-evaluation-interval", "1",
  "--stage4-validation-kernel-phase0-update", "--phase0-execution-identity", lineageIdentity,
  ...(mutation ? ["--control-flow-mutation", mutation] : []),
], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTORCH_NVML_BASED_CUDA_CHECK: "1" }, windowsHide: true })
const trainerControlFlowPositive = runTrainerControlFlow()
assert.equal(trainerControlFlowPositive.status, 0, `trainer_control_flow_positive_failed:${trainerControlFlowPositive.stderr}`)
const trainerControlFlowReport = JSON.parse(trainerControlFlowPositive.stdout)
assert.equal(trainerControlFlowReport.cudaInitialized, false)
assert.equal(trainerControlFlowReport.datasetMaterialized, false)
assert.equal(trainerControlFlowReport.modelLoaded, false)
assert.equal(trainerControlFlowReport.resolvedAdapterBinding, "object_visible_structure_phase0_adapter")
assert.equal(trainerControlFlowReport.dispatchModeResolutionCount, 1)
assert.equal(trainerControlFlowReport.nestedValidatorModeId, "fact_conditioned_semantic_mixture_stage0_full_training")
assert.equal(trainerControlFlowReport.nestedFormalContractCheckCount, 8)
assert.equal(trainerControlFlowReport.nestedFormalContractsValidatedAfterDispatch, true)

const dummyBindings = Object.fromEntries(REQUIRED_GPU_BINDINGS.map((name, index) => [name, { path: `fixture/${name}.json`, sha256: String(index + 1).padStart(64, "0") }]))
const fixture = buildGpuAuthorizationFixture(dummyBindings)
const positives = [
  () => validateImplementationSource(source),
  () => validateGpuAuthorizationDocument(fixture),
  () => assert.equal(fixture.taskIdentity.sampleSplit, "validation"),
  () => assert.equal(fixture.taskIdentity.seed, 20263722),
  () => assert.equal(fixture.taskIdentity.timestep, 999),
  () => assert.deepEqual(fixture.taskIdentity.resolution, { width: 256, height: 192 }),
  () => assert.deepEqual(fixture.taskIdentity.requiredBoundarySides, ["west"]),
  () => assert.equal(fixture.taskIdentity.diagnosticManifestMetricCount, 32),
  () => assert.equal(fixture.executionActions.exactlyOneBackwardAndOptimizerStep, true),
  () => assert.equal(fixture.executionActions.moreThanOneOptimizerStep, false),
  () => assert.equal(fixture.executionActions.modelSmoke, false),
  () => assert.equal(fixture.executionActions.formalStage0Training, false),
  () => assert.equal(fixture.executionActions.failedDenoiserCheckpointReadOrLoad, false),
  () => assert.equal(fixture.execution.maximumExecutions, 1),
  () => validatePhase0DerivedConfig(compiled, sourceConfig),
  () => assert.deepEqual(sourceConfig, sourceSnapshot),
  () => assert.equal(OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS.length, 32),
  () => assert.equal(compiled.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFieldCount, 32),
  () => assert.equal(compiled.training.stage4ObjectVisibleStructureSupervision.activationGate.stage4FullTrainingNow, false),
  () => assert.equal(lineageReport.status, "stage4_object_visible_structure_phase0_current_attestation_status_lineage_contract_passed_cpu_only"),
  () => assert.equal(lineageReport.prospectiveRequestId, prospectiveGpuRequestId),
  () => assert.equal(fullCliReport.status, "stage4_object_visible_structure_phase0_full_cli_contract_passed_cpu_only"),
  () => assert.equal(trainerControlFlowReport.status, "stage4_object_visible_structure_phase0_real_trainer_pre_model_control_flow_passed_cpu_only"),
]
const mutations = [
  (value) => { value.status = "consumed" },
  (value) => { value.requestId = "historical" },
  (value) => { value.commandRef = "historical" },
  (value) => { value.scope = "training" },
  (value) => { value.taskIdentity.architectureId = "historical" },
  (value) => { value.taskIdentity.sampleId = "historical" },
  (value) => { value.taskIdentity.sampleSplit = "train" },
  (value) => { value.taskIdentity.seed = 1 },
  (value) => { value.taskIdentity.timestep = 1 },
  (value) => { value.taskIdentity.resolution.width = 512 },
  (value) => { value.taskIdentity.requiredBoundarySides = ["south"] },
  (value) => { value.taskIdentity.objectSemanticChannels.reverse() },
  (value) => { value.taskIdentity.diagnosticManifestMetricCount = 31 },
  (value) => { value.executionActions.failedDenoiserCheckpointReadOrLoad = true },
  (value) => { value.executionActions.moreThanOneOptimizerStep = true },
  (value) => { value.executionActions.modelSmoke = true },
  (value) => { value.executionActions.formalStage0Training = true },
  (value) => { value.executionActions.checkpointPromotion = true },
  (value) => { value.executionActions.reviewThresholdChange = true },
  (value) => { value.executionActions.automaticRetry = true },
  (value) => { delete value.bindings.trainer },
  (value) => { value.bindings.model.sha256 = "bad" },
  (value) => { value.execution.maximumExecutions = 2 },
  (value) => { value.execution.consumeBeforeFirstEvidenceWrite = false },
  (value) => { value.failurePolicy.automaticRetry = true },
  (value) => { value.requestId = "owner-authorized-stage4-object-visible-structure-phase0-gpu-execution-20260815-054500000"; value.commandRef = value.requestId },
  (value) => { value.execution.runId = "historical-phase0" },
  (value) => { value.execution.consumptionPath = "historical" },
  (value) => { value.execution.outputDirectory = "historical" },
]
let positivePassed = 0
for (const test of positives) { test(); positivePassed += 1 }
let negativePassed = 0
for (const mutate of mutations) { const value = structuredClone(fixture); mutate(value); assert.throws(() => validateGpuAuthorizationDocument(value)); negativePassed += 1 }
const derivedMutations = [
  (value) => { value.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFieldCount = 31 },
  (value) => { value.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFields.pop() },
  (value) => { value.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFields.reverse() },
  (value) => { value.training.stage4VegetationLuminanceSpatialStructureSupervision = {} },
  (value) => { value.training.stage4ObjectVisibleStructureSupervision.status = "cpu_support_verified_inactive" },
  (value) => { value.training.stage4FailureDiagnostics.semanticMixtureDiagnostics.manifestFields.push("unknown") },
]
for (const mutate of derivedMutations) { const value = structuredClone(compiled); mutate(value); assert.throws(() => validatePhase0DerivedConfig(value, sourceConfig)); negativePassed += 1 }
const lineageMutations = [
  "authorization_request_id",
  "consumption_authorization_sha",
  "consumption_run_id",
  "attestation_status",
  "attestation_trainer_sha",
]
for (const mutation of lineageMutations) { const result = runLineage(mutation); assert.notEqual(result.status, 0, `lineage_mutation_not_rejected:${mutation}`); negativePassed += 1 }
const fullCliMutations = ["fixed_sample_id", "config_path", "dataset_path", "autoencoder_path", "initial_denoiser_checkpoint"]
for (const mutation of fullCliMutations) { const result = runFullCli(mutation); assert.notEqual(result.status, 0, `full_cli_mutation_not_rejected:${mutation}`); negativePassed += 1 }
const controlFlowMutations = ["formal_adapter", "formal_stage_action", "selected_split", "source_validation_bypass", "persistent_dispatch_mode"]
for (const mutation of controlFlowMutations) { const result = runTrainerControlFlow(mutation); assert.notEqual(result.status, 0, `control_flow_mutation_not_rejected:${mutation}`); negativePassed += 1 }

console.log(JSON.stringify({
  schemaVersion: "stage4-object-visible-structure-phase0-derived-diagnostic-registry-correction-cpu-contract-report-v1",
  status: "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction_cpu_contract_passed",
  positivePassed,
  positiveTotal: positives.length,
  negativePassed,
  negativeTotal: mutations.length + derivedMutations.length + lineageMutations.length + fullCliMutations.length + controlFlowMutations.length,
  derivedDiagnosticFieldCount: OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS.length,
  lineageContract: lineageReport,
  fullCliContract: fullCliReport,
  trainerPreModelControlFlowContract: trainerControlFlowReport,
  currentExecution: { gpuUsed: false, cudaInitialized: false, autogradExecuted: false, checkpointRead: false, modelLoaded: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false, validationStarted: false, smokeStarted: false },
}, null, 2))
