import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  AUTHORIZATION_SHA256,
  CONSUMPTION_SHA256,
  FIXED_IDENTITY,
  buildInactivePhase0Design,
  validateAuthorizationAndConsumption,
  validatePhase0DesignSource,
} from "./lib/ai-painter-stage4-object-reference-multiscale-phase0-design.mjs"

const ROOT = process.cwd()
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(typeof value, "string", "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(projectFile(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(projectFile(value), "utf8"))
const clone = (value) => structuredClone(value)
const rejects = (fn) => {
  try { fn(); return false } catch { return true }
}

const authorizationPath = arg("--authorization")
const consumptionPath = arg("--consumption")
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256, "authorization_sha256_mismatch")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
validateAuthorizationAndConsumption({ authorization, consumption })

const bindingNames = [
  "gpuAuthorization", "gpuConsumption", "gpuTerminal", "diagnosticReport",
  "finalizationReport", "finalizationTerminal",
]
assert.deepEqual(Object.keys(authorization.bindings), bindingNames, "binding_set_changed")
for (const name of bindingNames) {
  assert.equal(sha(authorization.bindings[name].path), authorization.bindings[name].sha256, `${name}_binding_changed`)
}
const source = {
  gpuTerminal: read(authorization.bindings.gpuTerminal.path),
  diagnosticReport: read(authorization.bindings.diagnosticReport.path),
  finalizationReport: read(authorization.bindings.finalizationReport.path),
  finalizationTerminal: read(authorization.bindings.finalizationTerminal.path),
}
validatePhase0DesignSource(source)
const design = buildInactivePhase0Design(source)

const positive = {
  authorizationAndConsumptionValid: true,
  exactSixBindingsValid: bindingNames.every(
    (name) => sha(authorization.bindings[name].path) === authorization.bindings[name].sha256,
  ),
  sourceGpuQualificationAndFinalizationValid: validatePhase0DesignSource(source),
  designInactive: design.currentExecution.contractActive === false,
  fixedIdentityExact: JSON.stringify(design.fixedExecutionIdentity) === JSON.stringify(FIXED_IDENTITY),
  exact48MetricGateDesigned: design.updateGates.exactDiagnosticManifestMetricCount === 48,
  fourObjectMultiscaleGradientGateDesigned: design.updateGates.fourObjectMultiscaleGradientsFiniteAndStrictlyNonzeroBeforeStep === true,
  matchingExpertGradientGateDesigned: design.updateGates.fourMatchingExpertGradientsFiniteAndStrictlyNonzeroBeforeStep === true,
  combinedGradientGateDesigned: design.updateGates.combinedGradientFiniteAndStrictlyNonzeroBeforeStep === true,
  exactlyOneUpdateDesigned: design.updateGates.exactOptimizerSteps === 1 && design.updateGates.exactBackwardCalls === 1,
  failedCheckpointReadForbidden: design.updateGates.oldFailedDenoiserCheckpointReadForbidden === true,
  twoFreshProcessesRequired: design.reproducibilityGates.freshProcessCount === 2,
  byteExactPreviewRequired: design.reproducibilityGates.pngBytesSha256ExactMatch === true,
  visualQualificationNotGranted: design.qualificationBoundary.visualQualityQualificationPerformed === false,
  noSmokeOrStageAuthorized: [
    design.qualificationBoundary.smokeAuthorized,
    design.qualificationBoundary.formalStage0Authorized,
    design.qualificationBoundary.stage1Authorized,
    design.qualificationBoundary.stage2Authorized,
  ].every((value) => value === false),
  noRuntimeCapabilityOpened: Object.values(design.currentExecution).every((value) => value === false),
}

