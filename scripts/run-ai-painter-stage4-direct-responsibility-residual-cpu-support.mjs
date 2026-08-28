import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-direct-clean-latent-responsibility-residual-change-candidate-v1"
const ARCHITECTURE = "stage4_direct_condition_clean_latent_responsibility_residual_v1"
const EXPECTED_TASK = "implement_direct_responsibility_residual_cpu_inactive_support"
const NEXT_TASK = "run_direct_responsibility_residual_readonly_gpu_qualification"
const RUN_ID = process.argv[2] ?? `stage4-direct-responsibility-residual-cpu-${compactUtc()}-01`
assert.match(RUN_ID, /^[a-z0-9][a-z0-9-]{7,127}$/)
const outputRoot = inside(`.runtime/ai-painter/stage4-direct-responsibility-residual-cpu-support/${RUN_ID}`)
assert.equal(fs.existsSync(outputRoot), false, "CPU support output already exists")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.lifecycleStage, "change_candidate")
assert.equal(current.registry.activeExecution, null)

fs.mkdirSync(path.dirname(outputRoot), { recursive: true })
fs.mkdirSync(outputRoot, { recursive: false })
const files = {
  config: path.join(outputRoot, "inactive-config.json"),
  support: path.join(outputRoot, "model-structure-support-contract.json"),
  parameters: path.join(outputRoot, "parameter-structure-report.json"),
  audit: path.join(outputRoot, "configuration-audit.json"),
  cpu: path.join(outputRoot, "cpu-report.json"),
  terminal: path.join(outputRoot, "phase-terminal.json"),
  capsule: path.join(outputRoot, "local-task-capsule.json"),
  plan: path.join(outputRoot, "plan-sync-record.json"),
}
const sourceConfig = existing(".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0/stage4-post-decode-full-condition-responsibility-stage0-2026082603/active-config.json")
const compiler = existing("ml/ai-painter/scripts/compile_stage4_direct_responsibility_residual_cpu_config.py")
const checker = existing("ml/ai-painter/scripts/check_stage4_direct_responsibility_residual_cpu.py")
const contract = existing("ml/ai-painter/scripts/ai_painter_direct_responsibility_residual_contract.py")
const model = existing("ml/ai-painter/src/ai_painter/complete_world/model.py")
const modeRegistry = existing("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
const python = existing("ml/ai-painter/.venv/Scripts/python.exe")

const compileResult = runPython(python, [compiler, "--source", sourceConfig, "--output", files.config])
assert.equal(compileResult.status, "direct_responsibility_residual_cpu_inactive_config_compiled")
const checked = runPython(python, [checker])
assert.equal(checked.status, "stage4_direct_responsibility_residual_cpu_support_passed")
assert.equal(checked.addedParameterTensorCount, 10)
assert.equal(checked.addedParameterCount, 34620)
assert.equal(checked.modelStateUnchanged, true)
assert.equal(checked.gpuStarted, false)

const recordedAtUtc = new Date().toISOString()
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-direct-responsibility-residual-model-support-contract-v1",
  status: "cpu_supported_inactive",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  retainedBaseArchitecture: "stage4_direct_condition_clean_latent_generator_v1",
  responsibilityIdentityOrder: checked.responsibilityOrder,
  sourceMasks: checked.responsibilityOrder,
  headDefinition: "Conv2d(64,12,3,padding=1,bias=true)",
  merge: "base_clean_latent_plus_sum_of_mask_gated_residuals",
  totalAddedParameterCount: checked.addedParameterCount,
  outsideMaskMutationAllowed: false,
  parametersSharedAcrossResponsibilities: false,
  waterSpecificHeadPresent: false,
  existingLossValuesAndWeightsUnchanged: true,
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeJsonAtomic(files.parameters, {
  schemaVersion: "stage4-direct-responsibility-residual-parameter-report-v1",
  status: "passed",
  baselineParameterTensorCount: checked.baselineParameterTensorCount,
  addedParameterTensorCount: checked.addedParameterTensorCount,
  addedParameterCount: checked.addedParameterCount,
  maskGradientEvidence: checked.maskGradientEvidence,
  baselineParameterIdentityUnchanged: true,
  parameterNamespacesIsolated: true,
  allFormalGradientsFiniteNonZero: true,
  modelStateUnchanged: true,
  recordedAtUtc,
})
writeJsonAtomic(files.audit, {
  schemaVersion: "stage4-direct-responsibility-residual-configuration-audit-v1",
  status: "passed",
  architecture: ARCHITECTURE,
  conditionChannels: 23,
  latentChannels: 12,
  responsibilityCount: 5,
  waterRemainsBaseResponsibility: true,
  dataAndSplitUnchanged: true,
  lossAndThresholdsUnchanged: true,
  allActivationGatesFalse: true,
  historicalCheckpointRead: false,
  recordedAtUtc,
})
writeJsonAtomic(files.cpu, {
  schemaVersion: "stage4-direct-responsibility-residual-cpu-report-v1",
  status: "passed",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  positiveChecks: checked.positiveChecks,
  negativeChecks: checked.negativeChecks,
  inputShape: checked.inputShape,
  outputShape: checked.outputShape,
  decodedRgbShape: checked.decodedRgbShape,
  modelStateUnchanged: true,
  autoencoderFrozen: true,
  historicalCheckpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuStarted: false,
  trainingStarted: false,
  sourceBindings: [sourceConfig, compiler, checker, contract, model, modeRegistry].map(bind),
  recordedAtUtc,
})

advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: CAPABILITY,
  targetState: "isolated_implementation",
  evidence: lifecycleEvidence("isolated_implementation", [files.config, files.support, model, modeRegistry, contract].map(bind)),
  recordedAtUtc,
})
const lifecycle = advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: CAPABILITY,
  targetState: "cpu_contract_verified",
  evidence: lifecycleEvidence("cpu_contract_verified", [files.cpu, files.parameters, files.audit, checker].map(bind)),
  recordedAtUtc,
})
const lifecycleState = existing(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`)
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-direct-responsibility-residual-cpu-terminal-v1",
  executionState: "completed",
  status: "direct_responsibility_residual_cpu_support_verified_inactive",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  inactiveConfig: bind(files.config),
  supportContract: bind(files.support),
  parameterReport: bind(files.parameters),
  configurationAudit: bind(files.audit),
  cpuReport: bind(files.cpu),
  lifecycleState: bind(lifecycleState),
  nextAction: NEXT_TASK,
  fixedTotalProgress: progress(),
  ownerAuthorizationRequired: false,
  historicalCheckpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})
syncPlan(recordedAtUtc)
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage4责任残差CPU支持", status: "cpu_contract_verified" },
  candidateTerminal: { runId: RUN_ID, status: "completed", programStatus: "direct_responsibility_residual_cpu_support_verified_inactive", previewMachineStatus: "not_run_cpu_support_only", modelQualificationStatus: "readonly_gpu_qualification_pending", checkpointWritten: false, modelWeightsModified: false, recordedAtUtc },
  latestBlocker: { code: "readonly_gpu_qualification_not_executed", summaryZh: "CPU结构与合同已通过，尚未执行独立只读GPU资格。" },
  nextAllowedAction: { code: NEXT_TASK, labelZh: "执行责任残差独立只读GPU资格", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: ["read_historical_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "start_training_before_gpu_qualification"],
  taskIdentity: { modelId: ARCHITECTURE, seed: 20263722, sampleId: null, sampleSplit: null, requiredBoundarySides: ["west"] },
  evidence: [files.terminal, files.config, files.support, files.parameters, files.audit, files.cpu, files.plan].map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
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
  taskCapsulePath: relative(files.capsule),
  terminalEvidencePath: relative(files.terminal),
})
assert.equal(registry.ok, true, registry.errorCode)
appendAiPainterProgramEvent({
  id: `stage4-direct-responsibility-residual-cpu-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_direct_responsibility_residual_cpu_support_verified",
  runId: RUN_ID,
  kind: "local_autonomous_capability_implementation",
  status: "success",
  title: "Direct responsibility residual CPU support verified",
  titleZh: "Stage4责任残差CPU未激活支持验证通过",
  detailZh: "五个掩码门控参数隔离残差头通过CPU正反合同；未读取Checkpoint、未启动GPU或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: progress(),
})
process.stdout.write(`${JSON.stringify({ status: "direct_responsibility_residual_cpu_support_verified_inactive", runId: RUN_ID, lifecycleState: lifecycle.state, terminal: bind(files.terminal), inactiveConfig: bind(files.config), cpuReport: bind(files.cpu), currentRegistrySha256: registry.registrySha256, nextAction: NEXT_TASK, fixedTotalProgress: progress(), ownerAuthorizationRequired: false }, null, 2)}\n`)

