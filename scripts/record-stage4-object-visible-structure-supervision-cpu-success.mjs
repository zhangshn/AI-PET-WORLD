import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-semantic-mixture-object-visible-structure-supervision-implementation-20260815-002000000"
const AUTH_SCHEMA = "owner-authorized-stage4-semantic-mixture-object-visible-structure-supervision-implementation-v1"
const SCOPE = "one_bounded_cpu_only_inactive_object_visible_structure_supervision_implementation_and_contract_regression_only"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260814-154900000-stage0/active-config.json"
const SOURCE_CONFIG_SHA256 = "224240d3f9286a3400da6582a6293728e493d0cb60cff7bf446f141b239c4e5e"
const TARGETS = [
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/compile_stage4_object_visible_structure_supervision_config.py",
  "ml/ai-painter/scripts/check_stage4_object_visible_structure_supervision_cpu.py",
  "scripts/record-stage4-object-visible-structure-supervision-cpu-success.mjs",
]
const REQUIRED_ACTIONS = [
  "implement_inactive_four_typed_object_visible_structure_supervision_cpu_support",
  "generalize_existing_masked_luminance_correlation_to_exact_four_object_channels",
  "reuse_existing_per_class_final_visible_weights_without_new_numeric_selection",
  "modify_only_bound_trainer_and_new_compiler_checker_finalizer",
  "run_python_syntax_and_cpu_forward_positive_negative_contract_regressions",
  "write_inactive_contract_fragment_cpu_report_implementation_report_terminal_capsule_owner_request",
  "synchronize_implementation_event_ledger_and_sqlite",
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
assert.equal(authorization.implementationExecutionAuthorized, true)
for (const field of ["checkpointFileReadAuthorized", "backwardExecutionAuthorized", "trainingAuthorized", "gpuAuthorized", "validationAuthorized", "smokeAuthorized"]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  if (name === "currentTrainer") {
    assert.deepEqual(binding, {
      path: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
      sha256: "2f527811e5dcb10fbb0380c38f0770edaef8b40d74f6391f8898226675a6b565",
    }, "trainer_preimage_binding_changed")
    continue
  }
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(consumption.status, "cpu_only_inactive_implementation_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
for (const field of ["checkpointFileRead", "optimizerCreated", "backwardExecuted", "modelWeightsMutated", "gpuUsed", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}

const sourceConfig = resolveProject(SOURCE_CONFIG)
assert.equal(sha(sourceConfig), SOURCE_CONFIG_SHA256, "source_config_identity_changed")
const output = resolveProject(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "implementation_output_namespace_exists")
const files = {
  config: path.join(output, "inactive-config-fragment.json"),
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "implementation-report.json"),
  support: path.join(output, "inactive-support-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
assert.equal(fs.existsSync(python), true, "project_python_missing")
const commonArgs = [
  "--source", SOURCE_CONFIG,
  "--source-sha256", SOURCE_CONFIG_SHA256,
  "--authorization", authorizationArg,
  "--authorization-sha256", authorizationSha256,
  "--consumption", consumptionArg,
  "--consumption-sha256", sha(consumptionPath),
]
const compile = spawnSync(python, [
  path.join(ROOT, "ml", "ai-painter", "scripts", "compile_stage4_object_visible_structure_supervision_config.py"),
  ...commonArgs,
  "--output", relative(files.config),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(compile.status, 0, `inactive_config_compile_failed:${compile.stderr}`)
const check = spawnSync(python, [
  path.join(ROOT, "ml", "ai-painter", "scripts", "check_stage4_object_visible_structure_supervision_cpu.py"),
  ...commonArgs,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(Object.values(cpu.executionBoundary).every((item) => item === false), true)
const now = new Date().toISOString()
const codes = Object.fromEntries(TARGETS.map((target) => [path.basename(target), bind(resolveProject(target))]))
writeJsonAtomic(files.cpu, { ...cpu, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-supervision-implementation-report-v1",
  status: "stage4_object_visible_structure_supervision_cpu_support_implemented_inactive",
  runId: "20260814-154900000-stage0",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceConfig: { path: SOURCE_CONFIG, sha256: SOURCE_CONFIG_SHA256, jsonReadOnly: true, checkpointFileRead: false },
  formalDesign: authorization.sourceEvidence.formalDesign,
  codeBindings: codes,
  inactiveConfigFragment: bind(files.config),
  cpuReport: bind(files.cpu),
  implementationFinding: {
    exactObjectChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    existingPerClassWeightsReused: true,
    newNumericWeightSelected: false,
    singleObjectVegetationLuminanceContractReplacedNotStacked: true,
    waterAndPathBehaviorPreserved: true,
    reviewThresholdsChanged: false,
  },
  executionBoundary: cpu.executionBoundary,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.support, {
  schemaVersion: "stage4-object-visible-structure-supervision-inactive-support-contract-v1",
  status: "cpu_support_verified_inactive",
  contractId: "stage4_four_typed_object_visible_structure_supervision_v1",
  implementationReport: bind(files.report),
  inactiveConfigFragment: bind(files.config),
  cpuReport: bind(files.cpu),
  activationGate: {
    configurationActiveNow: false,
    checkpointReadNow: false,
    optimizerCreationNow: false,
    backwardExecutionNow: false,
    modelParameterUpdateNow: false,
    gpuUseNow: false,
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
  requestedAction: "owner_review_cpu_implementation_and_choose_separate_readonly_gpu_gradient_qualification_or_candidate_exit",
  boundImplementationReport: bind(files.report),
  boundSupportContract: bind(files.support),
  trainingOrGpuAuthorized: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-supervision-cpu-terminal-v1",
  status: "stage4_object_visible_structure_supervision_cpu_succeeded_closed",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_review_cpu_implementation_and_choose_separate_readonly_gpu_gradient_qualification_or_candidate_exit",
  implementationReport: bind(files.report),
  supportContract: bind(files.support),
  ownerActionRequest: bind(files.owner),
  trainingStarted: false,
  gpuUsed: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 object-visible-structure supervision CPU support complete and inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "readonly_gpu_gradient_qualification_not_authorized",
  nextLegalAction: "owner_review_cpu_implementation_and_choose_separate_readonly_gpu_gradient_qualification_or_candidate_exit",
  forbiddenActions: authorization.deniedActions,
  evidence: { implementationReport: bind(files.report), inactiveConfigFragment: bind(files.config), cpuReport: bind(files.cpu), supportContract: bind(files.support), ownerActionRequest: bind(files.owner) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-cpu-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_supervision_cpu_support",
  runId: REQUEST_ID,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 object-visible-structure supervision CPU support completed",
  titleZh: "Stage4 四对象可见结构监督 CPU 支持完成",
  detailZh: `复用既有四对象权重；CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向拒绝 ${cpu.negativePassed}/${cpu.negativeTotal}。未执行 backward、GPU、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), implementationReport: bind(files.report), inactiveConfigFragment: bind(files.config), cpuReport: bind(files.cpu), supportContract: bind(files.support), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