const authorizationNegative = {
  rejectWrongRequestId: (x) => { x.authorization.requestId = "wrong" },
  rejectWrongCommandRef: (x) => { x.authorization.commandRef = "wrong" },
  rejectWrongScope: (x) => { x.authorization.scope = "wrong" },
  rejectExpandedAction: (x) => { x.authorization.permittedActions.push("training") },
  rejectMissingForbiddenAction: (x) => { x.authorization.forbiddenActions.pop() },
  rejectWrongConsumptionStatus: (x) => { x.consumption.status = "wrong" },
  rejectReusableConsumption: (x) => { x.consumption.oneTimeConsumption = false },
  rejectGpuOpenedInConsumption: (x) => { x.consumption.gpuUsed = true },
  rejectCheckpointOpenedInConsumption: (x) => { x.consumption.checkpointRead = true },
}
const sourceNegative = {
  rejectWrongGpuTerminalStatus: (x) => { x.source.gpuTerminal.status = "wrong" },
  rejectWrongDiagnosticStatus: (x) => { x.source.diagnosticReport.status = "wrong" },
  rejectWrongObjective: (x) => { x.source.diagnosticReport.identity.trainingObjectiveContractId = "wrong" },
  rejectWrongSample: (x) => { x.source.diagnosticReport.identity.sampleId = "wrong" },
  rejectWrongSplit: (x) => { x.source.diagnosticReport.identity.sampleSplit = "train" },
  rejectWrongSeed: (x) => { x.source.diagnosticReport.identity.seed = 1 },
  rejectWrongScale: (x) => { x.source.diagnosticReport.identity.pyramidScales[1] = 0.75 },
  rejectWrongMetricCount: (x) => { x.source.diagnosticReport.diagnosticManifest.fieldCount = 47 },
  rejectMissingMetric: (x) => { x.source.diagnosticReport.diagnosticManifest.fields.pop() },
  rejectFootprintsZeroGradient: (x) => { x.source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.footprints.finiteAndStrictlyNonzero = false },
  rejectTreeMatchingExpertZero: (x) => { x.source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.tree.matchingSemanticMixtureExpertGradientNorm = 0 },
  rejectCombinedZeroGradient: (x) => { x.source.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.combined.denoiserGradientNorm = 0 },
  rejectDenoiserMutation: (x) => { x.source.diagnosticReport.integrity.denoiserStateSha256After = "0".repeat(64) },
  rejectAutoencoderMutation: (x) => { x.source.diagnosticReport.integrity.autoencoderStateSha256After = "0".repeat(64) },
  rejectParameterGradFields: (x) => { x.source.diagnosticReport.integrity.parameterGradFieldsAbsent = false },
  rejectFailedDenoiserRead: (x) => { x.source.diagnosticReport.oldDenoiserCheckpointRead = true },
  rejectOptimizer: (x) => { x.source.diagnosticReport.optimizerCreated = true },
  rejectBackward: (x) => { x.source.diagnosticReport.backwardMethodExecuted = true },
  rejectTraining: (x) => { x.source.diagnosticReport.trainingStarted = true },
  rejectFinalizationStatus: (x) => { x.source.finalizationReport.status = "wrong" },
  rejectFinalizationMetricCount: (x) => { x.source.finalizationReport.qualification.diagnosticManifestMetricCount = 47 },
  rejectFinalizationTerminalStatus: (x) => { x.source.finalizationTerminal.status = "wrong" },
  rejectProgressPromotion: (x) => { x.source.finalizationTerminal.fixedTotalProgress.percent = 80 },
}
const negative = {}
for (const [name, mutate] of Object.entries(authorizationNegative)) {
  const candidate = { authorization: clone(authorization), consumption: clone(consumption) }
  mutate(candidate)
  negative[name] = rejects(() => validateAuthorizationAndConsumption(candidate))
}
for (const [name, mutate] of Object.entries(sourceNegative)) {
  const candidate = { source: clone(source) }
  mutate(candidate)
  negative[name] = rejects(() => validatePhase0DesignSource(candidate.source))
}

const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([name]) => name)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([name]) => name)
const report = {
  schemaVersion: "stage4-object-reference-multiscale-phase0-design-cpu-contract-report-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0
    ? "stage4_object_reference_multiscale_phase0_design_cpu_contract_passed"
    : "stage4_object_reference_multiscale_phase0_design_cpu_contract_failed_closed",
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
  optimizerCreatedNow: false,
  backwardExecutedNow: false,
  trainingStartedNow: false,
  validationStartedNow: false,
  smokeStartedNow: false,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1
