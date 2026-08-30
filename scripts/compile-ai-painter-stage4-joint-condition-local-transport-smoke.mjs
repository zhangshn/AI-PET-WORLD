import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  buildJointConditionLocalTransportControlledSmokeContract,
  buildJointConditionLocalTransportSmokeExecutionPlan,
  CAPABILITY_VERSION,
  COMPILATION_ROOT,
  CONTROLLED_SMOKE_ROOT,
  FROZEN_AUTOENCODER_SHA256,
  validateJointConditionLocalTransportControlledSmokeContract,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-compiler-v1.mjs"
import { validateJointConditionLocalTransportSmokeExecutionPlan } from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"

const CURRENT_REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
const COMPILER_LIBRARY = "scripts/lib/ai-painter-stage4-joint-condition-local-transport-smoke-compiler-v1.mjs"
const COMPILER = "scripts/compile-ai-painter-stage4-joint-condition-local-transport-smoke.mjs"
const COMPILER_CHECKER = "scripts/check-ai-painter-stage4-joint-condition-local-transport-smoke-compilation.mjs"
const ADAPTER = "scripts/lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"
const PACKAGE_MATERIALIZER = "scripts/materialize-ai-painter-stage4-joint-condition-local-transport-smoke-package.mjs"
const ACTIVATION_MATERIALIZER = "ml/ai-painter/scripts/materialize_stage4_joint_condition_local_transport_controlled_smoke.py"
const RESOURCE_PREFLIGHT = "ml/ai-painter/scripts/check_stage4_joint_condition_local_transport_smoke_resources.py"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"

const CODE_ROLES = Object.freeze({
  "model-factory": "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "mode-registry": "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  "authorization-policy": "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  "joint-transport-contract": "ml/ai-painter/scripts/ai_painter_joint_condition_local_transport_contract.py",
  trainer: TRAINER,
  "activation-materializer": ACTIVATION_MATERIALIZER,
  "resource-preflight": RESOURCE_PREFLIGHT,
  "closed-loop-core": "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
  "closed-loop-package-materializer": "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs",
  "joint-smoke-adapter": ADAPTER,
  "joint-smoke-package-materializer": PACKAGE_MATERIALIZER,
  "joint-smoke-compiler-library": COMPILER_LIBRARY,
  "joint-smoke-compiler": COMPILER,
  "joint-smoke-compiler-checker": COMPILER_CHECKER,
  "professional-aesthetic-program": "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  "condition-alignment-program": "scripts/lib/ai-assisted-condition-alignment.mjs",
  "preview-normalization-program": "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs",
  "late-stability-program": "scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs",
})

