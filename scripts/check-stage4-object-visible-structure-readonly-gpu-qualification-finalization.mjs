import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-qualification-finalization-20260815-034500000"
const SCOPE = "one_cpu_only_finalization_and_formal_index_of_completed_four_object_gpu_qualification"
const AUTH_SHA = "c15bcad3cafb8a7e822e0be2f5d08afe27cba464bdb6457052fd4822da93b6f6"
const CONSUMPTION_SHA = "3cc98e65fc85b2fe45f2bcb273d00cd91fa9d98953dc065f164b5b13c4df8d7e"
const CHANNELS = ["footprints", "tree", "rock", "vegetation"]

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(typeof value, "string", "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const clone = (value) => structuredClone(value)

const authorizationPath = resolveProject(arg("--authorization"))
const consumptionPath = resolveProject(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA, "authorization_sha256_changed")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA, "consumption_sha256_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-gpu-qualification-finalization-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.deepEqual(authorization.authorizedTargetPaths, [
  "scripts/finalize-stage4-object-visible-structure-readonly-gpu-qualification.mjs",
  "scripts/check-stage4-object-visible-structure-readonly-gpu-qualification-finalization.mjs",
])
assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
assert.equal(consumption.status, "gpu_qualification_cpu_finalization_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of [
  "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded",
  "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted",
  "smokeStarted",
]) {
  assert.equal(consumption[key], false, `${key}_opened_in_consumption`)
}
for (const [name, binding] of Object.entries(authorization.bindings)) {
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_sha256_changed`)
}

const source = Object.fromEntries(
  Object.entries(authorization.bindings).map(([name, binding]) => [name, read(resolveProject(binding.path))]),
)

function validateEvidence(candidate) {
  const terminal = candidate.gpuTerminal
  const report = candidate.diagnosticReport
  const telemetry = candidate.cudaTelemetry
  const gpuConsumption = candidate.gpuConsumption
  const pythonPreflight = candidate.pythonPreflight
  const resourcePreflight = candidate.resourcePreflight
  const steps = candidate.stepTelemetry.completedSteps ?? []
  const gradients = report.gradientEvidence?.fourObjectVisibleStructure ?? {}
  const metrics = report.diagnosticManifest ?? {}
  return (
    terminal.status === "stage4_four_object_visible_structure_gpu_qualification_passed_closed"
    && report.status === "passed_readonly_stage4_four_object_visible_structure_gpu_gradient_qualification"
    && terminal.reportSha256 === authorization.bindings.diagnosticReport.sha256
    && terminal.cudaTelemetrySha256 === authorization.bindings.cudaTelemetry.sha256
    && gpuConsumption.status === "stage4_object_visible_structure_readonly_gpu_diagnostic_authorization_atomically_consumed"
    && gpuConsumption.oneTimeConsumption === true
    && pythonPreflight.status === "passed_python_preflight_gpu_not_consumed"
    && resourcePreflight.status === "passed_cuda_resource_and_disk_preflight_gpu_not_consumed"
    && report.identity?.sampleId === "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
    && report.identity?.sampleSplit === "validation"
    && report.identity?.seed === 20263722
    && report.identity?.timestep === 999
    && report.identity?.resolution?.width === 256
    && report.identity?.resolution?.height === 192
    && report.identity?.diagnosticManifestMetricCount === 32
    && metrics.fieldCount === 32
    && Array.isArray(metrics.fields)
    && metrics.fields.length === 32
    && Object.keys(metrics.values ?? {}).length === 32
    && CHANNELS.every((name) => gradients[name]?.finiteAndStrictlyNonzero === true)
    && gradients.combined?.finiteAndStrictlyNonzero === true
    && report.integrity?.denoiserStateSha256Before === report.integrity?.denoiserStateSha256After
    && report.integrity?.autoencoderStateSha256Before === report.integrity?.autoencoderStateSha256After
    && report.integrity?.parameterGradFieldsAbsent === true
    && report.autoencoderCheckpointRead === true
    && report.oldDenoiserCheckpointRead === false
    && report.gpuUsed === true
    && report.forwardCompleted === true
    && report.autogradGradCompleted === true
    && report.optimizerCreated === false
    && report.backwardMethodExecuted === false
    && report.modelWeightsModified === false
    && report.checkpointWritten === false
    && report.trainingStarted === false
    && telemetry.deviceIndex === 0
    && telemetry.deviceName === "NVIDIA GeForce RTX 5050"
    && steps.length === 10
    && steps[0]?.code === "gpu_authorization_consumption_validated"
    && steps.at(-1)?.code === "denoiser_and_autoencoder_state_hashes_unchanged"
  )
}

const positive = {
  authorizationSha256Bound: sha(authorizationPath) === AUTH_SHA,
  consumptionSha256Bound: sha(consumptionPath) === CONSUMPTION_SHA,
  exactBindingSetBound: Object.keys(authorization.bindings).length === 8,
  immutableGpuEvidenceValid: validateEvidence(source),
  gpuTerminalPassed: source.gpuTerminal.status === "stage4_four_object_visible_structure_gpu_qualification_passed_closed",
  diagnosticReportPassed: source.diagnosticReport.status === "passed_readonly_stage4_four_object_visible_structure_gpu_gradient_qualification",
  metricCountExact32: source.diagnosticReport.diagnosticManifest.fieldCount === 32,
  fourSeparateGradientsFiniteNonzero: CHANNELS.every(
    (name) => source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure[name].finiteAndStrictlyNonzero === true,
  ),
  combinedGradientFiniteNonzero: source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.combined.finiteAndStrictlyNonzero === true,
  denoiserStateUnchanged: source.diagnosticReport.integrity.denoiserStateSha256Before === source.diagnosticReport.integrity.denoiserStateSha256After,
  autoencoderStateUnchanged: source.diagnosticReport.integrity.autoencoderStateSha256Before === source.diagnosticReport.integrity.autoencoderStateSha256After,
  parameterGradFieldsAbsent: source.diagnosticReport.integrity.parameterGradFieldsAbsent === true,
  noOptimizerBackwardTrainingOrCheckpointWrite: [
    "optimizerCreated", "backwardMethodExecuted", "modelWeightsModified",
    "checkpointWritten", "trainingStarted",
  ].every((key) => source.diagnosticReport[key] === false),
  failedDenoiserNotRead: source.diagnosticReport.oldDenoiserCheckpointRead === false,
  gpuAuthorizationConsumedOnce: source.gpuConsumption.oneTimeConsumption === true,
  preflightsBoundAndPassed: (
    source.pythonPreflight.status === "passed_python_preflight_gpu_not_consumed"
    && source.resourcePreflight.status === "passed_cuda_resource_and_disk_preflight_gpu_not_consumed"
  ),
  tenStepTelemetryComplete: source.stepTelemetry.completedSteps.length === 10,
}

const negativeMutations = {
  rejectWrongTerminalStatus: (x) => { x.gpuTerminal.status = "wrong" },
  rejectWrongReportStatus: (x) => { x.diagnosticReport.status = "wrong" },
  rejectWrongTerminalReportHash: (x) => { x.gpuTerminal.reportSha256 = "0".repeat(64) },
  rejectWrongMetricCount: (x) => { x.diagnosticReport.diagnosticManifest.fieldCount = 31 },
  rejectMissingMetricField: (x) => { x.diagnosticReport.diagnosticManifest.fields.pop() },
  rejectFootprintsZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.footprints.finiteAndStrictlyNonzero = false },
  rejectTreeZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.tree.finiteAndStrictlyNonzero = false },
  rejectRockZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.rock.finiteAndStrictlyNonzero = false },
  rejectVegetationZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.vegetation.finiteAndStrictlyNonzero = false },
  rejectCombinedZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.combined.finiteAndStrictlyNonzero = false },
  rejectDenoiserMutation: (x) => { x.diagnosticReport.integrity.denoiserStateSha256After = "0".repeat(64) },
  rejectAutoencoderMutation: (x) => { x.diagnosticReport.integrity.autoencoderStateSha256After = "0".repeat(64) },
  rejectParameterGradFields: (x) => { x.diagnosticReport.integrity.parameterGradFieldsAbsent = false },
  rejectOptimizer: (x) => { x.diagnosticReport.optimizerCreated = true },
  rejectBackward: (x) => { x.diagnosticReport.backwardMethodExecuted = true },
  rejectTraining: (x) => { x.diagnosticReport.trainingStarted = true },
  rejectFailedDenoiserRead: (x) => { x.diagnosticReport.oldDenoiserCheckpointRead = true },
  rejectMissingStep: (x) => { x.stepTelemetry.completedSteps.pop() },
}
const negative = Object.fromEntries(
  Object.entries(negativeMutations).map(([name, mutation]) => {
    const candidate = clone(source)
    mutation(candidate)
    return [name, validateEvidence(candidate) === false]
  }),
)
const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([key]) => key)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([key]) => key)
const report = {
  schemaVersion: "stage4-object-visible-structure-gpu-qualification-finalization-cpu-contract-report-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0
    ? "gpu_qualification_finalization_cpu_contract_passed"
    : "gpu_qualification_finalization_cpu_contract_failed_closed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter((value) => value === true).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter((value) => value === true).length,
  negativeTotal: Object.keys(negative).length,
  failedPositiveKeys,
  failedNegativeKeys,
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1
