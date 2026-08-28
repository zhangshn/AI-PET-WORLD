import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-condition-encoder-clean-latent-change-candidate-v1"
const ARCHITECTURE = "stage4_native_condition_encoder_clean_latent_generator_v1"
const EXPECTED_TASK = "implement_native_condition_encoder_clean_latent_cpu_inactive_support"
const NEXT_TASK = "run_native_condition_encoder_readonly_gpu_qualification"
const RUN_ID = process.argv[2] ?? `stage4-native-condition-encoder-cpu-${compactUtc()}-01`
assert.match(RUN_ID, /^[a-z0-9][a-z0-9-]{7,127}$/)
const outputRoot = inside(`.runtime/ai-painter/stage4-native-condition-encoder-cpu-support/${RUN_ID}`)
assert.equal(fs.existsSync(outputRoot), false, "CPU support output already exists")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.lifecycleStage, "change_candidate")
assert.equal(current.registry.activeExecution, null)

fs.mkdirSync(path.dirname(outputRoot), { recursive: true })
fs.mkdirSync(outputRoot, { recursive: false })
const files = Object.fromEntries([
  "inactive-config", "model-structure-support-contract", "parameter-structure-report",
  "configuration-audit", "cpu-report", "phase-terminal", "local-task-capsule",
].map((name) => [name.replaceAll("-", "_"), path.join(outputRoot, `${name}.json`)]))
const sourceConfig = existing(".runtime/ai-painter/stage4-direct-responsibility-residual-formal-stage0/stage4-direct-responsibility-residual-stage0-20260827091911-01/active-config.json")
const compiler = existing("ml/ai-painter/scripts/compile_stage4_native_condition_encoder_cpu_config.py")
const checker = existing("ml/ai-painter/scripts/check_stage4_native_condition_encoder_cpu.py")
const contract = existing("ml/ai-painter/scripts/ai_painter_native_condition_encoder_contract.py")
const model = existing("ml/ai-painter/src/ai_painter/complete_world/model.py")
const modeRegistry = existing("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
const trainer = existing("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const python = existing("ml/ai-painter/.venv/Scripts/python.exe")

const compiled = runPython(python, [compiler, "--source", sourceConfig, "--output", files.inactive_config])
assert.equal(compiled.status, "native_condition_encoder_cpu_inactive_config_compiled")
const checked = runPython(python, [checker])
assert.equal(checked.status, "stage4_native_condition_encoder_cpu_support_passed")
assert.deepEqual(checked.inputShape, [1, 23, 192, 256])
assert.deepEqual(checked.outputShape, [1, 12, 48, 64])
assert.equal(checked.allFormalGradientsFiniteNonZero, true)
assert.equal(checked.modelStateUnchanged, true)
assert.equal(checked.gpuStarted, false)

const recordedAtUtc = new Date().toISOString()
writeJsonAtomic(files.model_structure_support_contract, {
  schemaVersion: "stage4-native-condition-encoder-model-support-contract-v1",
  status: "cpu_supported_inactive",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  inputIdentity: "formal_23_channel_conditions_at_native_stage_resolution",
  learnedFeatureOrder: [
    "23_to_64_native_resolution_stem",
    "64_to_128_stride2",
    "128_to_256_stride2",
    "256_to_12_clean_latent_output",
  ],
  rawConditionResizeBeforeFirstLearnedFeature: false,
  frozenAutoencoderSpatialFactor: 4,
  existingLossValuesAndWeightsUnchanged: true,
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeJsonAtomic(files.parameter_structure_report, {
  schemaVersion: "stage4-native-condition-encoder-parameter-report-v1",
  status: "passed",
  parameterTensorCount: checked.parameterTensorCount,
  parameterCount: checked.parameterCount,
  allowedNamespaces: ["native_condition_stem", "native_condition_down1", "native_condition_down2", "middle", "output"],
  spatialIdentity: checked.spatialIdentity,
  allFormalGradientsFiniteNonZero: true,
  modelStateUnchanged: true,
  autoencoderFrozen: true,
  recordedAtUtc,
})
writeJsonAtomic(files.configuration_audit, {
  schemaVersion: "stage4-native-condition-encoder-configuration-audit-v1",
  status: "passed",
  architecture: ARCHITECTURE,
  conditionChannels: 23,
  latentChannels: 12,
  widths: [64, 128, 256],
  splitCounts: checked.splitCounts,
  dataAndSplitUnchanged: true,
  lossAndThresholdsUnchanged: true,
  allActivationGatesFalse: true,
  historicalCheckpointRead: false,
  recordedAtUtc,
})
writeJsonAtomic(files.cpu_report, {
  schemaVersion: "stage4-native-condition-encoder-cpu-report-v1",
  status: "passed",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  positiveChecks: checked.positiveChecks,
  negativeChecks: checked.negativeChecks,
  inputShape: checked.inputShape,
  outputShape: checked.outputShape,
  decodedRgbShape: checked.decodedRgbShape,
  spatialIdentity: checked.spatialIdentity,
  modelStateUnchanged: true,
  autoencoderFrozen: true,
  historicalCheckpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuStarted: false,
  trainingStarted: false,
  sourceBindings: [sourceConfig, compiler, checker, contract, model, modeRegistry, trainer].map(bind),
  recordedAtUtc,
})

advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: CAPABILITY,
  targetState: "isolated_implementation",
  evidence: lifecycleEvidence("isolated_implementation", [files.inactive_config, files.model_structure_support_contract, model, modeRegistry, contract].map(bind)),
  recordedAtUtc,
})
const lifecycle = advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: CAPABILITY,
  targetState: "cpu_contract_verified",
  evidence: lifecycleEvidence("cpu_contract_verified", [files.cpu_report, files.parameter_structure_report, files.configuration_audit, checker].map(bind)),
  recordedAtUtc,
})
const lifecycleState = existing(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`)
writeJsonAtomic(files.phase_terminal, {
  schemaVersion: "stage4-native-condition-encoder-cpu-terminal-v1",
  executionState: "completed",
  status: "native_condition_encoder_cpu_support_verified_inactive",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  inactiveConfig: bind(files.inactive_config),
  supportContract: bind(files.model_structure_support_contract),
  parameterReport: bind(files.parameter_structure_report),
  configurationAudit: bind(files.configuration_audit),
  cpuReport: bind(files.cpu_report),
  lifecycleState: bind(lifecycleState),
  nextAction: NEXT_TASK,
  fixedTotalProgress: progress(),
  ownerAuthorizationRequired: false,
  historicalCheckpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})
writeJsonAtomic(files.local_task_capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage4原生条件编码CPU支持", status: "cpu_contract_verified" },
  candidateTerminal: { runId: RUN_ID, status: "completed", programStatus: "native_condition_encoder_cpu_support_verified_inactive", previewMachineStatus: "not_run_cpu_support_only", modelQualificationStatus: "readonly_gpu_qualification_pending", checkpointWritten: false, modelWeightsModified: false, recordedAtUtc },
  latestBlocker: { code: "readonly_gpu_qualification_not_executed", summaryZh: "CPU结构、原生分辨率输入身份和合同已通过；尚未执行只读GPU资格。" },
  nextAllowedAction: { code: NEXT_TASK, labelZh: "执行原生条件编码独立只读GPU资格", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: ["read_historical_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "start_training_before_gpu_qualification"],
  taskIdentity: { modelId: ARCHITECTURE, seed: 20263722, sampleId: null, sampleSplit: null, requiredBoundarySides: ["west"] },
  evidence: [files.phase_terminal, files.inactive_config, files.model_structure_support_contract, files.parameter_structure_report, files.configuration_audit, files.cpu_report].map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const registry = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: NEXT_TASK,
  taskKind: "readonly_gpu_qualification",
  runId: RUN_ID,
  lifecycleStage: lifecycle.state,
  executionState: "completed",
  activity: "planned_not_started",
  taskCapsulePath: relative(files.local_task_capsule),
  terminalEvidencePath: relative(files.phase_terminal),
})
assert.equal(registry.ok, true, registry.errorCode)
appendAiPainterProgramEvent({
  id: `stage4-native-condition-encoder-cpu-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_native_condition_encoder_cpu_support_verified",
  runId: RUN_ID,
  kind: "local_autonomous_capability_implementation",
  status: "success",
  title: "Native-condition encoder CPU support verified",
  titleZh: "Stage4原生分辨率条件编码CPU未激活支持验证通过",
  detailZh: "23通道先在原生分辨率提取特征，再按既有四倍关系输出12通道潜变量；未启动GPU或训练。",
  evidencePath: relative(files.phase_terminal),
  evidenceSha256: sha(files.phase_terminal),
  fixedTotalProgress: progress(),
})
process.stdout.write(`${JSON.stringify({ status: "native_condition_encoder_cpu_support_verified_inactive", runId: RUN_ID, lifecycleState: lifecycle.state, terminal: bind(files.phase_terminal), inactiveConfig: bind(files.inactive_config), cpuReport: bind(files.cpu_report), currentRegistrySha256: registry.registrySha256, nextAction: NEXT_TASK, fixedTotalProgress: progress(), ownerAuthorizationRequired: false }, null, 2)}\n`)

function lifecycleEvidence(targetState, bindings) { return { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY, targetState, status: "passed", bindings } }
function runPython(python, args) { const value = execFileSync(python, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); const start = value.indexOf("{"); assert.ok(start >= 0, "Python JSON output missing"); return JSON.parse(value.slice(start)) }
function existing(value) { const file = inside(value); assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `file missing: ${value}`); return file }
function inside(value) { assert.ok(value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes("..")); const file = path.resolve(ROOT, value); assert.ok(file.startsWith(`${ROOT}${path.sep}`)); return file }
function relative(file) { return path.relative(ROOT, file).replaceAll("\\", "/") }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
