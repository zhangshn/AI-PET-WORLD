import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  AUTHORIZATION_SHA256,
  CONSUMPTION_SHA256,
  buildInactivePhase0Design,
  validateAuthorizationAndConsumption,
  validatePhase0DesignSource,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-design.mjs"

const ROOT = process.cwd()
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.ok(value, "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const read = (value) => JSON.parse(fs.readFileSync(projectFile(value), "utf8"))
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(projectFile(value))).digest("hex")
const clone = (value) => structuredClone(value)

const authorizationPath = arg("--authorization")
const consumptionPath = arg("--consumption")
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256, "authorization_sha256_mismatch")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
validateAuthorizationAndConsumption({ authorization, consumption })

const bindingNames = ["gpuAuthorization", "gpuConsumption", "gpuTerminal", "diagnosticReport", "finalizationReport", "finalizationTerminal"]
assert.deepEqual(Object.keys(authorization.bindings), bindingNames, "binding_set_changed")
for (const name of bindingNames) assert.equal(sha(authorization.bindings[name].path), authorization.bindings[name].sha256, `${name}_binding_changed`)

const source = {
  gpuTerminal: read(authorization.bindings.gpuTerminal.path),
  diagnosticReport: read(authorization.bindings.diagnosticReport.path),
  finalizationReport: read(authorization.bindings.finalizationReport.path),
  finalizationTerminal: read(authorization.bindings.finalizationTerminal.path),
}

const positive = [
  () => validateAuthorizationAndConsumption({ authorization, consumption }),
  () => validatePhase0DesignSource(source),
  () => buildInactivePhase0Design(source),
  () => assert.equal(buildInactivePhase0Design(source).fixedExecutionIdentity.sampleSplit, "validation"),
  () => assert.equal(buildInactivePhase0Design(source).fixedExecutionIdentity.seed, 20263722),
  () => assert.equal(buildInactivePhase0Design(source).fixedExecutionIdentity.timestep, 999),
  () => assert.deepEqual(buildInactivePhase0Design(source).fixedExecutionIdentity.resolution, { width: 256, height: 192 }),
  () => assert.deepEqual(buildInactivePhase0Design(source).fixedExecutionIdentity.requiredBoundarySides, ["west"]),
  () => assert.equal(buildInactivePhase0Design(source).fixedExecutionIdentity.diagnosticManifestMetricCount, 32),
  () => assert.equal(buildInactivePhase0Design(source).updateGates.exactOptimizerSteps, 1),
  () => assert.equal(buildInactivePhase0Design(source).reproducibilityGates.freshProcessCount, 2),
  () => assert.equal(buildInactivePhase0Design(source).reproducibilityGates.pngBytesSha256ExactMatch, true),
  () => assert.equal(buildInactivePhase0Design(source).qualificationBoundary.visualQualityQualificationPerformed, false),
  () => assert.equal(buildInactivePhase0Design(source).qualificationBoundary.smokeAuthorized, false),
  () => assert.equal(buildInactivePhase0Design(source).qualificationBoundary.formalStage0Authorized, false),
  () => assert.equal(Object.values(buildInactivePhase0Design(source).currentExecution).every((value) => value === false), true),
  () => assert.deepEqual(buildInactivePhase0Design(source).fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 }),
]

const mutations = [
  (draft) => { draft.gpuTerminal.status = "failed" },
  (draft) => { draft.diagnosticReport.status = "failed" },
  (draft) => { draft.diagnosticReport.identity.architectureId = "historical_architecture" },
  (draft) => { draft.diagnosticReport.identity.trainingObjectiveContractId = "historical_objective" },
  (draft) => { draft.diagnosticReport.identity.sampleId = "historical_sample" },
  (draft) => { draft.diagnosticReport.identity.sampleSplit = "train" },
  (draft) => { draft.diagnosticReport.identity.seed = 1 },
  (draft) => { draft.diagnosticReport.identity.timestep = 1 },
  (draft) => { draft.diagnosticReport.identity.resolution.width = 512 },
  (draft) => { draft.diagnosticReport.identity.resolution.height = 384 },
  (draft) => { draft.diagnosticReport.identity.requiredBoundarySides = ["south"] },
  (draft) => { draft.diagnosticReport.identity.diagnosticManifestMetricCount = 31 },
  (draft) => { draft.diagnosticReport.diagnosticManifest.fieldCount = 31 },
  (draft) => { draft.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.footprints.finiteAndStrictlyNonzero = false },
  (draft) => { draft.diagnosticReport.gradientEvidence.fourObjectVisibleStructure.combined.denoiserGradientNorm = 0 },
  (draft) => { draft.diagnosticReport.integrity.denoiserStateSha256After = "changed" },
  (draft) => { draft.diagnosticReport.integrity.parameterGradFieldsAbsent = false },
  (draft) => { draft.diagnosticReport.oldDenoiserCheckpointRead = true },
  (draft) => { draft.diagnosticReport.optimizerCreated = true },
  (draft) => { draft.diagnosticReport.backwardMethodExecuted = true },
  (draft) => { draft.diagnosticReport.trainingStarted = true },
  (draft) => { draft.finalizationReport.qualification.status = "failed" },
  (draft) => { draft.finalizationTerminal.fixedTotalProgress.percent = 80 },
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
  assert.throws(() => validatePhase0DesignSource(draft))
  negativePassed += 1
}

console.log(JSON.stringify({
  schemaVersion: "stage4-object-visible-structure-phase0-design-cpu-contract-report-v1",
  status: "stage4_object_visible_structure_phase0_design_cpu_contract_passed",
  positivePassed,
  positiveTotal: positive.length,
  negativePassed,
  negativeTotal: mutations.length,
  currentExecution: {
    gpuUsed: false,
    cudaInitialized: false,
    autogradExecuted: false,
    checkpointReadOrWritten: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightModified: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
  },
}, null, 2))