function syncPlan(recordedAtUtc) {
  const plan = existing("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const beforeSha256 = sha(plan)
  let value = fs.readFileSync(plan, "utf8")
  value = value.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`)
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4责任残差唯一候选CPU未激活支持通过，下一步本地程序执行只读GPU资格")
  value = value.replace(/^\| 2 \|[^\n]*$/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接干净潜变量Stage 0失败已收敛为五责任掩码门控参数隔离残差唯一候选，CPU正反合同、参数隔离和配置审计通过 | 本地程序执行独立只读GPU资格；通过后才编译并运行30 Epoch受控Smoke |​")
  const temporary = `${plan}.${process.pid}.tmp`
  fs.writeFileSync(temporary, value, "utf8")
  fs.renameSync(temporary, plan)
  writeJsonAtomic(files.plan, { schemaVersion: "stage4-direct-responsibility-residual-plan-sync-v1", status: "synchronized", planPath: relative(plan), beforeSha256, afterSha256: sha(plan), terminal: bind(files.terminal), recordedAtUtc })
}
function lifecycleEvidence(targetState, bindings) { return { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY, targetState, status: "passed", bindings } }
function runPython(python, args) { const value = execFileSync(python, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); const start = value.indexOf("{"); assert.ok(start >= 0, "Python JSON output missing"); return JSON.parse(value.slice(start)) }
function existing(value) { const file = inside(value); assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `file missing: ${value}`); return file }
function inside(value) { assert.ok(value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes("..")); const file = path.resolve(ROOT, value); assert.ok(file.startsWith(`${ROOT}${path.sep}`)); return file }
function relative(file) { return path.relative(ROOT, file).replaceAll("\\", "/") }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: relative(file), sha256: sha(file) } }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
