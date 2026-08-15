import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-20260815-211500000"
const SCOPE = "one_cpu_only_continuation_and_formal_index_of_completed_early_convergence_gpu_qualification"
const AUTH_SHA = "fb2ccea257166dbd070d29304c019ffbc69a38ba4472915d5fb69298274579c6"
const CONSUMPTION_SHA = "3afe8150fe62df2d49627e10ca9c5e5e017241ce75a11bff70d0ea793b844b95"
const CHANNELS = ["footprints", "tree", "rock", "vegetation"]
const TARGETS = [
  "scripts/finalize-stage4-object-reference-multiscale-early-convergence-readonly-gpu-qualification.mjs",
  "scripts/check-stage4-object-reference-multiscale-early-convergence-readonly-gpu-qualification-finalization.mjs",
]

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
assert.equal(
  authorization.schemaVersion,
  "ai-painter-owner-stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-v1",
)
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.deepEqual(authorization.authorizedTargetPaths, TARGETS)
assert.equal(authorization.execution.consumeBeforeFirstContinuationEvidenceWrite, true)
assert.equal(
  consumption.status,
  "early_convergence_gpu_qualification_cpu_continuation_authorization_atomically_consumed",
)
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of [
  "gpuUsed", "cudaInitialized", "autogradUsed", "checkpointReadOrLoaded", "modelLoaded",
  "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted",
  "stage0OrStage1OrStage2Started",
]) assert.equal(consumption[key], false, `${key}_opened_in_consumption`)
assert.deepEqual(Object.keys(authorization.bindings), [
  "gpuAuthorization", "gpuConsumption", "gpuTerminal", "diagnosticReport", "cudaTelemetry",
])
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
  const gradients = report.gradientEvidence?.fourObjectVisibleStructure ?? {}
  const twoLane = report.gradientEvidence?.twoLaneEarlyConvergenceStabilization ?? {}
  const metrics = report.diagnosticManifest ?? {}
  const steps = report.completedSteps ?? []
  return (
    terminal.status === "stage4_two_lane_early_convergence_gpu_qualification_passed_closed"
    && report.status === "passed_readonly_stage4_two_lane_early_convergence_gpu_gradient_qualification"
    && terminal.reportSha256 === authorization.bindings.diagnosticReport.sha256
    && terminal.cudaTelemetrySha256 === authorization.bindings.cudaTelemetry.sha256
    && terminal.blockers?.length === 0
    && terminal.automaticRetryStarted === false
    && gpuConsumption.status === "stage4_object_reference_multiscale_readonly_gpu_diagnostic_authorization_atomically_consumed"
    && gpuConsumption.authorizationSha256 === authorization.bindings.gpuAuthorization.sha256
    && gpuConsumption.oneTimeConsumption === true
    && gpuConsumption.optimizerAuthorized === false
    && gpuConsumption.backwardMethodAuthorized === false
    && gpuConsumption.modelWeightModificationAuthorized === false
    && gpuConsumption.checkpointWriteAuthorized === false
    && gpuConsumption.trainingAuthorized === false
    && gpuConsumption.automaticRetryAuthorized === false
    && report.identity?.trainingObjectiveContractId === "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
    && report.identity?.sampleId === "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
    && report.identity?.sampleSplit === "validation"
    && report.identity?.seed === 20263722
    && report.identity?.timestep === 999
    && report.identity?.resolution?.width === 256
    && report.identity?.resolution?.height === 192
    && report.identity?.replayLaneCount === 2
    && report.identity?.diagnosticManifestMetricCount === 48
    && metrics.fieldCount === 48
    && Array.isArray(metrics.fields)
    && metrics.fields.length === 48
    && Object.keys(metrics.values ?? {}).length === 48
    && CHANNELS.every((name) => (
      gradients[name]?.finiteAndStrictlyNonzero === true
      && Number.isFinite(gradients[name]?.denoiserGradientNorm)
      && gradients[name].denoiserGradientNorm > 0
      && Number.isFinite(gradients[name]?.matchingSemanticMixtureExpertGradientNorm)
      && gradients[name].matchingSemanticMixtureExpertGradientNorm > 0
      && Object.keys(gradients[name]?.multiscaleComponentMetrics ?? {}).length === 4
    ))
    && gradients.combined?.finiteAndStrictlyNonzero === true
    && Number.isFinite(gradients.combined?.denoiserGradientNorm)
    && gradients.combined.denoiserGradientNorm > 0
    && twoLane.contractStatusDuringQualification === "cpu_support_verified_inactive"
    && twoLane.selectedGlobalWorstClassIndex === 0
    && Number.isFinite(twoLane.lane1DenoiserGradientNorm)
    && twoLane.lane1DenoiserGradientNorm > 0
    && Number.isFinite(twoLane.lane2DenoiserGradientNorm)
    && twoLane.lane2DenoiserGradientNorm > 0
    && Number.isFinite(twoLane.combinedTwoLaneDenoiserGradientNorm)
    && twoLane.combinedTwoLaneDenoiserGradientNorm > 0
    && twoLane.replayPassesAdded === 0
    && twoLane.optimizerCreated === false
    && twoLane.backwardMethodExecuted === false
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
    && telemetry.status === "collected_after_readonly_forward_and_autograd_grad"
    && telemetry.deviceIndex === 0
    && telemetry.deviceName === "NVIDIA GeForce RTX 5050"
    && steps.length === 11
    && steps[0]?.code === "gpu_authorization_consumption_validated"
    && steps[6]?.code === "two_lane_early_convergence_gradient_routes_verified"
    && steps.at(-1)?.code === "denoiser_and_autoencoder_state_hashes_unchanged"
  )
}