export function compileJointConditionLocalTransportSmoke({
  root = process.cwd(),
  recordedAtUtc = new Date().toISOString(),
  randomHex = crypto.randomBytes(4).toString("hex"),
} = {}) {
  const projectRoot = path.resolve(root)
  const source = loadAuthoritativeSource(projectRoot)
  const identities = newIdentities(recordedAtUtc, randomHex)
  const compilationRoot = resolveInside(projectRoot, `${COMPILATION_ROOT}/${identities.compilationRunId}`)
  const controlledSmokeRoot = resolveInside(projectRoot, `${CONTROLLED_SMOKE_ROOT}/${identities.runId}`)
  assert.equal(fs.existsSync(compilationRoot), false, "compilation runId already exists")
  assert.equal(fs.existsSync(controlledSmokeRoot), false, "reserved Smoke output root already exists")

  const sourceEvidence = buildSourceEvidence(projectRoot, source)
  const contract = buildJointConditionLocalTransportControlledSmokeContract({
    compilationRunId: identities.compilationRunId,
    runId: identities.runId,
    sourceEvidence,
  })
  validateJointConditionLocalTransportControlledSmokeContract(contract, {
    projectRoot, requireFiles: true, sha256File,
  })

  fs.mkdirSync(resolveInside(projectRoot, COMPILATION_ROOT), { recursive: true })
  fs.mkdirSync(compilationRoot, { recursive: false })
  const contractPath = path.join(compilationRoot, "controlled-smoke-contract.json")
  const planPath = path.join(compilationRoot, "execution-plan.json")
  const cpuReportPath = path.join(compilationRoot, "cpu-report.json")
  const manifestPath = path.join(compilationRoot, "compilation-manifest.json")
  writeJsonExclusive(contractPath, contract)
  const contractBinding = bind(projectRoot, contractPath)

  const executionPlanRelative = projectPath(projectRoot, planPath)
  const evidenceBindings = {
    compiledSmokeContract: contractBinding,
    datasetManifest: source.approvedDataset.manifest,
    sourceIndex: source.approvedDataset.sourceIndex,
    frozenAutoencoder: source.autoencoderCheckpoint,
    readonlyGpuTerminal: source.readonlyTerminalBinding,
    readonlyGpuReport: source.readonlyReportBinding,
    professionalAestheticProgram: bindRole(projectRoot, CODE_ROLES["professional-aesthetic-program"]),
    conditionAlignmentProgram: bindRole(projectRoot, CODE_ROLES["condition-alignment-program"]),
    previewNormalizationProgram: bindRole(projectRoot, CODE_ROLES["preview-normalization-program"]),
    lateStabilityProgram: bindRole(projectRoot, CODE_ROLES["late-stability-program"]),
  }
  const programs = {
    compilerChecker: bindRole(projectRoot, COMPILER_CHECKER),
    activationMaterializer: bindRole(projectRoot, ACTIVATION_MATERIALIZER),
    resourcePreflight: bindRole(projectRoot, RESOURCE_PREFLIGHT),
    trainer: bindRole(projectRoot, TRAINER),
  }
  const plan = buildJointConditionLocalTransportSmokeExecutionPlan({
    packageIdentity: identities.packageIdentity,
    runId: identities.runId,
    executionPlanPath: executionPlanRelative,
    compiledContractBinding: contractBinding,
    datasetPackageId: source.datasetPackageId,
    evidenceBindings,
    programs,
  })
  validateJointConditionLocalTransportSmokeExecutionPlan(plan, {
    projectRoot, requireFiles: true,
  })
  assert.equal(fs.existsSync(controlledSmokeRoot), false, "plan compilation created the Smoke output root")
  writeJsonExclusive(planPath, plan)

  const checkerOutput = execFileSync(process.execPath, [
    resolveInside(projectRoot, COMPILER_CHECKER),
    "--plan", executionPlanRelative,
    "--mode", "compilation",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  const cpuReport = JSON.parse(checkerOutput)
  assert.equal(cpuReport.status, "passed", "formal Smoke compilation CPU checker failed")
  writeJsonExclusive(cpuReportPath, {
    ...cpuReport,
    schemaVersion: "stage4-joint-condition-local-transport-smoke-compilation-cpu-report-v1",
    compilationRunId: identities.compilationRunId,
    runId: identities.runId,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  assert.equal(fs.existsSync(controlledSmokeRoot), false, "CPU checker created the Smoke output root")

  const manifest = {
    schemaVersion: "stage4-joint-condition-local-transport-smoke-compilation-manifest-v1",
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    compilationRunId: identities.compilationRunId,
    packageIdentity: identities.packageIdentity,
    runId: identities.runId,
    controlledSmokeOutputRoot: projectPath(projectRoot, controlledSmokeRoot),
    controlledSmokeOutputRootCreated: false,
    compiledContract: contractBinding,
    executionPlan: bind(projectRoot, planPath),
    cpuReport: bind(projectRoot, cpuReportPath),
    sourceRegistry: source.currentRegistryBinding,
    sourceReadonlyGpuTerminal: source.readonlyTerminalBinding,
    sourceReadonlyGpuReport: source.readonlyReportBinding,
    sourceEvidenceSha256: sha256(Buffer.from(JSON.stringify(sourceEvidence))),
    nextProgram: {
      path: PACKAGE_MATERIALIZER,
      arguments: ["--plan", executionPlanRelative],
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    recordedAtUtc,
  }
  writeJsonExclusive(manifestPath, manifest)
  assert.equal(fs.existsSync(controlledSmokeRoot), false, "compiler created the Smoke output root")
  return {
    status: "compiled_not_started",
    capabilityVersion: CAPABILITY_VERSION,
    compilationRunId: identities.compilationRunId,
    packageIdentity: identities.packageIdentity,
    runId: identities.runId,
    compiledContract: contractBinding,
    executionPlan: bind(projectRoot, planPath),
    cpuReport: bind(projectRoot, cpuReportPath),
    compilationManifest: bind(projectRoot, manifestPath),
    controlledSmokeOutputRoot: projectPath(projectRoot, controlledSmokeRoot),
    controlledSmokeOutputRootCreated: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  }
}

function loadAuthoritativeSource(projectRoot) {
  const currentRegistryBinding = bindRole(projectRoot, CURRENT_REGISTRY)
  const registry = readJson(resolveInside(projectRoot, currentRegistryBinding.path))
  assert.equal(registry.schemaVersion, "ai-painter-current-execution-registry-v1")
  assert.equal(registry.registryRevision, registry.eventSequence)
  assert.equal(registry.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(registry.taskId, "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke")
  assert.equal(registry.taskKind, "controlled_smoke_compilation_and_execution")
  assert.equal(registry.lifecycleStage, "joint_condition_local_transport_readonly_gpu_qualified")
  assert.equal(registry.executionState, "completed")
  assert.equal(registry.activity, "joint_condition_local_transport_controlled_smoke_pending")
  assert.equal(registry.activeExecution, null)

  const readonlyTerminalBinding = bindingFromRecord(projectRoot, registry.terminalEvidence, "readonly terminal")
  const terminal = readJson(resolveInside(projectRoot, readonlyTerminalBinding.path))
  assert.equal(terminal.schemaVersion, "stage4-joint-condition-local-transport-readonly-gpu-terminal-v1")
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, "stage4_joint_condition_local_transport_readonly_gpu_qualification_succeeded")
  assert.equal(terminal.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(terminal.runId, registry.runId)
  assert.equal(terminal.nextLegalAction, "compile_and_execute_stage4_joint_condition_local_transport_controlled_smoke")
  assert.equal(terminal.ownerAuthorizationRequired, false)
  assert.equal(terminal.ownerResponseRequired, false)
  for (const key of ["optimizerCreated", "backwardExecuted", "modelWeightsModified", "checkpointWritten", "trainingStarted"]) {
    assert.equal(terminal[key], false, `readonly terminal changed: ${key}`)
  }

  const readonlyReportBinding = bindingFromRecord(projectRoot, terminal.qualificationReport, "readonly report")
  const report = readJson(resolveInside(projectRoot, readonlyReportBinding.path))
  assert.equal(report.schemaVersion, "stage4-joint-condition-local-transport-readonly-gpu-qualification-report-v1")
  assert.equal(report.status, "passed")
  assert.equal(report.runId, terminal.runId)
  assert.equal(report.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(report.measured?.conditionChannelsFiniteNonzero, 23)
  assert.equal(report.measured?.transportParameterTensorsFiniteNonzero, 24)
  assert.equal(report.measured?.transportParameterCount, 22464)
  assert.equal(report.measured?.firstFormalTrainRecordQualified, true)
  assert.equal(report.measured?.fixedValidationSample194Qualified, true)
  for (const key of ["denoiserCheckpointRead", "historicalDenoiserCheckpointRead", "failedDenoiserCheckpointRead", "optimizerCreated", "backwardExecuted", "weightsModified", "checkpointWritten", "trainingStarted"]) {
    assert.equal(report.safety?.[key], false, `readonly safety changed: ${key}`)
  }
  const activeConfigBinding = bindingFromRecord(projectRoot, report.activeConfig, "readonly active config")
  const activeConfig = readJson(resolveInside(projectRoot, activeConfigBinding.path))
  assert.equal(activeConfig.schemaVersion, "ai-painter-stage4-joint-condition-local-transport-readonly-gpu-config-v1")
  assert.equal(activeConfig.architectureId, CAPABILITY_VERSION)
  assert.equal(activeConfig.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(activeConfig.executionIdentity?.runId, terminal.runId)
  const evidence = activeConfig.evidenceBindings
  assert.ok(evidence && typeof evidence === "object")
  const formalBinding = bindingFromRecord(projectRoot, evidence.formalObjectiveContract, "formal objective")
  const formal = readJson(resolveInside(projectRoot, formalBinding.path))
  const data = formal.data
  const model = formal.modelBoundary
  assert.deepEqual(data.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(model.autoencoderCheckpointSha256, FROZEN_AUTOENCODER_SHA256)
  const approvedDataset = {
    manifest: bindingFromRecord(projectRoot, evidence.approvedDataset?.manifest, "dataset manifest"),
    sourceIndex: bindingFromRecord(projectRoot, evidence.approvedDataset?.sourceIndex, "source index"),
  }
  assert.equal(evidence.approvedDataset?.datasetPackageId, data.datasetPackageId)
  assert.deepEqual(evidence.approvedDataset?.splitCounts, data.splitCounts)
  assert.equal(approvedDataset.manifest.path, data.datasetManifestPath)
  assert.equal(approvedDataset.manifest.sha256, data.datasetManifestSha256)
  assert.equal(approvedDataset.sourceIndex.path, data.sourceIndexPath)
  assert.equal(approvedDataset.sourceIndex.sha256, data.sourceIndexSha256)
  const datasetManifest = readJson(resolveInside(projectRoot, approvedDataset.manifest.path))
  assert.equal(datasetManifest.packageId, data.datasetPackageId)
  assert.equal(datasetManifest.immutable, true)
  assert.equal(datasetManifest.v7CapacityContributionCount, 64)
  assert.equal(datasetManifest.sourceIndexPath, approvedDataset.sourceIndex.path)
  const sourceIndex = readJson(resolveInside(projectRoot, approvedDataset.sourceIndex.path))
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.ok(Array.isArray(sourceIndex.samples))
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length)
  const approved = sourceIndex.samples.filter((row) => row.v7CapacityContributionRegistered === true)
  assert.equal(approved.length, 64)
  assert.deepEqual(Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [
    split, approved.filter((row) => row.split === split).length,
  ])), data.splitCounts)
  assert.equal(new Set(approved.map((row) => row.recordId)).size, 64)

  const firstTrain = verifiedQualificationSample(projectRoot, evidence.qualificationSamples?.firstTrain, approved, "train")
  const fixedValidation = verifiedQualificationSample(projectRoot, evidence.qualificationSamples?.fixedValidation, approved, "validation")
  assert.equal(fixedValidation.sampleId, "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6")
  const autoencoderCheckpoint = bindingFromRecord(projectRoot, evidence.autoencoderCheckpoint, "frozen Autoencoder")
  assert.equal(autoencoderCheckpoint.path, model.autoencoderCheckpointPath)
  assert.equal(autoencoderCheckpoint.sha256, FROZEN_AUTOENCODER_SHA256)
  assert.equal(evidence.autoencoderCheckpoint.loadAllowed, true)
  assert.equal(evidence.autoencoderCheckpoint.stateMutationAllowed, false)
  return {
    registry, terminal, report, activeConfig,
    currentRegistryBinding, readonlyTerminalBinding, readonlyReportBinding,
    activeConfigBinding, formalBinding, approvedDataset,
    datasetPackageId: data.datasetPackageId,
    firstTrain, fixedValidation, autoencoderCheckpoint,
  }
}

function verifiedQualificationSample(projectRoot, value, approvedRows, expectedSplit) {
  assert.ok(value && typeof value === "object")
  assert.equal(value.split, expectedSplit)
  const matches = approvedRows.filter((row) => row.recordId === value.sampleId && row.sampleId === value.sampleId)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].split, expectedSplit)
  assert.equal(matches[0].conditionPackPath, value.conditionPack.path)
  assert.equal(matches[0].imagePath, value.approvedReferenceRgb.path)
  assert.equal(matches[0].imageSha256, value.approvedReferenceRgb.sha256)
  return {
    sampleId: value.sampleId,
    split: value.split,
    conditionPack: bindingFromRecord(projectRoot, value.conditionPack, `${expectedSplit} condition pack`),
    approvedReferenceRgb: bindingFromRecord(projectRoot, value.approvedReferenceRgb, `${expectedSplit} reference RGB`),
  }
}

function buildSourceEvidence(projectRoot, source) {
  const evidence = [
    { role: "current-execution-registry", ...source.currentRegistryBinding },
    { role: "readonly-gpu-terminal", ...source.readonlyTerminalBinding },
    { role: "readonly-gpu-report", ...source.readonlyReportBinding },
    { role: "readonly-active-config", ...source.activeConfigBinding },
    { role: "cpu-support-terminal", ...bindingFromRecord(projectRoot, source.activeConfig.evidenceBindings.cpuSupportTerminal, "CPU support terminal") },
    { role: "formal-objective-contract", ...source.formalBinding },
    { role: "dataset-manifest", ...source.approvedDataset.manifest },
    { role: "source-index", ...source.approvedDataset.sourceIndex },
    { role: "first-train-condition-pack", ...source.firstTrain.conditionPack },
    { role: "first-train-reference-rgb", ...source.firstTrain.approvedReferenceRgb },
    { role: "fixed-validation-condition-pack", ...source.fixedValidation.conditionPack },
    { role: "fixed-validation-reference-rgb", ...source.fixedValidation.approvedReferenceRgb },
    { role: "frozen-autoencoder", ...source.autoencoderCheckpoint },
  ]
  for (const [role, reportKey] of [
    ["readonly-gpu-diagnostic", "gpuDiagnostic"],
    ["readonly-gradient-evidence", "gradientEvidence"],
    ["readonly-cuda-telemetry", "cudaTelemetry"],
    ["readonly-model-state-hashes", "modelStateHashes"],
    ["readonly-native-rgb-resource-boundary", "nativeRgbReadonlyResourceBoundary"],
  ]) evidence.push({ role, ...bindingFromRecord(projectRoot, source.report[reportKey], role) })
  for (const [role, relativePath] of Object.entries(CODE_ROLES)) {
    evidence.push({ role, ...bindRole(projectRoot, relativePath) })
  }
  return evidence.sort((left, right) => left.role.localeCompare(right.role))
}

function newIdentities(recordedAtUtc, randomHex) {
  assert.match(randomHex, /^[a-f0-9]{8}$/u)
  const date = new Date(recordedAtUtc)
  assert.equal(Number.isNaN(date.getTime()), false, "recordedAtUtc is invalid")
  const iso = date.toISOString()
  const day = iso.slice(0, 10).replaceAll("-", "")
  const time = `${iso.slice(11, 19).replaceAll(":", "")}${iso.slice(20, 23)}`
  const runId = `${day}-${time}-joint-condition-local-transport-smoke`
  return {
    runId,
    compilationRunId: `stage4-joint-condition-local-transport-smoke-contract-${day}-${time}-${randomHex}`,
    packageIdentity: `joint-condition-local-transport-smoke-package-${day}${time}-${randomHex}`,
  }
}

function bindingFromRecord(projectRoot, value, label) {
  assert.ok(value && typeof value === "object", `${label} binding is missing`)
  assert.match(value.sha256 ?? "", /^[a-f0-9]{64}$/u, `${label} SHA-256 is invalid`)
  const actual = bindRole(projectRoot, value.path)
  assert.equal(actual.sha256, value.sha256, `${label} SHA-256 changed`)
  return actual
}

function bindRole(projectRoot, relativePath) {
  const absolute = resolveInside(projectRoot, normalizeProjectPath(relativePath))
  assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `bound file is missing: ${relativePath}`)
  return { path: projectPath(projectRoot, absolute), sha256: sha256File(absolute) }
}

function bind(projectRoot, filePath) {
  return { path: projectPath(projectRoot, filePath), sha256: sha256File(filePath) }
}

function writeJsonExclusive(filePath, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  const handle = fs.openSync(filePath, "wx")
  try {
    fs.writeFileSync(handle, bytes, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)) }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function projectPath(projectRoot, filePath) { return path.relative(projectRoot, path.resolve(filePath)).replaceAll("\\", "/") }

function normalizeProjectPath(value) {
  assert.equal(typeof value, "string")
  const normalized = value.replaceAll("\\", "/")
  assert.ok(normalized.length > 0 && !path.isAbsolute(normalized) && !/^[A-Za-z]:[\\/]/u.test(normalized))
  assert.ok(!normalized.split("/").includes(".."))
  return normalized
}

function resolveInside(projectRoot, relativePath) {
  const root = path.resolve(projectRoot)
  const absolute = path.resolve(root, normalizeProjectPath(relativePath))
  assert.ok(absolute.startsWith(`${root}${path.sep}`), `path escapes project: ${relativePath}`)
  return absolute
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(compileJointConditionLocalTransportSmoke(), null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  }
}
