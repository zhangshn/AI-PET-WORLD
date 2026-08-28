import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { validateControlledSmokeContract, PREVIEW_EPOCHS, SAMPLE_ID } from "./lib/ai-painter-stage4-authoritative-semantic-carrier-smoke-v1.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const DATASET = inside("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json")
const AUTOENCODER = inside(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt")
const AUTOENCODER_SHA = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const FROZEN_SOURCE = inside(".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-051400001-condition_fusion_only_final_direct_residual_23_64_12/active-config.json")
const FROZEN_SOURCE_SHA = "fceb5a2f655fb909a3b207b1340e963846773d0d5707ee52e41c1a49bd832065"
const ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]

const argv = process.argv.slice(2)
const option = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
const capabilityVersion = option("--capability-version")
const attemptId = option("--attempt-id")
const priorBootstrapFailureAttempt = option("--record-prior-bootstrap-failure")
const resumeFinalizationOnly = argv.includes("--resume-finalization-only")
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/)
assert.match(attemptId ?? "", /^[a-z0-9][a-z0-9-]{7,79}$/)
const candidateRoot = inside(`.runtime/ai-painter/stage4-bounded-candidate-plans/${capabilityVersion}`)
const lifecycleRoot = inside(`.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`)
const lifecycle = read(path.join(lifecycleRoot, "state.json"))
assert.equal(lifecycle.state, "readonly_gpu_qualified")
const compiledContractPath = path.join(candidateRoot, "controlled-smoke-compilation/controlled-smoke-contract.json")
const compiledContract = read(compiledContractPath)
validateControlledSmokeContract(compiledContract)
assert.equal(sha(AUTOENCODER), AUTOENCODER_SHA)
assert.equal(sha(FROZEN_SOURCE), FROZEN_SOURCE_SHA)
const executionParent = inside(".runtime/ai-painter/stage4-authoritative-semantic-carrier-controlled-smokes")
fs.mkdirSync(executionParent, { recursive: true })
if (priorBootstrapFailureAttempt) recordBootstrapFailure(priorBootstrapFailureAttempt)
const executionRoot = path.join(executionParent, `${capabilityVersion}-${attemptId}`)
if (resumeFinalizationOnly) {
  assert.equal(fs.existsSync(executionRoot), true, "completed training execution does not exist")
  await resumeCompletedTrainingFinalization(executionRoot)
  process.exit(0)
}
assert.equal(fs.existsSync(executionRoot), false, "controlled Smoke execution output already exists")

const resources = resourceSnapshot()
if (!resources.passed) throw new Error(`controlled_smoke_resource_gate_failed:${resources.blockers.join(",")}`)
fs.mkdirSync(executionRoot, { recursive: false })
writeJsonAtomic(path.join(executionRoot, "resource-preflight.json"), resources)

const ticketId = `local-ai-${capabilityVersion}-${attemptId}`
const ticketPath = path.join(executionRoot, "internal-capability-ticket.json")
const consumptionPath = path.join(executionRoot, "internal-capability-consumption.json")
const ticket = {
  schemaVersion: "ai-painter-local-internal-capability-ticket-v1",
  status: "issued_not_consumed",
  ticketId,
  modeId: "authoritative_semantic_carrier_stage4_smoke",
  capabilityVersion,
  capabilityAuthority: "local_ai_pet_world_program",
  parentContract: bind(compiledContractPath),
  executionActions: ACTIONS,
  ownerAuthorizationRequired: false,
  cannotExpandParentContract: true,
  issuedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(ticketPath, ticket)
writeExclusiveJson(consumptionPath, {
  schemaVersion: "ai-painter-local-internal-capability-ticket-consumption-v1",
  ticketId,
  ticketSha256: sha(ticketPath),
  oneTimeConsumption: true,
  state: "consumed",
  consumedAtUtc: new Date().toISOString(),
})

const activeConfigPath = path.join(executionRoot, "active-config.json")
const activeConfig = buildActiveConfig({ ticketPath, consumptionPath })
writeExclusiveJson(activeConfigPath, activeConfig)
const trainerOutput = path.join(executionRoot, "training-output")
const args = trainerArgs(activeConfigPath, trainerOutput)
const preflight = spawnSync(PYTHON, [...args, "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true })
writeExclusiveJson(path.join(executionRoot, "trainer-preflight.json"), { status: preflight.status === 0 ? "passed" : "failed", exitCode: preflight.status, stdout: preflight.stdout, stderr: preflight.stderr, gpuStarted: false, trainingStarted: false })
if (preflight.status !== 0) closeFailure("trainer_preflight_failed", preflight.stderr || preflight.stdout)

writeExclusiveJson(path.join(executionRoot, "execution-state.json"), {
  schemaVersion: "stage4-authoritative-semantic-carrier-smoke-execution-state-v1",
  status: "running",
  phase: "training",
  capabilityVersion,
  attemptId,
  trainingOutput: relative(trainerOutput),
  progressPath: relative(path.join(trainerOutput, "progress.json")),
  ownerAuthorizationRequired: false,
  startedAtUtc: new Date().toISOString(),
})
const logOut = fs.openSync(path.join(executionRoot, "trainer.stdout.log"), "wx")
const logErr = fs.openSync(path.join(executionRoot, "trainer.stderr.log"), "wx")
const child = spawn(PYTHON, args, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", logOut, logErr] })
const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)) })
fs.closeSync(logOut); fs.closeSync(logErr)
if (exitCode !== 0) closeFailure("trainer_execution_failed", `exitCode=${exitCode}`)

