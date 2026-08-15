import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  closeStorageCatalog,
  indexArtifact,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementation-20260815-183000000"
const AUTH_SCHEMA = "owner-authorized-stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementation-v1"
const SCOPE = "one_cpu_only_bounded_two_lane_early_convergence_stabilization_implementation_and_contract_regression"
const OUTPUT_NAMESPACE = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementations/20260815-183000000"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-190000000/active-config.json"
const SOURCE_CONFIG_SHA256 = "dbb73a0354f20c7888be87b87701e34eedce0d09345b614a49efa296f31bb8d6"
const TARGETS = [
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/compile_stage4_epoch_worst_sample_class_replay_config.py",
  "ml/ai-painter/scripts/check_stage4_epoch_worst_sample_class_replay_cpu.py",
  "scripts/record-stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementation.mjs",
]
const ALLOWED_ACTIONS = [
  "modify_only_existing_stage4_trainer_bounded_candidate_branch_configuration_compiler_cpu_checker_and_bounded_recorder",
  "compile_inactive_configuration",
  "execute_python_node_syntax_checks",
  "execute_cpu_positive_negative_contract_regression",
  "form_implementation_report_inactive_gpu_qualification_request_terminal_capsule_ledger_and_sqlite_index",
]
const DENIED_ACTIONS = [
  "checkpoint_read_or_load", "gpu_or_cuda", "autograd", "optimizer_or_backward",
  "training", "validation", "smoke", "automatic_retry", "review_threshold_change",
  "source_dataset_or_condition_change", "stage0", "stage1", "stage2",
  "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry",
]

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const result = path.resolve(ROOT, value)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return result
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
const consumptionSha256 = arg("--consumption-sha256")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg && consumptionSha256, "authorization_arguments_required")
const authorizationPath = resolveProject(authorizationArg)
const consumptionPath = resolveProject(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
assert.equal(sha(consumptionPath), consumptionSha256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.outputNamespace, OUTPUT_NAMESPACE)
assert.deepEqual(authorization.authorizedTargetPaths, TARGETS)
assert.deepEqual(authorization.allowedActions, ALLOWED_ACTIONS)
assert.deepEqual(authorization.deniedActions, DENIED_ACTIONS)
for (const [name, binding] of Object.entries(authorization.requiredBindings)) {
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_sha_changed`)
}
assert.equal(
  consumption.status,
  "cpu_only_two_lane_early_convergence_implementation_authorization_atomically_consumed",
)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.equal(consumption.oneTimeConsumption, true)
for (const field of [
  "checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted",
  "backwardExecuted", "modelWeightsMutated", "gpuUsed", "cudaInitialized",
  "trainingStarted", "validationStarted", "smokeStarted", "stage0Started",
  "stage1Started", "stage2Started",
]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}
const sourceConfig = resolveProject(SOURCE_CONFIG)
assert.equal(sha(sourceConfig), SOURCE_CONFIG_SHA256, "source_config_identity_changed")
const output = resolveProject(OUTPUT_NAMESPACE)
assert.equal(fs.existsSync(output), false, "implementation_output_namespace_exists")

const pythonTargets = TARGETS.filter((target) => target.endsWith(".py"))
const projectPython = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
assert.equal(fs.existsSync(projectPython), true, "project_python_missing")
const syntax = spawnSync(projectPython, [
  "-B", "-c",
  "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
  ...pythonTargets,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const nodeSyntax = spawnSync(process.execPath, ["--check", TARGETS.at(-1)], {
  cwd: ROOT,
  encoding: "utf8",
})
assert.equal(nodeSyntax.status, 0, `node_syntax_failed:${nodeSyntax.stderr}`)

const check = spawnSync(projectPython, [
  "-B",
  "ml/ai-painter/scripts/check_stage4_epoch_worst_sample_class_replay_cpu.py",
  "--early-convergence-stabilization",
  "--source", SOURCE_CONFIG,
  "--output-dir", OUTPUT_NAMESPACE,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_contract_regression_failed:${check.stderr}`)
const rawCpu = JSON.parse(check.stdout)
assert.equal(rawCpu.status, "passed_stage4_object_reference_multiscale_early_convergence_stabilization_cpu")
assert.equal(rawCpu.positivePassed, rawCpu.positiveTotal)
assert.equal(rawCpu.negativePassed, rawCpu.negativeTotal)
assert.equal(Object.values(rawCpu.executionBoundary).every((value) => value === false), true)

const files = {
  config: path.join(output, "inactive-config.json"),
  cpu: path.join(output, "cpu-contract-regression.json"),
  report: path.join(output, "implementation-report.json"),
  support: path.join(output, "inactive-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const nowShanghai = formatShanghai(now)
const progress = { completedStages: 3, totalStages: 5, percent: 60 }
const codeBindings = Object.fromEntries(
  TARGETS.map((target) => [path.basename(target), bind(resolveProject(target))]),
)
writeJsonAtomic(files.cpu, {
  ...rawCpu,
  syntaxCheckedFiles: [...pythonTargets, TARGETS.at(-1)],
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementation-report-v1",
  status: "stage4_object_reference_multiscale_early_convergence_stabilization_cpu_implemented_inactive",
  sourceRunId: "20260815-190000000",
  candidateId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceConfig: { path: SOURCE_CONFIG, sha256: SOURCE_CONFIG_SHA256, sourceConfigModified: false },
  requiredBindings: authorization.requiredBindings,
  codeBindings,
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  implementationFinding: {
    existingReplayPasses: 2,
    lane1: "existing_global_worst_sample_class_selection_unchanged",
    lane2: "joint_four_object_reference_multiscale_existing_weighted_sum",
    replayPassesAdded: 0,
    optimizerStepsAdded: 0,
    freeNumericWeightSelected: false,
    sourceConfigChanged: false,
    reviewThresholdsChanged: false,
    oldModesWithoutCandidatePreserved: true,
  },
  executionBoundary: rawCpu.executionBoundary,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-stabilization-inactive-support-contract-v1",
  status: "cpu_support_verified_inactive",
  candidateId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
  implementationReport: bind(files.report),
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  codeBindings,
  activationGate: {
    configurationActiveNow: false,
    checkpointReadNow: false,
    modelLoadNow: false,
    optimizerCreationNow: false,
    autogradNow: false,
    backwardExecutionNow: false,
    modelParameterUpdateNow: false,
    gpuUseNow: false,
    cudaInitializationNow: false,
    trainingNow: false,
    validationNow: false,
    smokeNow: false,
    stage0Now: false,
    stage1Now: false,
    stage2Now: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
const gradientRunner = resolveProject("ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py")
const gradientChecker = resolveProject("ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py")
const nextRequestId = "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-20260815-190500000"
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-owner-action-request-v1",
  status: "awaiting_owner_review_not_authorized",
  requestId: `request-${nextRequestId}`,
  commandRef: nextRequestId,
  requestType: "cpu_only_readonly_gpu_entry_implementation_and_contract_regression",
  proposedAuthorization: {
    requestId: nextRequestId,
    commandRef: nextRequestId,
    scope: "one_cpu_only_bounded_early_convergence_readonly_gpu_entry_implementation",
    outputNamespace: ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementations/20260815-190500000",
    requiredBindings: {
      implementationReport: bind(files.report),
      inactiveSupportContract: bind(files.support),
      inactiveConfig: bind(files.config),
      cpuReport: bind(files.cpu),
      trainer: codeBindings["train_ai_assisted_conditional_denoiser.py"],
      currentGradientRunner: bind(gradientRunner),
      currentGradientCpuChecker: bind(gradientChecker),
    },
    allowedActions: [
      "modify_only_existing_stage4_gradient_diagnostic_runner_cpu_checker_and_one_bounded_recorder",
      "add_inactive_two_lane_readonly_gpu_qualification_mode",
      "execute_python_node_syntax_checks_and_cpu_positive_negative_contract_regression",
      "form_implementation_report_inactive_gpu_execution_contract_owner_request_terminal_capsule_ledger_and_sqlite_index",
    ],
    deniedActions: [
      "actual_gpu_or_cuda", "autograd", "checkpoint_read_or_load", "model_load",
      "optimizer_or_backward", "training", "validation", "smoke", "automatic_retry",
      "review_threshold_change", "stage0", "stage1", "stage2",
      "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry",
    ],
    oneTimeConsumptionRequired: true,
  },
  fixedTotalProgress: progress,
  nextLegalAction: "owner_approve_proposed_cpu_only_readonly_gpu_entry_implementation_or_exit",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-stabilization-cpu-terminal-v1",
  status: "stage4_object_reference_multiscale_early_convergence_stabilization_cpu_succeeded_closed",
  sourceRunId: "20260815-190000000",
  fixedTotalProgress: progress,
  implementationReport: bind(files.report),
  supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner),
  scopeBoundary: rawCpu.executionBoundary,
  nextLegalAction: "owner_review_owner_action_request_and_approve_cpu_only_readonly_gpu_entry_implementation_or_exit",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_reference_multiscale_early_convergence_stabilization_cpu_succeeded_closed",
  module: "AI Painter R5",
  currentStage: "Two-lane early-convergence stabilization CPU support complete and inactive",
  sourceRunId: "20260815-190000000",
  fixedTotalProgress: progress,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  inactiveSupportContract: bind(files.support),
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  latestBlocker: "readonly_gpu_entry_implementation_not_authorized",
  nextLegalAction: "owner_review_owner_action_request_and_approve_cpu_only_readonly_gpu_entry_implementation_or_exit",
  checkpointPromotable: false,
  checkpointWeightsReadNow: false,
  gpuUsedNow: false,
  trainingStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: REQUEST_ID,
    artifactType: "record",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-early-convergence-cpu-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_early_convergence_stabilization_cpu_implementation",
  runId: REQUEST_ID,
  kind: "cpu_only_bounded_implementation_and_contract_regression",
  status: "success",
  title: "Stage4 two-lane early-convergence stabilization CPU support completed",
  titleZh: "Stage4 双通道早期收敛稳定化 CPU 支持完成",
  detailZh: `CPU 正向 ${rawCpu.positivePassed}/${rawCpu.positiveTotal}、反向 ${rawCpu.negativePassed}/${rawCpu.negativeTotal}；未读 Checkpoint、未使用 GPU、未执行 autograd/backward、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: progress,
})
closeStorageCatalog()
console.log(JSON.stringify({
  status: read(files.terminal).status,
  implementationReport: bind(files.report),
  inactiveSupportContract: bind(files.support),
  inactiveConfig: bind(files.config),
  cpuReport: bind(files.cpu),
  ownerActionRequest: bind(files.owner),
  terminal: bind(files.terminal),
  capsule: bind(files.capsule),
  positive: `${rawCpu.positivePassed}/${rawCpu.positiveTotal}`,
  negative: `${rawCpu.negativePassed}/${rawCpu.negativeTotal}`,
}, null, 2))
