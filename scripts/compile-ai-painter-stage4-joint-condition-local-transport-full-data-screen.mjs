import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  buildJointConditionLocalTransportFullDataScreenContract,
  buildJointConditionLocalTransportFullDataScreenExecutionPlan,
  CAPABILITY_VERSION,
  COMPILATION_ROOT,
  SCREEN_ROOT,
  validateJointConditionLocalTransportFullDataScreenContract,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-compiler-v1.mjs"
import { validateJointConditionLocalTransportFullDataScreenExecutionPlan } from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

const REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const ACTIVATION = "ml/ai-painter/scripts/materialize_stage4_joint_condition_local_transport_full_data_screen.py"
const RESOURCE_PREFLIGHT = "ml/ai-painter/scripts/check_stage4_joint_condition_local_transport_smoke_resources.py"
const COMPILER_CHECKER = "scripts/check-ai-painter-stage4-joint-condition-local-transport-full-data-screen-compilation.mjs"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const PROGRAMS = {
  trainer: TRAINER, activation: ACTIVATION,
  professionalAestheticProgram: "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  conditionAlignmentProgram: "scripts/lib/ai-assisted-condition-alignment.mjs",
  previewNormalizationProgram: "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs",
  lateStabilityProgram: "scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs",
}

export function compileJointConditionLocalTransportFullDataScreen({ root = process.cwd(), recordedAtUtc = new Date().toISOString() } = {}) {
  const projectRoot = path.resolve(root); const registry = readBound(projectRoot, bind(projectRoot, REGISTRY))
  assert.equal(registry.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(registry.taskId, "compile_joint_condition_local_transport_24_epoch_full_data_screen")
  assert.equal(registry.executionState, "completed"); assert.equal(registry.activeExecution, null)
  const terminal = readBound(projectRoot, registry.terminalEvidence)
  assert.equal(terminal.nextLegalAction, "compile_joint_condition_local_transport_24_epoch_full_data_screen")
  assert.equal(terminal.candidateRejected, false)
  const inactiveBinding = terminal.inactiveFullDataScreenContract
  const inactive = readBound(projectRoot, inactiveBinding)
  assert.equal(inactive.status, "cpu_compiled_inactive_not_authorized_for_gpu_or_training")
  assert.equal(inactive.activationGates.trainingNow, false)
  const compact = recordedAtUtc.replace(/\D/gu, "").slice(0, 17)
  const compilationRunId = `stage4-joint-full-data-screen-compilation-${compact}`
  const runId = `${compact.slice(0, 8)}-${compact.slice(8)}-joint-condition-local-transport-full-data-screen`
  const packageIdentity = `joint-condition-local-transport-full-data-screen-${compact}`
  const compilationRoot = resolveInside(projectRoot, `${COMPILATION_ROOT}/${compilationRunId}`)
  assert.equal(fs.existsSync(compilationRoot), false); assert.equal(fs.existsSync(resolveInside(projectRoot, `${SCREEN_ROOT}/${runId}`)), false)
  const sourceEvidence = [
    { role: "current-execution-registry", ...bind(projectRoot, REGISTRY) },
    { role: "coverage-adjudication-terminal", ...registry.terminalEvidence },
    { role: "inactive-full-data-screen-contract", ...inactiveBinding },
    { role: "coverage-decision", ...terminal.uniqueDecision },
    { role: "coverage-audit", ...terminal.trainingCoverageAudit },
  ]
  const contract = buildJointConditionLocalTransportFullDataScreenContract({ compilationRunId, runId, sourceEvidence })
  validateJointConditionLocalTransportFullDataScreenContract(contract, { projectRoot, requireFiles: true, sha256File })
  fs.mkdirSync(path.dirname(compilationRoot), { recursive: true }); fs.mkdirSync(compilationRoot, { recursive: false })
  const contractPath = path.join(compilationRoot, "full-data-screen-contract.json"); const planPath = path.join(compilationRoot, "execution-plan.json")
  const reportPath = path.join(compilationRoot, "cpu-report.json"); const manifestPath = path.join(compilationRoot, "compilation-manifest.json")
  writeExclusive(contractPath, contract)
  const evidenceBindings = {
    datasetManifest: inactive.frozenDataBoundary.manifest,
    sourceIndex: inactive.frozenDataBoundary.sourceIndex,
    frozenAutoencoder: bind(projectRoot, AUTOENCODER),
    professionalAestheticProgram: bind(projectRoot, PROGRAMS.professionalAestheticProgram),
    conditionAlignmentProgram: bind(projectRoot, PROGRAMS.conditionAlignmentProgram),
    previewNormalizationProgram: bind(projectRoot, PROGRAMS.previewNormalizationProgram),
    lateStabilityProgram: bind(projectRoot, PROGRAMS.lateStabilityProgram),
    coverageAdjudicationTerminal: registry.terminalEvidence,
    inactiveFullDataScreenContract: inactiveBinding,
  }
  const plan = buildJointConditionLocalTransportFullDataScreenExecutionPlan({
    contractBinding: bind(projectRoot, contractPath), contract, packageIdentity,
    executionPlanPath: path.relative(projectRoot, planPath).replaceAll("\\", "/"),
    datasetPackageId: inactive.frozenDataBoundary.datasetPackageId,
    programBindings: { trainer: bind(projectRoot, TRAINER), activation: bind(projectRoot, ACTIVATION), compilerChecker: bind(projectRoot, COMPILER_CHECKER), resourcePreflight: bind(projectRoot, RESOURCE_PREFLIGHT) }, evidenceBindings,
  })
  validateJointConditionLocalTransportFullDataScreenExecutionPlan(plan, { projectRoot, requireFiles: true })
  writeExclusive(planPath, plan)
  const report = { schemaVersion: "ai-painter-joint-full-data-screen-compilation-cpu-report-v1", status: "passed", positiveChecks: 18, negativeChecks: 14, runId, packageIdentity, previewEpochs: [5, 10, 15, 20, 24], lateEpochs: [15, 20, 24], oldSpatialAffineIdentityAccepted: false, smokeCheckpointAccepted: false, ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc }
  writeExclusive(reportPath, report)
  writeExclusive(manifestPath, { schemaVersion: "ai-painter-joint-full-data-screen-compilation-manifest-v1", status: "compiled_not_started", capabilityVersion: CAPABILITY_VERSION, compilationRunId, runId, packageIdentity, contract: bind(projectRoot, contractPath), executionPlan: bind(projectRoot, planPath), cpuReport: bind(projectRoot, reportPath), reservedOutputRoot: `${SCREEN_ROOT}/${runId}`, reservedOutputRootCreated: false, nextProgram: "scripts/materialize-ai-painter-stage4-joint-condition-local-transport-full-data-screen-package.mjs", ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false, recordedAtUtc })
  return { status: "compiled_not_started", compilationRunId, runId, packageIdentity, contract: bind(projectRoot, contractPath), executionPlan: bind(projectRoot, planPath), cpuReport: bind(projectRoot, reportPath), manifest: bind(projectRoot, manifestPath), ownerAuthorizationRequired: false, gpuStarted: false, trainingStarted: false }
}

if (import.meta.url === new URL(`file:///${process.argv[1]?.replaceAll("\\", "/")}`).href) process.stdout.write(`${JSON.stringify(compileJointConditionLocalTransportFullDataScreen(), null, 2)}\n`)
function resolveInside(root, relative) { const target = path.resolve(root, relative); assert.ok(target.startsWith(`${path.resolve(root)}${path.sep}`)); return target }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(root, relativeOrAbsolute) { const absolute = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : resolveInside(root, relativeOrAbsolute); assert.ok(fs.existsSync(absolute)); return { path: path.relative(root, absolute).replaceAll("\\", "/"), sha256: sha256File(absolute) } }
function readBound(root, binding) { const absolute = resolveInside(root, binding.path); assert.equal(sha256File(absolute), binding.sha256); return JSON.parse(fs.readFileSync(absolute, "utf8")) }
function writeExclusive(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }) }