const four = source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure
const twoLane = source.diagnosticReport.gradientEvidence.twoLaneEarlyConvergenceStabilization
const positive = {
  authorizationSha256Bound: sha(authorizationPath) === AUTH_SHA,
  consumptionSha256Bound: sha(consumptionPath) === CONSUMPTION_SHA,
  exactBindingSetBound: Object.keys(authorization.bindings).length === 5,
  immutableGpuEvidenceValid: validateEvidence(source),
  gpuTerminalPassed: source.gpuTerminal.status === "stage4_two_lane_early_convergence_gpu_qualification_passed_closed",
  diagnosticReportPassed: source.diagnosticReport.status === "passed_readonly_stage4_two_lane_early_convergence_gpu_gradient_qualification",
  metricCountExact48: source.diagnosticReport.diagnosticManifest.fieldCount === 48,
  fourSeparateGradientsFiniteNonzero: CHANNELS.every((name) => four[name].finiteAndStrictlyNonzero === true),
  matchingExpertGradientsFiniteNonzero: CHANNELS.every((name) => four[name].matchingSemanticMixtureExpertGradientNorm > 0),
  combinedObjectGradientFiniteNonzero: four.combined.finiteAndStrictlyNonzero === true,
  lane1GradientFiniteNonzero: twoLane.lane1DenoiserGradientNorm > 0,
  lane2GradientFiniteNonzero: twoLane.lane2DenoiserGradientNorm > 0,
  combinedTwoLaneGradientFiniteNonzero: twoLane.combinedTwoLaneDenoiserGradientNorm > 0,
  noReplayOptimizerOrBackward: twoLane.replayPassesAdded === 0 && twoLane.optimizerCreated === false && twoLane.backwardMethodExecuted === false,
  denoiserStateUnchanged: source.diagnosticReport.integrity.denoiserStateSha256Before === source.diagnosticReport.integrity.denoiserStateSha256After,
  autoencoderStateUnchanged: source.diagnosticReport.integrity.autoencoderStateSha256Before === source.diagnosticReport.integrity.autoencoderStateSha256After,
  parameterGradFieldsAbsent: source.diagnosticReport.integrity.parameterGradFieldsAbsent === true,
  noOptimizerBackwardTrainingOrCheckpointWrite: [
    "optimizerCreated", "backwardMethodExecuted", "modelWeightsModified", "checkpointWritten", "trainingStarted",
  ].every((key) => source.diagnosticReport[key] === false),
  failedDenoiserNotRead: source.diagnosticReport.oldDenoiserCheckpointRead === false,
  gpuAuthorizationConsumedOnce: source.gpuConsumption.oneTimeConsumption === true,
  elevenCompletedStepsPresent: source.diagnosticReport.completedSteps.length === 11,
}

