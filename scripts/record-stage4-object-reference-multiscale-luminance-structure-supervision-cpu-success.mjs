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
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-luminance-structure-supervision-cpu-implementation-20260815-141934048"
const AUTH_SCHEMA = "owner-authorized-stage4-object-reference-multiscale-luminance-structure-supervision-cpu-implementation-v1"
const SCOPE = "one_bounded_cpu_only_inactive_multiscale_luminance_structure_supervision_implementation_config_compile_and_contract_regression_only"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260815-072500000-stage0/active-config.json"
const SOURCE_CONFIG_SHA256 = "35029e50375597680abaa12a45eff9356e4c2afff3d03f0677854c993d53476a"
const OUTPUT_NAMESPACE = ".runtime/ai-painter/stage4-object-reference-multiscale-luminance-structure-supervision-cpu-implementations/20260815-141934048"
const TARGETS = [
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py",
  "ml/ai-painter/scripts/check_stage4_object_reference_multiscale_luminance_structure_supervision_cpu.py",
  "scripts/record-stage4-object-reference-multiscale-luminance-structure-supervision-cpu-success.mjs",
]
const REQUIRED_ACTIONS = [
  "implement_one_versioned_inactive_four_object_multiscale_luminance_structure_supervision_cpu_branch",
  "inherit_exact_existing_texture_hierarchy_scales_without_free_numerical_selection",
  "compile_one_inactive_configuration_fragment",
  "run_python_syntax_and_cpu_forward_positive_negative_contract_regressions",
  "write_implementation_report_terminal_capsule_and_inactive_gpu_qualification_request",
  "synchronize_implementation_event_ledger_and_sqlite_index",
]
const FORBIDDEN_ACTIONS = [
  "gpu_or_cuda_initialization",
  "model_or_checkpoint_read_or_load",
  "optimizer_creation_or_backward",
  "training_or_validation_or_smoke",
  "automatic_retry",
  "stage1_or_stage2",
  "formal_inference_or_checkpoint_promotion",
  "runtime_frame_or_world_entry",
]