const manifestPath = path.join(trainerOutput, "manifest.json")
await finalizeCompletedTraining({ executionRoot, trainerOutput, activeConfig, recoveryEvidence: null })

async function finalizeCompletedTraining({ executionRoot, trainerOutput, activeConfig, recoveryEvidence }) {
  const manifestPath = path.join(trainerOutput, "manifest.json")
  assert.ok(fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile(), "trainer manifest missing")
  const manifest = read(manifestPath)
  if (recoveryEvidence) writeExclusiveJson(path.join(executionRoot, "post-training-recovery-evidence.json"), recoveryEvidence)
  writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { schemaVersion: "stage4-authoritative-semantic-carrier-smoke-execution-state-v1", status: "running", phase: "automatic_review_and_qualification", capabilityVersion, attemptId, trainingOutput: relative(trainerOutput), ownerAuthorizationRequired: false, updatedAtUtc: new Date().toISOString() })
  const review = await reviewPreviews({ executionRoot, trainerOutput, activeConfig })
  const qualification = qualifyLateStability(review)
  writeExclusiveJson(path.join(executionRoot, "late-stability-qualification.json"), qualification)
const terminalStatus = qualification.qualified
  ? "authoritative_semantic_carrier_controlled_smoke_qualified"
  : "authoritative_semantic_carrier_controlled_smoke_real_visual_failure"
const finalization = {
  schemaVersion: "stage4-authoritative-semantic-carrier-controlled-smoke-finalization-v1",
  status: terminalStatus,
  capabilityVersion,
  attemptId,
  manifest: bind(manifestPath),
  checkpoint: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256, promotable: false },
  machineReview: bind(path.join(executionRoot, "machine-review.json")),
  lateStabilityQualification: bind(path.join(executionRoot, "late-stability-qualification.json")),
  automaticRetryStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