const negativeMutations = {
  rejectWrongTerminalStatus: (x) => { x.gpuTerminal.status = "wrong" },
  rejectWrongReportStatus: (x) => { x.diagnosticReport.status = "wrong" },
  rejectWrongTerminalReportHash: (x) => { x.gpuTerminal.reportSha256 = "0".repeat(64) },
  rejectWrongTerminalTelemetryHash: (x) => { x.gpuTerminal.cudaTelemetrySha256 = "0".repeat(64) },
  rejectBlocker: (x) => { x.gpuTerminal.blockers.push("blocked") },
  rejectWrongObjective: (x) => { x.diagnosticReport.identity.trainingObjectiveContractId = "wrong" },
  rejectWrongReplayLaneCount: (x) => { x.diagnosticReport.identity.replayLaneCount = 1 },
  rejectWrongMetricCount: (x) => { x.diagnosticReport.diagnosticManifest.fieldCount = 47 },
  rejectMissingMetricField: (x) => { x.diagnosticReport.diagnosticManifest.fields.pop() },
  rejectFootprintsZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.footprints.finiteAndStrictlyNonzero = false },
  rejectTreeZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.tree.finiteAndStrictlyNonzero = false },
  rejectRockZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.rock.finiteAndStrictlyNonzero = false },
  rejectVegetationZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.vegetation.finiteAndStrictlyNonzero = false },
  rejectMatchingExpertZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.tree.matchingSemanticMixtureExpertGradientNorm = 0 },
  rejectCombinedObjectZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.combined.denoiserGradientNorm = 0 },
  rejectLane1ZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.twoLaneEarlyConvergenceStabilization.lane1DenoiserGradientNorm = 0 },
  rejectLane2ZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.twoLaneEarlyConvergenceStabilization.lane2DenoiserGradientNorm = 0 },
  rejectCombinedTwoLaneZeroGradient: (x) => { x.diagnosticReport.gradientEvidence.twoLaneEarlyConvergenceStabilization.combinedTwoLaneDenoiserGradientNorm = 0 },
  rejectReplayPassAdded: (x) => { x.diagnosticReport.gradientEvidence.twoLaneEarlyConvergenceStabilization.replayPassesAdded = 1 },
  rejectDenoiserMutation: (x) => { x.diagnosticReport.integrity.denoiserStateSha256After = "0".repeat(64) },
  rejectAutoencoderMutation: (x) => { x.diagnosticReport.integrity.autoencoderStateSha256After = "0".repeat(64) },
  rejectParameterGradFields: (x) => { x.diagnosticReport.integrity.parameterGradFieldsAbsent = false },
  rejectOptimizer: (x) => { x.diagnosticReport.optimizerCreated = true },
  rejectBackward: (x) => { x.diagnosticReport.backwardMethodExecuted = true },
  rejectTraining: (x) => { x.diagnosticReport.trainingStarted = true },
  rejectFailedDenoiserRead: (x) => { x.diagnosticReport.oldDenoiserCheckpointRead = true },
  rejectMissingStep: (x) => { x.diagnosticReport.completedSteps.pop() },
  rejectWrongTelemetryDevice: (x) => { x.cudaTelemetry.deviceIndex = 1 },
  rejectReusableGpuAuthorization: (x) => { x.gpuConsumption.oneTimeConsumption = false },
}
const negative = Object.fromEntries(Object.entries(negativeMutations).map(([name, mutation]) => {
  const candidate = clone(source)
  mutation(candidate)
  return [name, validateEvidence(candidate) === false]
}))
const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([key]) => key)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([key]) => key)
const report = {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-gpu-qualification-finalization-cpu-contract-report-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0
    ? "early_convergence_gpu_qualification_finalization_cpu_contract_passed"
    : "early_convergence_gpu_qualification_finalization_cpu_contract_failed_closed",
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
  autogradExecutedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1