const value = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (input) => {
  assert.equal(path.isAbsolute(input), false, `absolute_path_rejected:${input}`)
  const result = path.resolve(ROOT, input)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${input}`)
  return result
}
const sha = (input) => crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex")
const read = (input) => JSON.parse(fs.readFileSync(input, "utf8"))
const relative = (input) => path.relative(ROOT, input).replaceAll("\\", "/")
const bind = (input) => ({ path: relative(input), sha256: sha(input) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const authorizationArg = value("--authorization")
const authorizationSha256 = value("--authorization-sha256")
const consumptionArg = value("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = resolveProject(authorizationArg)
const consumptionPath = resolveProject(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(same(authorization.authorizedTargetPaths, TARGETS), true, "authorized_targets_changed")
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_changed")
for (const field of [
  "implementationExecutionAuthorized",
  "configurationCompileAuthorized",
  "cpuContractRegressionAuthorized",
]) {
  assert.equal(authorization[field], true, `${field}_closed`)
}
for (const field of [
  "checkpointFileReadAuthorized", "modelLoadAuthorized", "optimizerCreationAuthorized",
  "backwardExecutionAuthorized", "modelParameterUpdateAuthorized", "gpuAuthorized",
  "cudaInitializationAuthorized", "trainingAuthorized", "validationAuthorized",
  "smokeAuthorized", "stage1Or2Authorized", "automaticRetryAuthorized",
  "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized",
  "worldEntryAuthorized",
]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
assert.deepEqual(authorization.targetPreimageBindings.trainer, {
  path: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  sha256: "fdf89032f1c4ee7a4d4cbfb4640a83bc3563bc81b6b790eb22ffc006049871ec",
})
for (const name of ["compiler", "checker", "recorder"]) {
  assert.equal(
    authorization.targetPreimageBindings[name].mustNotExistBeforeFirstWrite,
    true,
    `${name}_preimage_contract_changed`,
  )
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(
  consumption.status,
  "cpu_only_inactive_multiscale_implementation_authorization_atomically_consumed",
)
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.oneTimeConsumption, true)
for (const field of [
  "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted",
  "modelWeightsMutated", "gpuUsed", "cudaInitialized", "trainingStarted",
  "validationStarted", "smokeStarted", "stage1Or2Started",
]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}

const sourceConfig = resolveProject(SOURCE_CONFIG)
assert.equal(sha(sourceConfig), SOURCE_CONFIG_SHA256, "source_config_identity_changed")
const output = resolveProject(OUTPUT_NAMESPACE)
assert.equal(fs.existsSync(output), false, "implementation_output_namespace_exists")
const files = {
  config: path.join(output, "inactive-config-fragment.json"),
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "implementation-report.json"),
  support: path.join(output, "inactive-support-contract.json"),
  owner: path.join(output, "inactive-gpu-qualification-owner-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
assert.equal(fs.existsSync(python), true, "project_python_missing")
const syntax = spawnSync(python, [
  "-B", "-c",
  "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
  ...TARGETS.filter((target) => target.endsWith(".py")),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const commonArgs = [
  "--source", SOURCE_CONFIG,
  "--source-sha256", SOURCE_CONFIG_SHA256,
  "--authorization", authorizationArg,
  "--authorization-sha256", authorizationSha256,
  "--consumption", consumptionArg,
  "--consumption-sha256", sha(consumptionPath),
]
const compile = spawnSync(python, [
  "-B",
  path.join(ROOT, "ml", "ai-painter", "scripts", "compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py"),
  ...commonArgs,
  "--output", relative(files.config),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(compile.status, 0, `inactive_config_compile_failed:${compile.stderr}`)
const check = spawnSync(python, [
  "-B",
  path.join(ROOT, "ml", "ai-painter", "scripts", "check_stage4_object_reference_multiscale_luminance_structure_supervision_cpu.py"),
  ...commonArgs,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(Object.values(cpu.executionBoundary).every((item) => item === false), true)

const now = new Date().toISOString()
const codes = Object.fromEntries(TARGETS.map((target) => [path.basename(target), bind(resolveProject(target))]))
writeJsonAtomic(files.cpu, {
  ...cpu,
  syntaxCheckedFiles: TARGETS.filter((target) => target.endsWith(".py")),
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-luminance-structure-supervision-implementation-report-v1",
  status: "stage4_object_reference_multiscale_luminance_structure_cpu_support_implemented_inactive",
  runId: "20260815-072500000-stage0",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceConfig: {
    path: SOURCE_CONFIG,
    sha256: SOURCE_CONFIG_SHA256,
    jsonReadOnly: true,
    checkpointFileRead: false,
  },
  formalDesign: authorization.sourceEvidence.formalDesign,
  formalDesignTerminal: authorization.sourceEvidence.formalDesignTerminal,
  codeBindings: codes,
  inactiveConfigFragment: bind(files.config),
  cpuReport: bind(files.cpu),
  implementationFinding: {
    contractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
    exactObjectChannels: [
      "object_footprints", "object_tree", "object_rock", "object_vegetation",
    ],
    inheritedPyramidScales: [1, 0.5, 0.25],
    perScaleMaskedLuminanceCorrelationImplemented: true,
    maskedLaplacianPyramidStructureConsistencyImplemented: true,
    aggregationRule: "arithmetic_mean_over_required_obligations_then_existing_typed_weights",
    failedSingleScaleCandidateRejected: true,
    newNumericWeightSelected: false,
    waterAndPathBehaviorPreserved: true,
    reviewThresholdsChanged: false,
  },
  executionBoundary: cpu.executionBoundary,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-object-reference-multiscale-luminance-structure-supervision-inactive-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
  implementationReport: bind(files.report),
  inactiveConfigFragment: bind(files.config),
  cpuReport: bind(files.cpu),
  activationGate: {
    configurationActiveNow: false,
    checkpointReadNow: false,
    modelLoadNow: false,
    optimizerCreationNow: false,
    backwardExecutionNow: false,
    modelParameterUpdateNow: false,
    gpuUseNow: false,
    cudaInitializationNow: false,
    trainingNow: false,
    validationNow: false,
    smokeNow: false,
    stage1Now: false,
    stage2Now: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_review_cpu_implementation_and_choose_one_readonly_gpu_gradient_qualification_or_candidate_exit",
  boundImplementationReport: bind(files.report),
  boundSupportContract: bind(files.support),
  boundInactiveConfigFragment: bind(files.config),
  boundCpuReport: bind(files.cpu),
  requestedGpuScope: "one_bounded_readonly_gradient_qualification_only",
  trainingOrGpuAuthorized: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-luminance-structure-supervision-cpu-terminal-v1",
  status: "stage4_object_reference_multiscale_luminance_structure_cpu_succeeded_closed",
  runId: "20260815-072500000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_review_cpu_implementation_and_choose_one_readonly_gpu_gradient_qualification_or_candidate_exit",
  implementationReport: bind(files.report),
  supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner),
  trainingStarted: false,
  gpuUsed: false,
  cudaInitialized: false,
  validationStarted: false,
  smokeStarted: false,
  stage1Or2Started: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 object-reference multiscale luminance-structure CPU support complete and inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "readonly_gpu_gradient_qualification_not_authorized",
  nextLegalAction: "owner_review_cpu_implementation_and_choose_one_readonly_gpu_gradient_qualification_or_candidate_exit",
  forbiddenActions: FORBIDDEN_ACTIONS,
  evidence: {
    implementationReport: bind(files.report),
    inactiveConfigFragment: bind(files.config),
    cpuReport: bind(files.cpu),
    supportContract: bind(files.support),
    ownerActionRequest: bind(files.owner),
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: REQUEST_ID,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-cpu-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_luminance_structure_cpu_support",
  runId: REQUEST_ID,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 multiscale object luminance-structure CPU support completed",
  titleZh: "Stage4 四对象多尺度亮度—结构监督 CPU 支持完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向拒绝 ${cpu.negativePassed}/${cpu.negativeTotal}；未执行 backward、CUDA/GPU、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  inactiveConfigFragment: bind(files.config),
  cpuReport: bind(files.cpu),
  supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