const finalizationPath = path.join(executionRoot, "finalization.json")
writeExclusiveJson(finalizationPath, finalization)
const terminalPath = path.join(executionRoot, "phase-terminal.json")
writeExclusiveJson(terminalPath, {
  schemaVersion: "stage4-authoritative-semantic-carrier-controlled-smoke-terminal-v1",
  executionState: "completed",
  status: terminalStatus,
  capabilityVersion,
  attemptId,
  finalization: bind(finalizationPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
if (qualification.qualified) {
  const evidence = { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState: "controlled_smoke_completed", status: "passed", bindings: [terminalPath, finalizationPath, manifestPath, path.join(executionRoot, "machine-review.json"), path.join(executionRoot, "late-stability-qualification.json")].map(bind) }
  writeExclusiveJson(path.join(executionRoot, "lifecycle-evidence.json"), evidence)
  advanceCapabilityLifecycle({ root: ROOT, capabilityVersion, targetState: "controlled_smoke_completed", evidence, recordedAtUtc: new Date().toISOString() })
}
writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { schemaVersion: "stage4-authoritative-semantic-carrier-smoke-execution-state-v1", status: "completed", phase: qualification.qualified ? "qualified" : "failed_closed", capabilityVersion, attemptId, terminal: bind(terminalPath), ownerAuthorizationRequired: false, completedAtUtc: new Date().toISOString() })
for (const file of [path.join(executionRoot, "active-config.json"), path.join(executionRoot, "internal-capability-ticket.json"), path.join(executionRoot, "internal-capability-consumption.json"), path.join(executionRoot, "resource-preflight.json"), path.join(executionRoot, "trainer-preflight.json"), path.join(executionRoot, "machine-review.json"), path.join(executionRoot, "late-stability-qualification.json"), finalizationPath, terminalPath, ...(recoveryEvidence ? [path.join(executionRoot, "post-training-recovery-evidence.json")] : [])]) indexFile(file)
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-smoke-${capabilityVersion}-${attemptId}`, timestamp: new Date().toISOString(), action: "stage4_authoritative_semantic_carrier_controlled_smoke", runId: `${capabilityVersion}-${attemptId}`, kind: "controlled_smoke", status: qualification.qualified ? "success" : "failed_closed", title: "Stage4 authoritative semantic carrier controlled Smoke completed", titleZh: qualification.qualified ? "Stage4权威语义载体受控Smoke及自动审核通过" : "Stage4权威语义载体受控Smoke真实视觉失败并关闭", detailZh: `30 Epoch训练自然完成；机器审核${review.previewPassCount}/${review.previewCount}，后期稳定资格=${qualification.qualified}。`, evidencePath: relative(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
process.stdout.write(`${JSON.stringify({ status: terminalStatus, terminal: bind(terminalPath), manifest: bind(manifestPath), machineReview: bind(path.join(executionRoot, "machine-review.json")), lateStability: bind(path.join(executionRoot, "late-stability-qualification.json")), lifecycleState: qualification.qualified ? "controlled_smoke_completed" : "readonly_gpu_qualified", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false }, null, 2)}\n`)
}

async function resumeCompletedTrainingFinalization(executionRoot) {
  for (const name of ["finalization.json", "phase-terminal.json", "machine-review.json", "late-stability-qualification.json", "post-training-recovery-evidence.json"]) assert.equal(fs.existsSync(path.join(executionRoot, name)), false, `${name} already exists`)
  const state = read(path.join(executionRoot, "execution-state.json"))
  assert.equal(state.status, "running")
  assert.equal(state.phase, "training")
  assert.equal(state.capabilityVersion, capabilityVersion)
  assert.equal(state.attemptId, attemptId)
  const ticket = read(path.join(executionRoot, "internal-capability-ticket.json"))
  const consumption = read(path.join(executionRoot, "internal-capability-consumption.json"))
  assert.equal(ticket.ticketId, consumption.ticketId)
  assert.equal(consumption.ticketSha256, sha(path.join(executionRoot, "internal-capability-ticket.json")))
  assert.equal(consumption.oneTimeConsumption, true)
  assert.equal(consumption.state, "consumed")
  const trainerOutput = path.join(executionRoot, "training-output")
  const progressPath = path.join(trainerOutput, "progress.json")
  const manifestPath = path.join(trainerOutput, "manifest.json")
  const progress = read(progressPath)
  const manifest = read(manifestPath)
  assert.equal(progress.status, "completed")
  assert.equal(progress.currentStage, "completed")
  assert.equal(progress.currentEpoch, 30)
  assert.equal(progress.liveProgress.optimizerStep, 90)
  assert.equal(progress.liveProgress.optimizerStepTarget, 90)
  assert.equal(progress.metrics.length, 30)
  assert.equal(manifest.status, "conditional_denoiser_single_sample_overfit_smoke_completed")
  const checkpointPath = inside(manifest.checkpointPath)
  assert.equal(sha(checkpointPath), manifest.checkpointSha256)
  const activeConfig = read(path.join(executionRoot, "active-config.json"))
  const recoveryEvidence = {
    schemaVersion: "stage4-authoritative-semantic-carrier-post-training-recovery-v1",
    status: "completed_training_outputs_verified_for_readonly_finalization_resume",
    cause: "node_post_training_file_predicate_implementation_defect",
    trainingRestarted: false,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    progress: bind(progressPath),
    manifest: bind(manifestPath),
    checkpointIdentity: { path: manifest.checkpointPath, sha256: manifest.checkpointSha256, weightsLoaded: false },
    recordedAtUtc: new Date().toISOString(),
  }
  await finalizeCompletedTraining({ executionRoot, trainerOutput, activeConfig, recoveryEvidence })
}

function buildActiveConfig({ ticketPath, consumptionPath }) {
  const config = structuredClone(read(FROZEN_SOURCE))
  delete config.stage4ControlledStructureArm
  delete config.stage4ResponsibilityComponentRole
  config.modelId = "ai-painter-stage4-authoritative-semantic-carrier-controlled-smoke"
  config.architectureVersion = "authoritative-semantic-carrier-controlled-smoke-v1"
  config.status = "active_local_ai_controlled_smoke"
  config.denoiserArchitecture = "stage4_authoritative_visual_semantic_carrier_decoder_v1"
  config.denoiserBaseChannels = 64
  const training = config.training
  delete training.ownerTrainingAuthorization
  delete training.factConditionedSemanticMixtureStage4SmokeExecution
  training.trainingAuthorizationStatus = "local_ai_authoritative_semantic_carrier_controlled_smoke_active"
  training.seed = 20263722
  training.authorizedOverfitSampleId = SAMPLE_ID
  training.authorizedInitialization = "fixed_project_random_authoritative_semantic_carrier"
  training.localAiCapabilityTicket = { ticketId, ticketPath: relative(ticketPath), ticketSha256: sha(ticketPath), consumptionPath: relative(consumptionPath), consumptionSha256: sha(consumptionPath), executionState: "consumed", status: training.trainingAuthorizationStatus, executionActions: ACTIONS }
  training.stage4AuthoritativeSemanticCarrier = { contractId: "stage4-authoritative-visual-semantic-carrier-model-family-contract-v1", status: "active_local_ai_controlled_smoke", carrierIdentityOrder: ["terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline", "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "object_footprints", "object_tree", "object_rock", "object_vegetation"], sourceGate: "exact_resized_authoritative_discrete_condition_channel", learnedParticipationGateAllowed: false }
  training.stage4AuthoritativeSemanticCarrierSmokeContract = { status: "active_local_ai_internal_capability", sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"], epochCount: 30, previewEpochs: [...PREVIEW_EPOCHS], resolution: { width: 256, height: 192 }, initialization: "fixed_project_random_authoritative_semantic_carrier", automaticMachineReview: true, automaticLateStabilityQualification: true, automaticRetryAllowed: false }
  training.stage4AuthoritativeSemanticCarrierFrozenTrainingContract = { sourceConfigPath: relative(FROZEN_SOURCE), sourceConfigSha256: FROZEN_SOURCE_SHA }
  if (training.stage4UnifiedTrainingPreviewSamplingContract) training.stage4UnifiedTrainingPreviewSamplingContract.status = "active_local_ai_internal_capability"
  return config
}

function trainerArgs(config, output) { return [TRAINER, "--config", config, "--dataset-package", DATASET, "--autoencoder-checkpoint", AUTOENCODER, "--output-dir", output, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30", "--overfit-evaluation-interval", "5"] }
async function reviewPreviews({ executionRoot, trainerOutput, activeConfig }) {
  const previewRoot = path.join(trainerOutput, "fixed-epoch-previews")
  const files = fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort((a, b) => Number(a.match(/epoch-(\d+)/)?.[1]) - Number(b.match(/epoch-(\d+)/)?.[1]))
  assert.deepEqual(files.map((file) => Number(file.match(/epoch-(\d+)/)?.[1])), PREVIEW_EPOCHS)
  const sample = activeConfig.training.factConditionedSemanticMixtureSampleBinding
  const conditionPack = read(inside(sample.conditionPackPath))
  const reviews = []
  for (const file of files) {
    const epoch = Number(file.match(/epoch-(\d+)/)[1])
    const sourcePath = path.join(previewRoot, file)
    const normalizedPath = path.join(executionRoot, "review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath, finalAssetPath: normalizedPath, workRoot: inside(".runtime/ai-painter/authoritative-semantic-carrier-review-work"), workId: shaText(relative(executionRoot)).slice(0, 16), epoch })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `authoritative-carrier-smoke-${epoch}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath }),
    ])
    reviews.push({ epoch, previewPath: relative(sourcePath), previewSha256: sha(sourcePath), normalizedPath: relative(normalizedPath), normalizedSha256: sha(normalizedPath), passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
  }
  const report = { schemaVersion: "stage4-authoritative-semantic-carrier-machine-review-v1", status: reviews.every((r) => r.passed) ? "machine_reviews_passed" : "machine_reviews_failed", reviewThresholdsChanged: false, reviews, previewCount: reviews.length, previewPassCount: reviews.filter((r) => r.passed).length, previewFailCount: reviews.filter((r) => !r.passed).length, recordedAtUtc: new Date().toISOString() }
  writeExclusiveJson(path.join(executionRoot, "machine-review.json"), report)
  return report
}
function qualifyLateStability(review) {
  const late = [10, 20, 30].map((epoch) => ({ epoch, failures: review.reviews.find((r) => r.epoch === epoch)?.issueCodes.length ?? Number.POSITIVE_INFINITY, passed: review.reviews.find((r) => r.epoch === epoch)?.passed === true }))
  const counts = late.map((r) => r.failures)
  const sustainedZero = counts.every((v) => v === 0)
  const decreaseThenZero = counts[2] === 0 && counts[1] === 0 && counts[0] > 0
  const qualified = Boolean(late[1].passed && late[2].passed && (sustainedZero || decreaseThenZero))
  return { schemaVersion: "stage4-authoritative-semantic-carrier-late-stability-qualification-v1", status: qualified ? "qualified" : "not_qualified", qualified, route: sustainedZero ? "sustained_zero_from_first_late_epoch" : decreaseThenZero ? "strict_decrease_then_stable_zero" : null, lateTimeline: late, terminalRegression: !late[2].passed, thresholdChanged: false, recordedAtUtc: new Date().toISOString() }
}
function resourceSnapshot() { const gpu = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.free", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true }); const parts = gpu.stdout.trim().split(",").map((v) => v.trim()); const disk = fs.statfsSync(ROOT); const freeDisk = Number(disk.bavail) * Number(disk.bsize); const processCheck = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true }); const python = processCheck.stdout.split(/\r?\n/).filter((r) => /python/i.test(r)); const blockers = []; if (gpu.status !== 0) blockers.push("cuda_unavailable"); if (Number(parts[1]) > 10) blockers.push("gpu_not_idle"); if (Number(parts[3]) < 4096) blockers.push("gpu_memory_insufficient"); if (python.length) blockers.push("python_gpu_process_active"); if (freeDisk < 4 * 1024 ** 3) blockers.push("disk_insufficient"); return { schemaVersion: "stage4-authoritative-semantic-carrier-resource-preflight-v1", passed: blockers.length === 0, blockers, cpuLogicalProcessors: os.cpus().length, memoryFreeBytes: os.freemem(), diskFreeBytes: freeDisk, gpu: { name: parts[0], utilizationPercent: Number(parts[1]), memoryUsedMiB: Number(parts[2]), memoryFreeMiB: Number(parts[3]), pythonComputeProcesses: python }, recordedAtUtc: new Date().toISOString() } }
function recordBootstrapFailure(failedAttempt) { assert.match(failedAttempt, /^[a-z0-9][a-z0-9-]{7,79}$/); const directory = path.join(executionParent, `${capabilityVersion}-${failedAttempt}-bootstrap-failure`); assert.equal(fs.existsSync(directory), false, "bootstrap failure already recorded"); fs.mkdirSync(directory, { recursive: false }); const report = path.join(directory, "failure-report.json"); const terminal = path.join(directory, "phase-terminal.json"); writeExclusiveJson(report, { schemaVersion: "stage4-authoritative-semantic-carrier-smoke-bootstrap-failure-v1", status: "failed_closed_before_internal_consumption", failureCode: "fixed_parent_namespace_missing", failedAttempt, gpuStarted: false, ticketConsumed: false, optimizerCreated: false, trainingStarted: false, recordedAtUtc: new Date().toISOString() }); writeExclusiveJson(terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-controlled-smoke-terminal-v1", executionState: "failed", status: "authoritative_semantic_carrier_controlled_smoke_bootstrap_failed_closed", failureReport: bind(report), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() }); indexFile(report); indexFile(terminal) }
function closeFailure(code, detail) { const finalization = path.join(executionRoot, "failure-finalization.json"); writeExclusiveJson(finalization, { schemaVersion: "stage4-authoritative-semantic-carrier-smoke-failure-v1", status: "failed_closed", code, detail: String(detail), automaticRetryStarted: false, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() }); const terminal = path.join(executionRoot, "phase-terminal.json"); writeExclusiveJson(terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-controlled-smoke-terminal-v1", executionState: "failed", status: "authoritative_semantic_carrier_controlled_smoke_infrastructure_failed_closed", blocker: code, finalization: bind(finalization), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc: new Date().toISOString() }); writeJsonAtomic(path.join(executionRoot, "execution-state.json"), { status: "failed_closed", terminal: bind(terminal) }); throw new Error(`${code}:${detail}`) }
function inside(rel) { assert.ok(typeof rel === "string" && rel && !path.isAbsolute(rel) && !/^[A-Za-z]:[\\/]/.test(rel) && !rel.split(/[\\/]/).includes("..")); const target = path.resolve(ROOT, rel); assert.ok(target.startsWith(`${ROOT}${path.sep}`)); return target }
function relative(file) { return path.relative(ROOT, file).replaceAll("\\", "/") }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function writeExclusiveJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${inside("ml/ai-painter/src")};${inside("ml/ai-painter/scripts")}` } }
function indexFile(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: `${capabilityVersion}-${attemptId}`, artifactType: "stage4_authoritative_semantic_carrier_controlled_smoke_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
